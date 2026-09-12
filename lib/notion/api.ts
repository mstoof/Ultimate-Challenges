import { setTimeout as sleep } from "node:timers/promises";
import { decrypt, encrypt } from "./security";
import { db } from "@/db/client";
import { notionConnections, type NotionConnection } from "@/db/schema";
import { eq } from "drizzle-orm";

export class NotionError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function oauthRequest(path: "token" | "revoke", body: Record<string, string>) {
  const res = await fetch(`https://api.notion.com/v1/oauth/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/json",
      "Notion-Version": "2025-09-03",
    },
    body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new NotionError(res.status, "Verbind Notion opnieuw om verder te gaan.");
  return res.json();
}

// Use this client only while holding the per-member database lease: token rotation
// and export writes must not race across concurrent Vercel invocations.
export function notionClient(connection: NotionConnection) {
  let token = decrypt(connection.accessToken!, connection.userId);
  let nextRequestAt = 0;
  return async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    let refreshed = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      await sleep(Math.max(0, nextRequestAt - Date.now()));
      nextRequestAt = Date.now() + 400;
      const res = await fetch(`https://api.notion.com/v1${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Notion-Version": "2025-09-03" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        cache: "no-store", signal: AbortSignal.timeout(10000),
      });
      if (res.status === 401 && !refreshed && connection.refreshToken) {
        refreshed = true;
        const tokens = await oauthRequest("token", { grant_type: "refresh_token", refresh_token: decrypt(connection.refreshToken, connection.userId) });
        if (!tokens.access_token || !tokens.refresh_token) throw new NotionError(401, "Verbind Notion opnieuw.");
        token = tokens.access_token;
        connection.accessToken = encrypt(token, connection.userId);
        connection.refreshToken = encrypt(tokens.refresh_token, connection.userId);
        await db.update(notionConnections).set({ accessToken: connection.accessToken, refreshToken: connection.refreshToken }).where(eq(notionConnections.userId, connection.userId));
        continue;
      }
      if (res.status === 429 && attempt < 2) {
        const delay = Number(res.headers.get("retry-after") || 1);
        if (!Number.isFinite(delay) || delay > 3) throw new NotionError(429, "Notion is even druk. Probeer de export straks te hervatten.");
        await sleep(Math.max(1, delay) * 1000);
        continue;
      }
      if (!res.ok) {
        const message = res.status === 401 ? "Je Notion-verbinding is verlopen. Verbind opnieuw." :
          res.status === 403 || res.status === 404 ? "Geen toegang tot deze Notion-pagina. Controleer of de pagina met de verbinding is gedeeld en niet in de prullenbak staat." :
          res.status === 400 ? "Notion kan de export niet verwerken. Laat de kolomnamen en kolomtypes van de trainingstabel intact." :
          "Notion is tijdelijk niet bereikbaar. Je kunt de export opnieuw proberen.";
        throw new NotionError(res.status, message);
      }
      return res.json() as Promise<T>;
    }
    throw new NotionError(429, "Notion is even druk. Probeer het straks opnieuw.");
  };
}
export type NotionClient = ReturnType<typeof notionClient>;
export type NotionPage = {
  id: string; object: string; archived?: boolean; in_trash?: boolean;
  properties?: Record<string, {
    type?: string;
    title?: { plain_text?: string; text?: { content: string } }[];
    rich_text?: { plain_text?: string; text?: { content: string } }[];
  }>;
};
export type NotionList<T> = { results: T[]; has_more: boolean; next_cursor: string | null };
