import { compactRunText } from "@/lib/plan-display";
import type { TrainingBlock, TrainingSession } from "@/db/schema";

export type RichText = { type: "text"; text: { content: string } };
export function richText(value: string): RichText[] {
  // Notion allows 2,000 characters per rich-text fragment, max 100 fragments.
  if (value.length > 190000) throw new Error("Een training bevat te veel tekst voor Notion.");
  const result: RichText[] = [];
  for (let offset = 0; offset < value.length; offset += 1900) {
    result.push({ type: "text", text: { content: value.slice(offset, offset + 1900) } });
  }
  return result;
}

export const NOTION_PROPERTIES = {
  Training: { title: {} },
  Datum: { date: {} },
  Sport: { select: {} },
  Week: { number: {} },
  Duur: { rich_text: {} },
  Instructies: { rich_text: {} },
  Oefeningen: { rich_text: {} },
  Weeknotitie: { rich_text: {} },
  Klaar: { checkbox: {} },
  Actueel: { checkbox: {} },
  "Sessie-ID": { rich_text: {} },
};

const SPORTS: Record<TrainingSession["type"], string> = {
  run: "Hardlopen", gym: "Kracht", cross: "Cross", brick: "Brick", rust: "Rust",
};

export function sessionDate(monday: string, day: string): string {
  const offset = ["ma", "di", "wo", "do", "vr", "za", "zo"].indexOf(day);
  const date = new Date(`${monday}T12:00:00Z`);
  if (offset < 0 || !Number.isFinite(date.getTime())) {
    throw new Error("Een training heeft een ongeldige datum of weekdag. Genereer dat blok opnieuw.");
  }
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export type ExportTask = {
  sessionId: string;
  properties: Record<string, unknown>;
  done?: boolean;
  stale?: boolean;
};
export type ExportJob = { tasks: ExportTask[]; cursor: number; startedAt: string };

export function planTasks(blocks: TrainingBlock[], doneIds: string[], previousIds: string[]): ExportTask[] {
  const done = new Set(doneIds);
  const tasks: ExportTask[] = blocks.flatMap((block) => block.weeks.weeks.flatMap((week) =>
    week.sessions.map((session) => ({
      sessionId: session.id,
      done: done.has(session.id),
      properties: {
        Training: { title: richText(session.type === "run" || session.type === "brick" ? compactRunText(session.title || "Training") : session.title || "Training") },
        Datum: { date: { start: sessionDate(week.startDate, session.day) } },
        Sport: { select: { name: SPORTS[session.type] || "Hardlopen" } },
        Week: { number: week.week },
        Duur: { rich_text: richText(session.duration || "") },
        Instructies: { rich_text: richText(session.type === "run" || session.type === "brick" ? compactRunText(session.detail || "") : session.detail || "") },
        Oefeningen: { rich_text: richText((session.exercises ?? []).map((ex) => `${ex.name}: ${ex.prescription}`).join("\n")) },
        Weeknotitie: { rich_text: richText([block.weeks.focus, week.theme, week.note].filter(Boolean).join("\n")) },
        Actueel: { checkbox: true },
        "Sessie-ID": { rich_text: richText(session.id) },
      },
    }))
  ));
  const current = new Set(tasks.map((task) => task.sessionId));
  for (const sessionId of previousIds) {
    if (!current.has(sessionId)) tasks.push({ sessionId, stale: true, properties: { Actueel: { checkbox: false } } });
  }
  return tasks;
}
