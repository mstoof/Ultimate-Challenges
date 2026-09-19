import { NextRequest, NextResponse } from "next/server";
import { eq, isNull, lt, or } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/db/client";
import { notionConnections } from "@/db/schema";
import { encrypt, notionConfigured, validState } from "@/lib/notion/security";
import { oauthRequest } from "@/lib/notion/api";

export async function GET(req: NextRequest) {
  function finish(status: string) {
    const response = NextResponse.redirect(new URL(`/plan?notion=${status}`, process.env.NOTION_REDIRECT_URI || req.url));
    response.cookies.set("notion_oauth_state", "", { path: "/api/notion", maxAge: 0 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
  const session = await auth();
  if (!session?.user?.id || !notionConfigured() || !validState(req.cookies.get("notion_oauth_state")?.value, req.nextUrl.searchParams.get("state"), session.user.id)) return finish("invalid");
  if (req.nextUrl.searchParams.has("error")) return finish("cancelled");
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return finish("invalid");
  const userId = session.user.id;
  try {
    const tokens = await oauthRequest("token", { grant_type: "authorization_code", code, redirect_uri: process.env.NOTION_REDIRECT_URI! });
    if (typeof tokens.access_token !== "string" || typeof tokens.workspace_id !== "string" || typeof tokens.bot_id !== "string") return finish("error");
    const [existing] = await db.select().from(notionConnections).where(eq(notionConnections.userId, userId));
    const sameWorkspace = existing?.workspaceId === tokens.workspace_id;
    const values = {
      userId, accessToken: encrypt(tokens.access_token, userId),
      refreshToken: typeof tokens.refresh_token === "string" ? encrypt(tokens.refresh_token, userId) : null,
      workspaceId: tokens.workspace_id, workspaceName: tokens.workspace_name || "Notion", botId: tokens.bot_id,
      ...(!sameWorkspace ? { parentPageId: null, databaseId: null, dataSourceId: null, pageMap: {}, exportJob: null, lastExportedAt: null } : {}),
    };
    const updated = await db.insert(notionConnections).values(values).onConflictDoUpdate({
      target: notionConnections.userId, set: values,
      setWhere: or(isNull(notionConnections.lockUntil), lt(notionConnections.lockUntil, new Date())),
    }).returning({ userId: notionConnections.userId });
    return finish(updated.length ? "connected" : "busy");
  } catch { return finish("error"); }
}
