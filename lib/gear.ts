import { and, asc, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db/client";
import { events, rsvps, gearSports, gearItems, gearProfiles } from "@/db/schema";
import { weeksUntil } from "@/lib/training";
import { bucketForWeeks, type GearSectionView } from "@/lib/gear-shared";

// De client-veilige helpers/types wonen in lib/gear-shared.ts (géén DB-import),
// zodat client components ze kunnen gebruiken. Hier her-exporteren we ze zodat
// server-code één import-pad houdt.
export {
  GEAR_TAGS,
  BUCKET_WEEKS,
  bucketForWeeks,
  effectivePrice,
  safeTags,
} from "@/lib/gear-shared";
export type { GearTag, GearBucket, GearSectionView } from "@/lib/gear-shared";

/**
 * Per sport de dichtstbijzijnde toekomstige race waarvoor dit lid zich als
 * runner/support heeft aangemeld. Zelfde join als loadTargetRaces, maar
 * gegroepeerd op events.sport. Sporten zonder race staan niet in de map.
 */
export async function nextRaceBucketBySport(
  userId: string
): Promise<Record<string, { title: string; slug: string; date: Date; weeksAway: number }>> {
  const now = new Date();
  const rows = await db
    .select({ sport: events.sport, title: events.title, slug: events.slug, date: events.startsAt })
    .from(rsvps)
    .innerJoin(events, eq(events.id, rsvps.eventId))
    .where(and(eq(rsvps.userId, userId), inArray(rsvps.role, ["run", "support"]), gt(events.startsAt, now)))
    .orderBy(asc(events.startsAt));

  const map: Record<string, { title: string; slug: string; date: Date; weeksAway: number }> = {};
  for (const row of rows) {
    if (!row.date || row.sport in map) continue; // eerste = dichtstbijzijnde
    map[row.sport] = { title: row.title, slug: row.slug, date: row.date, weeksAway: weeksUntil(row.date) };
  }
  return map;
}

/**
 * De volledige gear-pagina voor een lid: gekozen sporten (op sortOrder), elk
 * met zijn items en de deadline-emmer uit de dichtstbijzijnde race.
 */
export async function loadGear(userId: string): Promise<GearSectionView[]> {
  const [sports, items, buckets, eventRows] = await Promise.all([
    db.select().from(gearSports).where(eq(gearSports.userId, userId)).orderBy(asc(gearSports.sortOrder), asc(gearSports.createdAt)),
    db.select().from(gearItems).where(eq(gearItems.userId, userId)).orderBy(asc(gearItems.sortOrder), asc(gearItems.createdAt)),
    nextRaceBucketBySport(userId),
    db.select({ id: events.id, title: events.title, slug: events.slug, sport: events.sport, date: events.startsAt })
      .from(events).where(or(gt(events.startsAt, new Date()), isNull(events.startsAt))),
  ]);

  const eventById = new Map(eventRows.map((event) => [event.id, event]));

  const sections = sports.map((s) => {
    const selected = s.targetEventId ? eventById.get(s.targetEventId) : null;
    const automatic = buckets[s.sport] ?? null;
    const trip = s.tripCountry && s.tripDate ? { country: s.tripCountry, date: s.tripDate } : null;
    const race = selected
      ? { title: selected.title, slug: selected.slug, date: selected.date, weeksAway: selected.date ? weeksUntil(selected.date) : null }
      : trip ? null : automatic;
    const targetWeeks = trip ? weeksUntil(new Date(`${trip.date}T12:00:00+02:00`)) : race?.weeksAway ?? null;
    return {
      sport: s.sport,
      targetEventId: s.targetEventId,
      trip,
      bucket: bucketForWeeks(targetWeeks),
      race: race ? { title: race.title, slug: race.slug, date: race.date?.toISOString() ?? null, weeksAway: race.weeksAway } : null,
      items: items.filter((it) => it.sport === s.sport),
    };
  });
  return sections.sort((a, b) => {
    const aDate = a.race?.date ?? a.trip?.date ?? null;
    const bDate = b.race?.date ?? b.trip?.date ?? null;
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return new Date(aDate).getTime() - new Date(bDate).getTime();
  });
}

export async function loadGearEventOptions() {
  const rows = await db.select({ id: events.id, title: events.title, sport: events.sport, date: events.startsAt, location: events.location })
    .from(events).where(or(gt(events.startsAt, new Date()), isNull(events.startsAt))).orderBy(asc(events.startsAt), asc(events.title));
  return rows.map((event) => ({ ...event, date: event.date?.toISOString() ?? null }));
}

export async function loadGearProfile(userId: string) {
  const [profile] = await db.select().from(gearProfiles).where(eq(gearProfiles.userId, userId)).limit(1);
  return {
    heightCm: profile?.heightCm ?? null,
    weightKg: profile?.weightKg ?? null,
    shoeSize: profile?.shoeSize ?? null,
    clothingSize: profile?.clothingSize ?? null,
  };
}
