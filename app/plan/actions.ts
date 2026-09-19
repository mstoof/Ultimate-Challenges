"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { trainingProfiles, trainingDone } from "@/db/schema";
import { auth } from "@/lib/auth";
import { normalizeGymSplits } from "@/lib/gym-splits";
import { WEEKDAYS } from "@/lib/training";

/** De vragenlijst opslaan (upsert: één profiel per lid). */
export async function saveProfile(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/plan");
  const userId = session.user.id;

  // Meerdere sporten en dagen komen als losse velden met dezelfde naam binnen.
  const sports = formData.getAll("sports").map(String).filter(Boolean);
  const longRunDays = formData
    .getAll("longRunDays")
    .map(String)
    .filter((d) => WEEKDAYS.includes(d as (typeof WEEKDAYS)[number]));

  const sessionsPerWeek = clampInt(formData.get("sessionsPerWeek"), 1, 14, 4);
  const gymDays = clampInt(formData.get("gymDays"), 0, 7, 0);
  const experience = String(formData.get("experience") ?? "").trim() || null;
  const recoveryMethods = formData.getAll("recoveryMethods").map(String).filter(Boolean);
  const goal = String(formData.get("goal") ?? "").trim() || null;
  // Voor de hartslagzones. Leeg of onzinnig → null (dan valt de berekening terug
  // op een schatting uit leeftijd, of laat de zones weg).
  const age = optInt(formData.get("age"), 10, 100);
  const maxHr = optInt(formData.get("maxHr"), 120, 230);
  const restHr = optInt(formData.get("restHr"), 30, 110);
  const targetRace = String(formData.get("targetRace") ?? "").trim() || null;
  const targetRaceRaw = String(formData.get("targetRaceDate") ?? "").trim();
  const targetRaceDate = targetRaceRaw || null; // date-kolom accepteert "YYYY-MM-DD"

  const values = {
    userId,
    sports: JSON.stringify(sports),
    longRunDays: JSON.stringify(longRunDays),
    sessionsPerWeek,
    gymDays,
    gymSplits: JSON.stringify(gymDays > 0 ? normalizeGymSplits(formData.getAll("gymSplits")) : []),
    experience,
    recoveryMethods: JSON.stringify(recoveryMethods),
    goal,
    age,
    maxHr,
    restHr,
    targetRace,
    targetRaceDate,
    updatedAt: new Date(),
  };

  await db
    .insert(trainingProfiles)
    .values(values)
    .onConflictDoUpdate({ target: trainingProfiles.userId, set: values });

  redirect("/plan");
}

/** Een sessie afvinken of het vinkje weer weghalen (toggle, net als een rsvp). */
export async function toggleDone(sessionId: string) {
  const session = await auth();
  if (!session?.user?.id) return;
  const userId = session.user.id;

  const existing = await db
    .select({ sessionId: trainingDone.sessionId })
    .from(trainingDone)
    .where(and(eq(trainingDone.userId, userId), eq(trainingDone.sessionId, sessionId)));

  if (existing.length) {
    await db
      .delete(trainingDone)
      .where(and(eq(trainingDone.userId, userId), eq(trainingDone.sessionId, sessionId)));
  } else {
    await db.insert(trainingDone).values({ userId, sessionId }).onConflictDoNothing();
  }

  revalidatePath("/plan");
}

/** Helemaal opnieuw beginnen: blokken, afvinkstatus én profiel weg. Zonder
 *  profiel toont /plan weer de vragenlijst. */
export async function resetPlan() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/plan");
  const userId = session.user.id;
  await db.execute(sql`delete from training_blocks where user_id = ${userId}`);
  await db.execute(sql`delete from training_done where user_id = ${userId}`);
  await db.delete(trainingProfiles).where(eq(trainingProfiles.userId, userId));
  redirect("/plan");
}

function clampInt(raw: FormDataEntryValue | null, min: number, max: number, fallback: number) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Optioneel geheel getal binnen bereik; buiten bereik of leeg → null. */
function optInt(raw: FormDataEntryValue | null, min: number, max: number): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Math.round(Number(s));
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

/** Update only gym preferences; keep the plan and completion history intact. */
export async function saveGymPreferences(_previous: { message: string } | null, formData: FormData): Promise<{ message: string }> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/plan");
  const gymDays = clampInt(formData.get("gymDays"), 0, 7, 0);
  const gymSplits = gymDays > 0 ? normalizeGymSplits(formData.getAll("gymSplits")) : [];
  const updated = await db.update(trainingProfiles).set({ gymDays, gymSplits: JSON.stringify(gymSplits), updatedAt: new Date() })
    .where(eq(trainingProfiles.userId, session.user.id)).returning({ userId: trainingProfiles.userId });
  if (!updated.length) return { message: "Vul eerst de vragenlijst in." };
  revalidatePath("/plan");
  return { message: "Opgeslagen. Genereer een blok opnieuw of bouw een nieuw blok om je voorkeuren te gebruiken." };
}
