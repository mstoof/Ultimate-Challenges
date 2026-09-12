import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { encrypt, notionConfigured } from "@/lib/notion/security";

export async function GET() {
  const redirectUri = process.env.NOTION_REDIRECT_URI;
  const session = await auth();
  if (!session?.user?.id || !notionConfigured() || !redirectUri) {
    return new NextResponse("Log in en configureer eerst de Notion-verbinding.", { status: 400 });
  }
  const state = randomBytes(32).toString("base64url");
  const url = new URL("https://api.notion.com/v1/oauth/authorize");
  url.search = new URLSearchParams({ client_id: process.env.NOTION_CLIENT_ID!, redirect_uri: redirectUri, response_type: "code", owner: "user", state }).toString();
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "no-store");
  response.cookies.set("notion_oauth_state", encrypt(JSON.stringify({ state, expires: Date.now() + 600000 }), session.user.id), {
    httpOnly: true, secure: new URL(redirectUri).protocol === "https:", sameSite: "lax", path: "/api/notion", maxAge: 600,
  });
  return response;
}
