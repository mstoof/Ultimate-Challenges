import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Draait op de Edge runtime, dus hier géén next-auth importeren: dat sleept de
 * hele Auth.js-stack (jose, DecompressionStream) mee en dat werkt niet op Edge.
 * We checken alleen of er een sessiecookie is; de pagina's en routes valideren
 * de sessie zelf nog met auth() op de Node-runtime.
 *
 * Publiek moet blijven:
 *  - /e/[slug]         anders ziet WhatsApp geen preview en klikt niemand door
 *  - /api/calendar.ics Google haalt die op zonder cookies
 *  - de losse ICS-routes en de auth-endpoints
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname.startsWith("/e/") ||
    pathname.startsWith("/api/calendar.ics") ||
    pathname.startsWith("/api/event/") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/icon") || // het tab-icoon moet altijd laden
    pathname.startsWith("/apple-icon");

  // Auth.js-sessiecookie: http -> authjs.session-token, https -> __Secure-...
  const hasSession =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");

  if (isPublic || hasSession) return NextResponse.next();

  const url = new URL("/login", req.nextUrl.origin);
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
