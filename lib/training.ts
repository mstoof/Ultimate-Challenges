import { and, asc, eq, gt } from "drizzle-orm";
import { db } from "@/db/client";
import { events, rsvps, trainingProfiles } from "@/db/schema";

export const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"] as const;
export const WEEKS_PER_BLOCK = 10;

/** Een doelrace zoals het plan hem gebruikt: naam + datum (of null voor "ooit"). */
export type TargetRace = { title: string; date: Date | null; source: "rsvp" | "manual" };

/**
 * De races waar dit lid naartoe traint: alle toekomstige events waarvoor het
 * zich als runner heeft aangemeld, plus een eventueel handmatig ingevulde race
 * uit de vragenlijst. Op datum, dichtstbijzijnde eerst; datumloze races achteraan.
 */
export async function loadTargetRaces(userId: string): Promise<TargetRace[]> {
  const now = new Date();
  const signedUp = await db
    .select({ title: events.title, date: events.startsAt })
    .from(rsvps)
    .innerJoin(events, eq(events.id, rsvps.eventId))
    .where(and(eq(rsvps.userId, userId), eq(rsvps.role, "run"), gt(events.startsAt, now)))
    .orderBy(asc(events.startsAt));

  const races: TargetRace[] = signedUp.map((r) => ({
    title: r.title,
    date: r.date,
    source: "rsvp" as const,
  }));

  const [profile] = await db
    .select({ targetRace: trainingProfiles.targetRace, targetRaceDate: trainingProfiles.targetRaceDate })
    .from(trainingProfiles)
    .where(eq(trainingProfiles.userId, userId));

  if (profile?.targetRace) {
    // date-kolom komt als "YYYY-MM-DD" binnen; midden op de dag zetten voorkomt
    // dat een tijdzone hem naar de dag ervoor schuift.
    const date = profile.targetRaceDate ? new Date(`${profile.targetRaceDate}T12:00:00`) : null;
    races.push({ title: profile.targetRace, date, source: "manual" });
  }

  return races.sort((a, b) => {
    if (!a.date) return 1;
    if (!b.date) return -1;
    return a.date.getTime() - b.date.getTime();
  });
}

/* ------------------------------ hartslagzones --------------------------- */

export type HrZone = { zone: number; label: string; low: number; high: number };
export type ZoneResult = {
  zones: HrZone[];
  maxHr: number; // gebruikte max-HR (opgegeven of geschat)
  restHr: number | null; // gebruikte rust-HR (null = %max-methode)
  method: "hrr" | "max"; // Karvonen (hartslagreserve) of % van max-HR
  estimatedMax: boolean; // max-HR uit leeftijd geschat i.p.v. opgegeven
};

// De vijf zones met hun onder-/bovengrens als percentage. Bij een opgegeven
// rust-HR rekenen we over de hartslagreserve (Karvonen), anders over de max-HR.
const ZONE_DEFS = [
  { zone: 1, label: "Herstel", low: 50, high: 60 },
  { zone: 2, label: "Duurvermogen", low: 60, high: 70 },
  { zone: 3, label: "Tempo", low: 70, high: 80 },
  { zone: 4, label: "Drempel", low: 80, high: 90 },
  { zone: 5, label: "VO₂max", low: 90, high: 100 },
];

/** Tanaka-schatting van de max-hartslag uit leeftijd. */
export function estimateMaxHr(age: number): number {
  return Math.round(208 - 0.7 * age);
}

/**
 * Bereken de vijf hartslagzones uit de profielgegevens. Geeft null terug als
 * er te weinig info is (geen max-HR én geen leeftijd).
 */
export function computeZones(input: {
  age?: number | null;
  maxHr?: number | null;
  restHr?: number | null;
}): ZoneResult | null {
  const explicitMax = input.maxHr && input.maxHr > 0 ? input.maxHr : null;
  const maxHr = explicitMax ?? (input.age && input.age > 0 ? estimateMaxHr(input.age) : null);
  if (!maxHr) return null;

  const restHr = input.restHr && input.restHr > 0 ? input.restHr : null;
  const method: "hrr" | "max" = restHr ? "hrr" : "max";
  const base = restHr ?? 0;
  const span = maxHr - base; // hartslagreserve, of gewoon max-HR

  const zones: HrZone[] = ZONE_DEFS.map((z) => ({
    zone: z.zone,
    label: z.label,
    low: Math.round(base + (span * z.low) / 100),
    high: Math.round(base + (span * z.high) / 100),
  }));

  return { zones, maxHr, restHr, method, estimatedMax: !explicitMax };
}

/** Aantal hele weken tussen nu en de racedatum (min. 0). */
export function weeksUntil(date: Date): number {
  return Math.max(0, Math.round((date.getTime() - Date.now()) / (7 * 86400000)));
}

/** De maandag van de week waarin `date` valt, als "YYYY-MM-DD". */
export function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // ma=0 … zo=6
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

/** `iso` (YYYY-MM-DD) plus `weeks` weken, als "YYYY-MM-DD". */
export function addWeeks(iso: string, weeks: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}
