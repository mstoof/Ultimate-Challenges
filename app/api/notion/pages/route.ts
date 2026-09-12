import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { notionConfigured } from "@/lib/notion/security";
import { notionClient, NotionError, type NotionList, type NotionPage } from "@/lib/notion/api";
import { withConnection } from "@/lib/notion/store";

export const maxDuration = 60;
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Log eerst in." }, { status: 401 });
  if (!notionConfigured()) return NextResponse.json({ error: "Notion is nog niet geconfigureerd." }, { status: 503 });
  try {
    return await withConnection(session.user.id, async (connection) => {
      const cursor = new URL(req.url).searchParams.get("cursor");
      const result = await notionClient(connection)<NotionList<NotionPage>>("/search", "POST", {
        filter: { value: "page", property: "object" }, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}),
      });
      return NextResponse.json({
        pages: result.results.filter((page) => !page.archived && !page.in_trash).map((page) => ({
          id: page.id,
          title: Object.values(page.properties ?? {}).find((prop) => prop.type === "title")?.title?.map((text) => text.plain_text ?? text.text?.content ?? "").join("") || "Naamloze pagina",
        })), nextCursor: result.has_more ? result.next_cursor : null,
      }, { headers: { "Cache-Control": "no-store" } });
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof NotionError ? error.message : "Kon Notion-pagina’s niet laden. Probeer opnieuw." }, { status: error instanceof NotionError ? error.status : 502 });
  }
}
