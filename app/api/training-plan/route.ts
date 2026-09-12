import { NextResponse } from "next/server";
import { and, asc, eq, like } from "drizzle-orm";
import { db } from "@/db/client";
import { trainingBlocks, trainingDone, trainingProfiles } from "@/db/schema";
import type { TrainingPlan, TrainingWeek } from "@/db/schema";
import { auth } from "@/lib/auth";
import { addWeeks, computeZones, loadTargetRaces, weeksUntil, WEEKDAYS, WEEKS_PER_BLOCK } from "@/lib/training";

import { gymInstructions, readGymSplits } from "@/lib/gym-splits";
import { allowedDays, mondayFor, plusDays, tomorrowInAmsterdam } from "@/lib/training-dates";

// Bouwt een blok van 10 trainingsweken met Google Gemini, net als de
// event-import (app/api/import-event). "append" zet er 10 weken bij; "regenerate"
// vervangt een bestaand blok (en wist de afvink-status van dat blok).
export const dynamic = "force-dynamic";
// Een heel blok genereren duurt ~30s; geef de serverless-functie de ruimte.
export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Log eerst in." }, { status: 401 });
  }
  const userId = session.user.id;

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "De AI-coach is niet geconfigureerd (GEMINI_API_KEY ontbreekt)." },
      { status: 503 }
    );
  }
  // Flash-Lite is optimized for low-latency structured responses. Override with
  // GEMINI_MODEL when a project prefers a larger model over response time.
  const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

  let mode: "append" | "regenerate" = "append";
  let wantIndex: number | undefined;
  let adjust = "";
  try {
    const body = await req.json();
    if (body?.mode === "regenerate") mode = "regenerate";
    if (typeof body?.blockIndex === "number") wantIndex = body.blockIndex;
    if (typeof body?.adjust === "string") adjust = body.adjust.slice(0, 500).trim();
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }

  const [profile] = await db
    .select()
    .from(trainingProfiles)
    .where(eq(trainingProfiles.userId, userId));
  if (!profile) {
    return NextResponse.json({ error: "Vul eerst de vragenlijst in." }, { status: 400 });
  }

  const blocks = await db
    .select()
    .from(trainingBlocks)
    .where(eq(trainingBlocks.userId, userId))
    .orderBy(asc(trainingBlocks.blockIndex));

  // Bepaal welk blok we (her)bouwen: welke index, op welke maandag, welk
  // absoluut weeknummer. Bij regenerate hergebruiken we de bestaande rij.
  let blockId: string;
  let blockIndex: number;
  let startIso: string;
  let existingBlockId: string | null = null;

  if (mode === "regenerate") {
    const target = blocks.find((b) => b.blockIndex === wantIndex);
    if (!target) {
      return NextResponse.json({ error: "Dat blok bestaat niet." }, { status: 400 });
    }
    blockId = target.id;
    existingBlockId = target.id;
    blockIndex = target.blockIndex;
    startIso = target.startDate;
  } else {
    const last = blocks[blocks.length - 1];
    blockIndex = last ? last.blockIndex + 1 : 0;
    startIso = last ? addWeeks(last.startDate, WEEKS_PER_BLOCK) : mondayFor(tomorrowInAmsterdam());
    blockId = crypto.randomUUID();
  }

  const earliestDate = tomorrowInAmsterdam();
  if (mode === "append") {
    // A stale previous block must not cause new training sessions in the past.
    startIso = [startIso, mondayFor(earliestDate)].sort().at(-1)!;
  } else if (plusDays(startIso, WEEKS_PER_BLOCK * 7 - 1) < earliestDate) {
    return NextResponse.json({ error: "Dit blok ligt helemaal in het verleden. Bouw een nieuw blok om vanaf morgen verder te trainen." }, { status: 400 });
  }
  const startWeek = blockIndex * WEEKS_PER_BLOCK + 1;

  // Doelraces, met "weken tot de race" gerekend vanaf vandaag.
  const races = await loadTargetRaces(userId);
  const raceLines = races.length
    ? races
        .map((r) =>
          r.date
            ? `- ${r.title} op ${amsterdamDateKey(r.date)} (${weekdayForDate(amsterdamDateKey(r.date))})${r.role === "support" ? " (support, geen doelrace)" : ""} (over ~${weeksUntil(r.date)} weken)`
            : `- ${r.title} (nog geen datum)`
        )
        .join("\n")
    : "- (nog geen races gekozen — bouw een algemene opbouw richting het doel)";

  // Korte samenvatting van eerdere blokken, zodat de opbouw doorloopt.
  const others = blocks.filter((b) => b.id !== existingBlockId);
  const historyLines = others.length
    ? others
        .map((b) => {
          const w = (b.weeks as TrainingPlan)?.weeks ?? [];
          const from = w[0]?.week ?? b.blockIndex * WEEKS_PER_BLOCK + 1;
          const to = w[w.length - 1]?.week ?? from + WEEKS_PER_BLOCK - 1;
          return `- Week ${from}–${to}: ${(b.weeks as TrainingPlan)?.focus ?? "onbekend"}`;
        })
        .join("\n")
    : "- (dit is het eerste blok)";

  const zones = computeZones(profile);
  const zoneContext = zones
    ? `Hartslagzones voor hardlopen (${zones.method === "hrr" ? "hartslagreserve / Karvonen" : "% max-hartslag"}; max ${zones.maxHr} bpm${zones.estimatedMax ? ", geschat uit leeftijd" : ""}):\n` +
      zones.zones.map((z) => `- Z${z.zone} (${z.label}): ${z.low}–${z.high} bpm`).join("\n") +
      "\nGebruik bij looptrainingen alleen de labels Z1, Z2, Z3, Z4 of Z5 in title en detail. Schrijf geen bpm-waarden of hartslagbereiken in de trainingstekst; die staan in een apart overzicht.\n"
    : "Geen persoonlijke hartslagzones beschikbaar. Gebruik inspanning/gesprekstempo en verzin geen bpm-grenzen.\n";

  const sports = safeJsonArray(profile.sports);
  const longRunDays = safeJsonArray(profile.longRunDays);
  const recoveryMethods = safeJsonArray(profile.recoveryMethods);

  const gymRule = gymInstructions(profile.gymDays, readGymSplits(profile.gymSplits));

  const baseInstruction =
    `Je bent een ervaren hardloop- en krachttrainer die een trainingsschema maakt voor één sporter. ` +
    `Antwoord uitsluitend met de gevraagde JSON, in het Nederlands. ` +
    `Verdeel per week het aantal sessies dat de sporter aankan; leg lange/dubbele trainingen op de dagen waarop hij tijd heeft. ` +
    `Bouw geleidelijk op (progressieve overload), plan herstelweken en spits toe richting de dichtstbijzijnde race (taper de laatste 1–2 weken vóór een race). ` +
    `Gebruik de gekozen herstelmethoden als concrete, haalbare hersteladviezen in weeknotities of sessiedetails; plan ze niet allemaal elke week en presenteer ze als optionele ondersteuning. ` +
    `Events met "support, geen doelrace" zijn extra agenda-activiteiten: plan die dag gewoon de normale training; maak er geen vervangende support-training, taper of herstelweek van. ` +
    `Zet iedere doelrace op de exacte Amsterdamse kalenderdatum en weekdag die hieronder staat; verplaats hem niet naar een andere dag. ` +
    gymRule +
    `Gebruik "type": "run" (hardlopen), "gym" (kracht), "cross" (aanvullend zoals fietsen/zwemmen), "brick" (combitraining) of "rust". ` +
    `Geef elke week een korte, onderscheidende theme van 2–6 woorden die de trainingsfase samenvat; herhaal geen generieke titels en zet geen weeknummer in theme of note. ` +
    `Geef focus een concrete samenvatting van dit specifieke blok van ${WEEKS_PER_BLOCK} weken, bijvoorbeeld "Basis en techniek → racevoorbereiding"; gebruik geen algemene tekst zoals "algemeen fitter worden". ` +
    `"day" is een van: ma, di, wo, do, vr, za, zo. "duration" kort, bv. "45 min" of "12 km". ` +
    `"detail" beschrijft de uitvoering (tempo, hartslagzone, sets×reps). Houd het motiverend maar realistisch.`;

  const baseContext =
    `SPORTER\n` +
    `- Sporten: ${sports.join(", ") || "hardlopen"}\n` +
    `- Sessies per week: ${profile.sessionsPerWeek}\n` +
    `- Krachttraining: ${profile.gymDays > 0 ? `${profile.gymDays} dag(en) per week` : "geen"}\n` +
    `- Dagen voor lange/dubbele trainingen: ${longRunDays.join(", ") || "weekend"}\n` +
    `- Niveau/achtergrond: ${profile.experience || "onbekend"}\n` +
    `- Doel: ${profile.goal || "algemeen fitter en sterker worden"}\n\n` +
    `- Gewenste herstelmethoden: ${recoveryMethods.join(", ") || "geen specifieke voorkeur"}\n\n` +
    `${zoneContext}\n` +
    `DOELRACES\n${raceLines}\n\n` +
    `EERDERE BLOKKEN\n${historyLines}\n\n` +
    (adjust ? `BIJSTUREN (verwerk dit): ${adjust}\n\n` : "");

  const RESPONSE_SCHEMA = {
    type: "OBJECT",
    properties: {
      focus: { type: "STRING" },
      weeks: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            theme: { type: "STRING" },
            note: { type: "STRING" },
            sessions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  day: { type: "STRING", enum: ["ma", "di", "wo", "do", "vr", "za", "zo"] },
                  type: { type: "STRING", enum: ["run", "gym", "cross", "brick", "rust"] },
                  title: { type: "STRING" },
                  duration: { type: "STRING" },
                  detail: { type: "STRING" },
                  exercises: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        name: { type: "STRING" },
                        prescription: { type: "STRING" },
                      },
                      required: ["name", "prescription"],
                    },
                  },
                },
                required: ["day", "type", "title", "duration", "detail"],
              },
            },
          },
          required: ["theme", "note", "sessions"],
        },
      },
    },
    required: ["focus", "weeks"],
  };

  type RawWeek = Omit<TrainingWeek, "week" | "startDate" | "sessions"> & {
    sessions?: Array<{
      day: string; type: string; title: string; duration: string; detail: string;
      exercises?: Array<{ name?: string; prescription?: string }>;
    }>;
  };

  // Eén helft van 5 weken genereren. We knippen het blok van 10 weken in twee
  // parallelle calls: elk is korter en dus sneller (~30s), en samen blijven we
  // ruim onder de serverless-limiet — ook met 6 oefeningen per gym-sessie.
  async function generateHalf(fromWeek: number, count: number, phaseNote: string) {
    const instruction =
      baseInstruction +
      ` Je maakt nu precies ${count} weken: absolute week ${fromWeek} t/m ${fromWeek + count - 1} van het totale plan. ${phaseNote}`;
    const calendar = Array.from({ length: count }, (_, index) => {
      const week = fromWeek + index;
      const monday = addWeeks(startIso, week - startWeek);
      return `Week ${week}, maandag ${monday}: toegestane dagen ${allowedDays(monday, earliestDate).join(", ") || "geen (laat sessions leeg)"}.`;
    }).join("\n");
    const context = baseContext + `Maak nu week ${fromWeek} t/m ${fromWeek + count - 1}.\n` +
      `De eerste training mag pas op ${earliestDate} (morgen, Europe/Amsterdam). Plan niets daarvoor. ` +
      `Een gedeeltelijke week krijgt minder sessies: prop geen volledige trainingsweek in de resterende dagen.\n${calendar}`;
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: instruction }] },
          contents: [{ parts: [{ text: context }] }],
          generationConfig: {
            temperature: 0.5,
            // "low" scheelt enorm in latency zonder dat de plankwaliteit zakt.
            thinkingConfig: { thinkingLevel: "low" },
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
        signal: AbortSignal.timeout(55000),
      }
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`AI gaf een fout (${res.status}). ${detail.slice(0, 160)}`);
    }
    const payload = await res.json().catch(() => null);
    const text: string | undefined = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("Geen bruikbaar antwoord van de AI.");
    let parsed: { focus?: string; weeks?: RawWeek[] };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("AI-antwoord was geen geldige JSON.");
    }
    return { focus: parsed.focus ?? "", weeks: parsed.weeks ?? [] };
  }

  const firstCount = Math.ceil(WEEKS_PER_BLOCK / 2); // 5
  const secondCount = WEEKS_PER_BLOCK - firstCount; // 5
  let firstHalf: { focus: string; weeks: RawWeek[] };
  let secondHalf: { focus: string; weeks: RawWeek[] };
  try {
    [firstHalf, secondHalf] = await Promise.all([
      generateHalf(startWeek, firstCount, "Dit is de eerste helft van dit blok: leg de basis en bouw rustig op."),
      generateHalf(
        startWeek + firstCount,
        secondCount,
        "Dit is de tweede helft van dit blok: bouw voort op de basis uit de eerste helft, verhoog de belasting en spits toe richting de dichtstbijzijnde race."
      ),
    ]);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Kon de AI-coach niet bereiken." },
      { status: 502 }
    );
  }

  const rawWeeks: RawWeek[] = [...firstHalf.weeks, ...secondHalf.weeks];
  const focusText = firstHalf.focus || secondHalf.focus;

  // Weeknummers en datums bepalen wij deterministisch (niet de AI vertrouwen);
  // de AI levert alleen thema, notitie en sessies. Sessie-id's zijn stabiel.
  const weeks: TrainingWeek[] = rawWeeks.slice(0, WEEKS_PER_BLOCK).map((w, wi) => {
    const week = startWeek + wi;
    return {
      week,
      startDate: addWeeks(startIso, wi),
      theme: cleanWeekTheme(w.theme ?? "", week),
      note: cleanWeekNote(w.note ?? ""),
      sessions: (w.sessions ?? []).map((s, si) => {
        const type = (["run", "gym", "cross", "brick", "rust"].includes(s.type)
          ? s.type
          : "run") as TrainingWeek["sessions"][number]["type"];
        // Oefeningen alleen bewaren bij gym-sessies (max 6, lege eruit).
        const exercises =
          type === "gym"
            ? (s.exercises ?? [])
                .map((e) => ({ name: (e.name ?? "").trim(), prescription: (e.prescription ?? "").trim() }))
                .filter((e) => e.name)
                .slice(0, 6)
            : undefined;
        return {
          id: `${blockId}:${week}:${si}`,
          day: s.day,
          type,
          title: s.title ?? "",
          duration: s.duration ?? "",
          detail: s.detail ?? "",
          ...(exercises && exercises.length ? { exercises } : {}),
        };
      }).filter((session) => allowedDays(addWeeks(startIso, wi), earliestDate).includes(session.day)),
    };
  });

  // De AI kan een race nog steeds op de verkeerde dag zetten, vergeten of een
  // support-event als training invullen. Races zijn agenda-feiten, dus
  // corrigeer ze deterministisch op basis van de Amsterdamse datum.
  for (const race of races) {
    if (race.role !== "support") continue;
    const raceDate = race.date ? amsterdamDateKey(race.date) : null;
    if (!raceDate) continue;
    const week = weeks.find((candidate) => raceDate >= candidate.startDate && raceDate <= plusDays(candidate.startDate, 6));
    if (!week) continue;
    const tokens = race.title.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 4);
    week.sessions = week.sessions.filter((session) => {
      const text = `${session.title} ${session.detail}`.toLowerCase();
      return !tokens.some((token) => text.includes(token)) && !/support/.test(text);
    });
    if (!week.sessions.some((session) => session.day === weekdayForDate(raceDate))) {
      week.sessions.push({
        id: `${blockId}:${week.week}:support-${race.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        day: weekdayForDate(raceDate),
        type: "cross",
        title: "Lichte vrije training",
        duration: "30 min",
        detail: "Normale trainingsdag: kies een lichte training of neem rust als je lichaam dat nodig heeft.",
      });
    }
    const supportTokens = race.title.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 4);
    for (const candidate of weeks) {
      const text = `${candidate.theme} ${candidate.note}`.toLowerCase();
      if (supportTokens.some((token) => text.includes(token)) || /support/.test(text)) {
        candidate.theme = candidate.theme
          .replace(new RegExp(`(?:herstel na )?(?:race )?(?:en )?${supportTokens.join("|")}`, "ig"), "")
          .replace(/\s+(en|&)\s*$/i, "")
          .trim();
        if (!candidate.theme) candidate.theme = "Opbouw en herstel";
      }
    }
  }

  for (const race of races) {
    if (race.role === "support" || !race.date) continue;
    const raceDate = amsterdamDateKey(race.date);
    const week = weeks.find((candidate) => raceDate >= candidate.startDate && raceDate <= plusDays(candidate.startDate, 6));
    if (!week) continue;
    const raceDay = weekdayForDate(raceDate);
    // Het doelrace-label hoort bij dezelfde kalenderweek als de race, niet bij
    // de week die de AI toevallig in de thematekst noemt.
    for (const candidate of weeks) {
      if (candidate !== week && /doelrace|race week|racedag/i.test(candidate.theme)) {
        candidate.theme = "";
      }
    }
    week.theme = `Doelrace week: ${race.title}`;
    // Een echte racedag is leidend: haal andere zware sessies van die dag weg
    // zodat er geen lange duurloop + gym + race tegelijk wordt gepland.
    week.sessions = week.sessions.filter((session) => session.day !== raceDay);
    week.sessions.push({
      id: `${blockId}:${week.week}:race-${race.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      day: raceDay,
      type: "run",
      title: `${race.title} — race`,
      duration: "",
      detail: "Racedag. Stem je inspanning af op het evenement en geniet ervan.",
    });
  }

  if (weeks.length === 0) {
    return NextResponse.json({ error: "De AI leverde geen weken op. Probeer opnieuw." }, { status: 502 });
  }

  const plan: TrainingPlan = { focus: focusText, weeks };

  if (mode === "regenerate") {
    // Oude afvink-status van dit blok wissen: de sessie-id's veranderen.
    await db.delete(trainingDone).where(
      and(eq(trainingDone.userId, userId), like(trainingDone.sessionId, `${blockId}:%`))
    );
    await db
      .update(trainingBlocks)
      .set({ weeks: plan, updatedAt: new Date() })
      .where(eq(trainingBlocks.id, blockId));
  } else {
    await db.insert(trainingBlocks).values({
      id: blockId,
      userId,
      blockIndex,
      startDate: startIso,
      weeks: plan,
    });
  }

  return NextResponse.json({ ok: true, blockIndex });
}

function amsterdamDateKey(date: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(date);
}

function cleanWeekNote(note: string): string {
  return note.replace(/^week\s+\d+\s*:\s*/i, "");
}

function cleanWeekTheme(theme: string, week: number): string {
  const cleaned = theme
    .replace(/^week\s+\d+\s*[:\-]\s*/i, "")
    .replace(/\s+week\s+\d+\s*$/i, "")
    .trim();
  if (!/^(basis opbouwen|opbouw)$/i.test(cleaned)) return cleaned;
  const variants = [
    "Aerobe basis en techniek",
    "Duurvermogen en ritme",
    "Kracht en stabiliteit",
    "Tempo en efficiëntie",
    "Belasting opbouwen",
    "Herstel en consolidatie",
    "Krachtuithoudingsvermogen",
    "Piek in volume",
    "Lichte deload",
    "Racevoorbereiding",
  ];
  return variants[(week - 1) % variants.length];
}

function weekdayForDate(iso: string): (typeof WEEKDAYS)[number] {
  const day = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return WEEKDAYS[(day + 6) % 7];
}

function safeJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
