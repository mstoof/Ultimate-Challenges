import { gte } from "drizzle-orm";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { buildFeed } from "@/lib/calendar";

// Feed moet publiek en zonder login bereikbaar zijn: Google haalt hem op
// vanaf een eigen server, die stuurt geen cookies mee.
export const dynamic = "force-dynamic";

export async function GET() {
  // Zes weken terugkijken, zodat een net gelopen event nog in de agenda blijft staan.
  const since = new Date(Date.now() - 42 * 24 * 60 * 60 * 1000);
  const rows = await db.select().from(events).where(gte(events.startsAt, since));

  return new Response(buildFeed(rows), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="startlijst.ics"',
      "Cache-Control": "public, max-age=1800",
    },
  });
}
