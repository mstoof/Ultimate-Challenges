import type { GearItem, GearOption } from "@/db/schema";

export type { GearOption } from "@/db/schema";

/**
 * Client-veilige gear-helpers en -types: géén DB-imports, zodat client
 * components (GearView) hieruit kunnen importeren zonder db/client mee te
 * slepen naar de browserbundle. De DB-functies staan in lib/gear.ts.
 */

/**
 * De tags op een item, met de klasse/label die de UI toont. Zelfde codes als
 * de prototype-legenda: tweedehands kan / nieuw kopen / keuze / optioneel.
 */
export const GEAR_TAGS = {
  tw: { label: "tweedehands", cls: "tw" },
  no: { label: "nieuw kopen", cls: "no" },
  ch: { label: "keuze maken", cls: "ch" },
  op: { label: "optioneel", cls: "op" },
} as const;
export type GearTag = keyof typeof GEAR_TAGS;
const TAG_CODES = Object.keys(GEAR_TAGS) as GearTag[];

/** Deadline-emmers, afgeleid uit de dichtstbijzijnde race in die sport. */
export type GearBucket = "now" | "soon" | "later";
/** Grenzen in weken: pas hier aan hoe streng "binnenkort/dit seizoen" is. */
export const BUCKET_WEEKS = { now: 8, soon: 26 } as const;

export function bucketForWeeks(weeksAway: number | null): GearBucket {
  if (weeksAway === null) return "later";
  if (weeksAway <= BUCKET_WEEKS.now) return "now";
  if (weeksAway <= BUCKET_WEEKS.soon) return "soon";
  return "later";
}

/** De gekozen optie van een item, of null als er geen (geldige) keuze is. */
export function chosenOptionOf(
  item: Pick<GearItem, "options" | "chosenOption">
): GearOption | null {
  const idx = item.chosenOption;
  if (idx === null || idx === undefined) return null;
  return item.options?.[idx] ?? null;
}

/**
 * De effectieve prijs, in volgorde van voorrang: handmatige prijs → prijs van de
 * gekozen productoptie → basis-schatting (estPrice).
 */
export function effectivePrice(
  item: Pick<GearItem, "price" | "estPrice" | "options" | "chosenOption">
): number {
  if (item.price !== null && item.price !== undefined) return item.price;
  const chosen = chosenOptionOf(item);
  if (chosen && Number.isFinite(chosen.price)) return chosen.price;
  return item.estPrice ?? 0;
}

/** De tags van een item als gevalideerde code-array (onbekende codes eruit). */
export function safeTags(value: string | null | undefined): GearTag[] {
  try {
    const parsed = JSON.parse(value || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String).filter((code): code is GearTag => TAG_CODES.includes(code as GearTag));
  } catch {
    return [];
  }
}

/** Herkent veelvoorkomende gear die daadwerkelijk tussen sporten gedeeld kan worden. */
export function sharedKeyForName(name: string, query = ""): string | null {
  const value = `${name} ${query}`.toLowerCase();
  if (/(fiets.*(gps|computer)|gps.*fiets|bike computer|garmin edge|wahoo elemnt)/.test(value)) return "bike-gps";
  return null;
}

/** Eén sport zoals de gear-pagina hem toont: items + de afgeleide deadline. */
export type GearSectionView = {
  sport: string;
  targetEventId: string | null;
  trip: { country: string; date: string } | null;
  bucket: GearBucket;
  race: { title: string; slug: string; date: string | null; weeksAway: number | null } | null;
  items: GearItem[];
};

export type GearProfileView = {
  heightCm: number | null;
  weightKg: number | null;
  shoeSize: string | null;
  clothingSize: string | null;
};

export type GearEventOption = {
  id: string;
  title: string;
  sport: string;
  date: string | null;
  location: string;
};
