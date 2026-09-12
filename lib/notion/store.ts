import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db } from "@/db/client";
import { notionConnections, type NotionConnection } from "@/db/schema";
import { NotionError } from "./api";

export async function withConnection<T>(userId: string, run: (connection: NotionConnection) => Promise<T>): Promise<T> {
  const lockId = crypto.randomUUID();
  const [connection] = await db.update(notionConnections).set({ lockId, lockUntil: new Date(Date.now() + 120000) })
    .where(and(eq(notionConnections.userId, userId), or(isNull(notionConnections.lockUntil), lt(notionConnections.lockUntil, new Date())))).returning();
  if (!connection) {
    const [existing] = await db.select({ userId: notionConnections.userId }).from(notionConnections).where(eq(notionConnections.userId, userId));
    throw new NotionError(existing ? 409 : 401, existing ? "Er loopt al een Notion-verzoek. Probeer het over een moment opnieuw." : "Verbind eerst je Notion-account.");
  }
  try {
    if (!connection.accessToken) throw new NotionError(401, "Verbind eerst je Notion-account.");
    return await run(connection);
  } finally {
    await db.update(notionConnections).set({ lockId: null, lockUntil: null })
      .where(and(eq(notionConnections.userId, userId), eq(notionConnections.lockId, lockId)));
  }
}

export function notionStatus(connection?: NotionConnection) {
  return {
    configured: true,
    connected: Boolean(connection?.accessToken),
    workspace: connection?.accessToken ? connection.workspaceName : null,
    parentPageId: connection?.parentPageId ?? null,
    url: connection?.databaseId ? `https://www.notion.so/${connection.databaseId.replaceAll("-", "")}` : null,
    progress: connection?.exportJob ? { completed: connection.exportJob.cursor, total: connection.exportJob.tasks.length } : null,
    lastExportedAt: connection?.lastExportedAt?.toISOString() ?? null,
  };
}
