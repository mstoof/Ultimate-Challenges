"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events, gearSports, gearItems, gearProfiles } from "@/db/schema";
import { auth } from "@/lib/auth";
import { GEAR_TAGS, sharedKeyForName } from "@/lib/gear-shared";

type GearTag = keyof typeof GEAR_TAGS;
const TAG_CODES = Object.keys(GEAR_TAGS) as GearTag[];

async function requireUser(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/gear");
  return session.user.id;
}

/** Een sport toevoegen om uitrusting voor bij te houden (idempotent). */
export async function addGearSport(sportRaw: string) {
  const userId = await requireUser();
  const sport = String(sportRaw ?? "").trim().slice(0, 60);
  if (!sport) return;

  // Achteraan zetten: hoogste bestaande sortOrder + 1.
  const [last] = await db
    .select({ sortOrder: gearSports.sortOrder })
    .from(gearSports)
    .where(eq(gearSports.userId, userId))
    .orderBy(desc(gearSports.sortOrder))
    .limit(1);
  const sortOrder = (last?.sortOrder ?? -1) + 1;

  await db
    .insert(gearSports)
    .values({ userId, sport, sortOrder })
    .onConflictDoNothing();
  revalidatePath("/gear");
}

/** Voeg vanuit een komend event meteen de juiste sport toe en selecteer dat event als doel. */
export async function addGearSportForEvent(eventIdRaw: string) {
  const userId = await requireUser();
  const eventId = String(eventIdRaw ?? "").trim();
  const [event] = await db.select({ id: events.id, sport: events.sport }).from(events).where(eq(events.id, eventId)).limit(1);
  if (!event) return;
  const [last] = await db.select({ sortOrder: gearSports.sortOrder }).from(gearSports)
    .where(eq(gearSports.userId, userId)).orderBy(desc(gearSports.sortOrder)).limit(1);
  await db.insert(gearSports).values({ userId, sport: event.sport, targetEventId: event.id, sortOrder: (last?.sortOrder ?? -1) + 1 })
    .onConflictDoUpdate({ target: [gearSports.userId, gearSports.sport], set: { targetEventId: event.id, tripCountry: null, tripDate: null } });
  revalidatePath("/gear");
}

/** Een sport én al zijn items verwijderen. */
export async function removeGearSport(sportRaw: string) {
  const userId = await requireUser();
  const sport = String(sportRaw ?? "").trim();
  if (!sport) return;
  await db.delete(gearItems).where(and(eq(gearItems.userId, userId), eq(gearItems.sport, sport)));
  await db.delete(gearSports).where(and(eq(gearSports.userId, userId), eq(gearSports.sport, sport)));
  revalidatePath("/gear");
}

/** Afvinken / vinkje weghalen (heb ik / nog kopen). Owner-scoped. */
export async function toggleHave(itemId: string) {
  const userId = await requireUser();
  const [item] = await db
    .select({ have: gearItems.have, sharedKey: gearItems.sharedKey })
    .from(gearItems)
    .where(and(eq(gearItems.userId, userId), eq(gearItems.id, itemId)));
  if (!item) return;
  const target = item.sharedKey
    ? and(eq(gearItems.userId, userId), eq(gearItems.sharedKey, item.sharedKey))
    : and(eq(gearItems.userId, userId), eq(gearItems.id, itemId));
  await db.update(gearItems).set({ have: !item.have }).where(target);
  revalidatePath("/gear");
}

/** Handmatige prijs invullen; leeg → terug naar de AI-schatting (null). */
export async function setPrice(itemId: string, valueRaw: string | number | null) {
  const userId = await requireUser();
  const s = String(valueRaw ?? "").trim();
  let price: number | null = null;
  if (s !== "") {
    const n = Math.round(Number(s));
    price = Number.isFinite(n) && n >= 0 ? Math.min(n, 100000) : null;
  }
  const [item] = await db.select({ sharedKey: gearItems.sharedKey }).from(gearItems)
    .where(and(eq(gearItems.userId, userId), eq(gearItems.id, itemId))).limit(1);
  if (!item) return;
  const target = item.sharedKey
    ? and(eq(gearItems.userId, userId), eq(gearItems.sharedKey, item.sharedKey))
    : and(eq(gearItems.userId, userId), eq(gearItems.id, itemId));
  await db.update(gearItems).set({ price }).where(target);
  revalidatePath("/gear");
}

/** Zelf een item toevoegen aan een sport. */
export async function addManualItem(
  sportRaw: string,
  input: { name: string; description?: string; tags?: string[]; price?: number; productUrl?: string }
) {
  const userId = await requireUser();
  const sport = String(sportRaw ?? "").trim();
  const name = String(input?.name ?? "").trim().slice(0, 120);
  if (!sport || !name) return;

  const description = String(input?.description ?? "").trim().slice(0, 400) || null;
  const tags = (Array.isArray(input?.tags) ? input.tags : [])
    .map(String)
    .filter((code): code is GearTag => TAG_CODES.includes(code as GearTag));
  const estPrice = Number.isFinite(input?.price) ? Math.max(0, Math.round(input!.price!)) : 0;
  const productUrlRaw = String(input?.productUrl ?? "").trim();
  const productUrl = /^https?:\/\//i.test(productUrlRaw) ? productUrlRaw.slice(0, 2000) : null;

  const [last] = await db
    .select({ sortOrder: gearItems.sortOrder })
    .from(gearItems)
    .where(and(eq(gearItems.userId, userId), eq(gearItems.sport, sport)))
    .orderBy(desc(gearItems.sortOrder))
    .limit(1);
  const sortOrder = (last?.sortOrder ?? -1) + 1;

  await db.insert(gearItems).values({
    userId,
    sport,
    name,
    description,
    tags: JSON.stringify(tags),
    searchQuery: name,
    productUrl,
    estPrice,
    aiGenerated: false,
    sharedKey: sharedKeyForName(name),
    sortOrder,
  });
  revalidatePath("/gear");
}

/** Eén item verwijderen. */
export async function removeItem(itemId: string) {
  const userId = await requireUser();
  await db.delete(gearItems).where(and(eq(gearItems.userId, userId), eq(gearItems.id, itemId)));
  revalidatePath("/gear");
}

export async function saveGearProfile(input: {
  heightCm?: string; weightKg?: string; shoeSize?: string; clothingSize?: string;
}) {
  const userId = await requireUser();
  const numberOrNull = (value: string | undefined, min: number, max: number) => {
    const number = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(number) && number >= min && number <= max ? Math.round(number) : null;
  };
  const values = {
    heightCm: numberOrNull(input.heightCm, 100, 250),
    weightKg: numberOrNull(input.weightKg, 30, 300),
    shoeSize: String(input.shoeSize ?? "").trim().slice(0, 12) || null,
    clothingSize: String(input.clothingSize ?? "").trim().slice(0, 20) || null,
    updatedAt: new Date(),
  };
  await db.insert(gearProfiles).values({ userId, ...values }).onConflictDoUpdate({
    target: gearProfiles.userId,
    set: values,
  });
  revalidatePath("/gear");
}

export async function chooseGearOption(itemId: string, optionIndex: number) {
  const userId = await requireUser();
  const [item] = await db.select({ options: gearItems.options }).from(gearItems)
    .where(and(eq(gearItems.userId, userId), eq(gearItems.id, itemId))).limit(1);
  if (!item?.options || !Number.isInteger(optionIndex) || !item.options[optionIndex]) return;
  await db.update(gearItems).set({ chosenOption: optionIndex, price: null })
    .where(and(eq(gearItems.userId, userId), eq(gearItems.id, itemId)));
  revalidatePath("/gear");
}

export async function selectGearEvent(sportRaw: string, eventIdRaw: string) {
  const userId = await requireUser();
  const sport = String(sportRaw ?? "").trim();
  const eventId = String(eventIdRaw ?? "").trim() || null;
  if (!sport) return;
  if (eventId) {
    const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1);
    if (!event) return;
  }
  await db.update(gearSports).set({ targetEventId: eventId, tripCountry: null, tripDate: null })
    .where(and(eq(gearSports.userId, userId), eq(gearSports.sport, sport)));
  revalidatePath("/gear");
}

export async function saveGearTrip(sportRaw: string, countryRaw: string, dateRaw: string) {
  const userId = await requireUser();
  const sport = String(sportRaw ?? "").trim();
  const country = String(countryRaw ?? "").trim().slice(0, 80);
  const tripDate = String(dateRaw ?? "").trim();
  if (!sport || !country || !/^\d{4}-\d{2}-\d{2}$/.test(tripDate)) return;
  await db.update(gearSports).set({ targetEventId: null, tripCountry: country, tripDate })
    .where(and(eq(gearSports.userId, userId), eq(gearSports.sport, sport)));
  revalidatePath("/gear");
}
