"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events, rsvps } from "@/db/schema";
import { auth } from "@/lib/auth";

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accenten eraf
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** Slug moet uniek zijn, want hij zit in de deel-URL. */
async function uniqueSlug(base: string) {
  let slug = base || "event";
  let n = 2;
  while ((await db.select({ id: events.id }).from(events).where(eq(events.slug, slug))).length) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

export async function createEvent(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/new");

  const title = String(formData.get("title") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const someday = formData.get("someday") === "on";
  const startsAtRaw = String(formData.get("startsAt") ?? "");

  // Locatie en titel altijd verplicht. Een datum alleen als het geen
  // "ooit"-event is; die staat juist op de someday-lijst zonder datum.
  if (!title || !location || (!someday && !startsAtRaw)) redirect("/new?error=leeg");

  let startsAt: Date | null = null;
  let endsAt: Date | null = null;
  if (!someday) {
    startsAt = new Date(startsAtRaw);
    if (Number.isNaN(startsAt.getTime())) redirect("/new?error=datum");
    const hours = Number(formData.get("hours")) || 3;
    endsAt = new Date(startsAt.getTime() + hours * 3600000);
  }

  const slug = await uniqueSlug(slugify(title));

  const [created] = await db
    .insert(events)
    .values({
      slug,
      title,
      sport: String(formData.get("sport") ?? "Anders"),
      distance: String(formData.get("distance") ?? "").trim() || null,
      location,
      startsAt,
      endsAt,
      description: String(formData.get("description") ?? "").trim() || null,
      signupUrl: String(formData.get("signupUrl") ?? "").trim() || null,
      price: String(formData.get("price") ?? "").trim() || null,
      imageUrl: String(formData.get("imageUrl") ?? "").trim() || null,
      createdBy: session.user.id,
    })
    .returning();

  // Wie een event plaatst doet zelf mee, tot hij anders aangeeft.
  await db.insert(rsvps).values({
    eventId: created.id,
    userId: session.user.id,
    role: "run",
  });

  // ?new=1 laat de event-pagina de deelknop voor WhatsApp benadrukken.
  redirect(`/e/${created.slug}?new=1`);
}
