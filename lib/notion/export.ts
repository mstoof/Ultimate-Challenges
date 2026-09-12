import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { notionConnections, type NotionConnection } from "@/db/schema";
import { type NotionClient, type NotionList, type NotionPage, NotionError } from "./api";
import { NOTION_PROPERTIES, richText, type ExportTask } from "./format";

/** Export writes are serialized by withConnection, including across server instances. */
export async function ensureDatabase(connection: NotionConnection, request: NotionClient, parentPageId: string) {
  if (connection.databaseId && connection.dataSourceId) return;
  const page = await request<NotionPage>(`/pages/${parentPageId}`);
  if (page.archived || page.in_trash) throw new NotionError(400, "Kies een Notion-pagina die niet in de prullenbak staat.");
  // A deterministic title lets a retry recover a database created just before a
  // network failure, without creating another copy. Only inspect the chosen parent.
  const title = `Ultimate Challenges · ${connection.userId.slice(0, 8)}`;
  let databaseId = connection.databaseId;
  if (!databaseId) {
    let cursor: string | null = null;
    let pageCount = 0;
    do {
      if (++pageCount > 5) throw new NotionError(400, "Deze pagina bevat te veel onderdelen. Kies een lege Notion-pagina voor je plan.");
      const children: NotionList<{ id: string; type: string; child_database?: { title: string } }> = await request(
        `/blocks/${parentPageId}/children?page_size=100${cursor ? `&start_cursor=${encodeURIComponent(cursor)}` : ""}`
      );
      databaseId = children.results.find((child) => child.type === "child_database" && child.child_database?.title === title)?.id ?? null;
      cursor = children.has_more ? children.next_cursor : null;
    } while (!databaseId && cursor);
  }
  type Database = { id: string; data_sources: { id: string }[] };
  const database = databaseId
    ? await request<Database>(`/databases/${databaseId}`)
    : await request<Database>("/databases", "POST", {
      parent: { type: "page_id", page_id: parentPageId },
      title: richText(title), is_inline: false,
      initial_data_source: { properties: NOTION_PROPERTIES },
    });
  const dataSourceId = database.data_sources?.[0]?.id;
  if (!dataSourceId) throw new NotionError(502, "Notion heeft geen trainingstabel aangemaakt. Probeer opnieuw.");
  connection.parentPageId = parentPageId;
  connection.databaseId = database.id;
  connection.dataSourceId = dataSourceId;
  await db.update(notionConnections).set({ parentPageId, databaseId: database.id, dataSourceId })
    .where(eq(notionConnections.userId, connection.userId));
}

export async function exportTask(request: NotionClient, dataSourceId: string, task: ExportTask, knownPageId?: string): Promise<string | null> {
  let pageId = knownPageId;
  if (!pageId && !task.stale) {
    // Recover a previous create even if the local checkpoint was interrupted.
    const existing = await request<NotionList<NotionPage>>(`/data_sources/${dataSourceId}/query`, "POST", {
      filter: { property: "Sessie-ID", rich_text: { equals: task.sessionId } }, page_size: 1,
    });
    pageId = existing.results[0]?.id;
  }
  if (pageId) {
    try {
      await request(`/pages/${pageId}`, "PATCH", { properties: task.properties });
      return pageId;
    } catch (error) {
      // Never recreate on permission errors: a lost permission is not evidence
      // that a page was deleted. Let the member restore access and resume.
      if (task.stale && error instanceof NotionError && error.status === 404) return null;
      throw error;
    }
  }
  if (task.stale) return null;
  const page = await request<NotionPage>("/pages", "POST", {
    parent: { type: "data_source_id", data_source_id: dataSourceId },
    properties: { ...task.properties, Klaar: { checkbox: Boolean(task.done) } },
  });
  return page.id;
}

export async function exportBatch(connection: NotionConnection, request: NotionClient) {
  const job = connection.exportJob;
  if (!job || !connection.dataSourceId) throw new NotionError(400, "Start eerst een export.");
  // One task per request keeps even token refresh + rate-limit retries within
  // the Vercel budget. The browser continues until all checkpoints are saved.
  if (job.cursor < job.tasks.length) {
    const task = job.tasks[job.cursor];
    const pageId = await exportTask(request, connection.dataSourceId, task, connection.pageMap[task.sessionId]);
    if (pageId) connection.pageMap[task.sessionId] = pageId;
    if (task.stale) delete connection.pageMap[task.sessionId];
    job.cursor++;
  }
  const finished = job.cursor >= job.tasks.length;
  if (finished) connection.lastExportedAt = new Date();
  connection.exportJob = finished ? null : job;
  await db.update(notionConnections).set({
    pageMap: connection.pageMap, exportJob: connection.exportJob, lastExportedAt: connection.lastExportedAt,
  }).where(eq(notionConnections.userId, connection.userId));
  return { completed: job.cursor, total: job.tasks.length, finished };
}
