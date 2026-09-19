import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { notionConnections, trainingBlocks, trainingDone } from "@/db/schema";
import { decrypt, notionConfigured, sameOrigin } from "@/lib/notion/security";
import { notionClient, NotionError, oauthRequest } from "@/lib/notion/api";
import { notionStatus, withConnection } from "@/lib/notion/store";
import { planTasks } from "@/lib/notion/format";
import { ensureDatabase, exportBatch, hydratePageMap } from "@/lib/notion/export";

export const maxDuration = 60;
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return json({ error: "Log eerst in." }, 401);
  if (!notionConfigured()) return json({ configured: false, connected: false });
  try {
    const [connection] = await db.select().from(notionConnections).where(eq(notionConnections.userId, session.user.id));
    return json(notionStatus(connection));
  } catch { return json({ error: "Notion is nog niet beschikbaar. Controleer de databaseconfiguratie." }, 503); }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Ongeldige aanvraag." }, 403);
  const session = await auth();
  if (!session?.user?.id) return json({ error: "Log eerst in." }, 401);
  if (!notionConfigured()) return json({ error: "Notion is nog niet geconfigureerd." }, 503);
  let body: { action?: string; pageId?: string };
  try { body = await req.json(); } catch { return json({ error: "Ongeldige aanvraag." }, 400); }
  if (!body || !["start", "step", "disconnect"].includes(body.action ?? "")) return json({ error: "Onbekende actie." }, 400);
  try {
    return await withConnection(session.user.id, async (connection) => {
      if (body.action === "disconnect") {
        await oauthRequest("revoke", { token: decrypt(connection.accessToken!, connection.userId) });
        // Keep the destination and mapping for a reconnect to the same workspace.
        await db.update(notionConnections).set({ accessToken: null, refreshToken: null, exportJob: null }).where(eq(notionConnections.userId, connection.userId));
        connection.accessToken = null;
        connection.exportJob = null;
        return json(notionStatus(connection));
      }
      const request = notionClient(connection);
      if (body.action === "start") {
        if (!connection.exportJob) {
          const pageId = connection.parentPageId || body.pageId;
          if (typeof pageId !== "string" || !/^[a-f0-9-]{32,36}$/i.test(pageId)) throw new NotionError(400, "Kies eerst een Notion-pagina.");
          const blocks = await db.select().from(trainingBlocks).where(eq(trainingBlocks.userId, connection.userId)).orderBy(asc(trainingBlocks.blockIndex));
          if (!blocks.length) throw new NotionError(400, "Bouw eerst een trainingsplan.");
          const done = await db.select().from(trainingDone).where(eq(trainingDone.userId, connection.userId));
          const tasks = planTasks(blocks, done.map((row) => row.sessionId), Object.keys(connection.pageMap));
          if (!tasks.length) throw new NotionError(400, "Je plan bevat geen trainingen.");
          await ensureDatabase(connection, request, pageId);
          await hydratePageMap(connection, request);
          const hydratedTasks = planTasks(blocks, done.map((row) => row.sessionId), Object.keys(connection.pageMap));
          connection.exportJob = { tasks: hydratedTasks, cursor: 0, startedAt: new Date().toISOString() };
          await db.update(notionConnections).set({ exportJob: connection.exportJob }).where(eq(notionConnections.userId, connection.userId));
        }
        return json(notionStatus(connection));
      }
      const progress = await exportBatch(connection, request);
      return json({ ...notionStatus(connection), result: progress });
    });
  } catch (error) {
    return json({ error: error instanceof NotionError ? error.message : "Exporteren is onderbroken. Probeer opnieuw om verder te gaan." }, error instanceof NotionError ? error.status : 502);
  }
}
