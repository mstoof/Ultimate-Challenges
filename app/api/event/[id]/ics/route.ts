import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { buildSingle } from "@/lib/calendar";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [event] = await db.select().from(events).where(eq(events.slug, id)).limit(1);
  if (!event) return new Response("Niet gevonden", { status: 404 });
  // Een "ooit"-event heeft geen datum en kan dus geen agenda-item worden.
  if (!event.startsAt) return new Response("Nog geen datum", { status: 404 });

  return new Response(buildSingle({ ...event, startsAt: event.startsAt }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // attachment dwingt de agenda-app af in plaats van weergave in de browser
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
    },
  });
}
