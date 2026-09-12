import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { trainingBlocks, trainingDone, trainingProfiles } from "@/db/schema";
import type { TrainingBlock } from "@/db/schema";
import { auth } from "@/lib/auth";
import { computeZones, loadTargetRaces, weeksUntil } from "@/lib/training";
import Questionnaire from "./Questionnaire";
import PlanView from "./PlanView";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const session = await auth();
  if (!session?.user?.id) {
    // Middleware vangt dit normaal al af; dit is de vangnet-route.
    return (
      <main className="form">
        <p>Log in om je plan te zien.</p>
      </main>
    );
  }
  const userId = session.user.id;

  const [profile] = await db
    .select()
    .from(trainingProfiles)
    .where(eq(trainingProfiles.userId, userId));

  const races = await loadTargetRaces(userId);

  // Nog geen vragenlijst ingevuld: toon die eerst.
  if (!profile) {
    return (
      <main className="form">
        <Link href="/" className="form__back">
          ← Terug naar de agenda
        </Link>
        <Questionnaire races={races.map(raceHint)} />
      </main>
    );
  }

  const blocks: TrainingBlock[] = await db
    .select()
    .from(trainingBlocks)
    .where(eq(trainingBlocks.userId, userId))
    .orderBy(asc(trainingBlocks.blockIndex));

  const done = await db
    .select({ sessionId: trainingDone.sessionId })
    .from(trainingDone)
    .where(eq(trainingDone.userId, userId));

  const aiEnabled = Boolean(process.env.GEMINI_API_KEY);
  const zones = computeZones({ age: profile.age, maxHr: profile.maxHr, restHr: profile.restHr });

  return (
    <PlanView
      profile={{
        sports: safeArr(profile.sports),
        goal: profile.goal,
        gymDays: profile.gymDays,
        sessionsPerWeek: profile.sessionsPerWeek,
      }}
      blocks={blocks}
      doneIds={done.map((d) => d.sessionId)}
      races={races.map(raceHint)}
      zones={zones}
      aiEnabled={aiEnabled}
    />
  );
}

function raceHint(r: { title: string; date: Date | null }) {
  return {
    title: r.title,
    date: r.date ? r.date.toISOString() : null,
    weeksAway: r.date ? weeksUntil(r.date) : null,
  };
}

function safeArr(value: string): string[] {
  try {
    const p = JSON.parse(value);
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}
