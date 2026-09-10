import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * Publiek moet blijven:
 *  - /e/[slug]        anders ziet WhatsApp geen preview en klikt niemand door
 *  - /api/calendar.ics Google haalt die op zonder cookies
 * Aanmelden vereist wel een sessie, dat handelt de pagina zelf af.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname.startsWith("/e/") ||
    pathname.startsWith("/api/calendar.ics") ||
    pathname.startsWith("/api/event/") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth");

  if (isPublic || req.auth) return NextResponse.next();

  const url = new URL("/login", req.nextUrl.origin);
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
