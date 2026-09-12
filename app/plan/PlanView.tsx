"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TrainingBlock, TrainingPlan, TrainingSession } from "@/db/schema";
import type { ZoneResult } from "@/lib/training";
import GymPreferences from "./GymPreferences";
import NotionExport from "./NotionExport";
import { plusDays } from "@/lib/training-dates";
import { compactRunText } from "@/lib/plan-display";
import { toggleDone, resetPlan } from "./actions";

type RaceHint = { title: string; date: string | null; weeksAway: number | null };
type ProfileSummary = { sports: string[]; goal: string | null; gymDays: number; gymSplits: string[]; sessionsPerWeek: number };

const DAY_LABEL: Record<string, string> = {
  ma: "ma", di: "di", wo: "wo", do: "do", vr: "vr", za: "za", zo: "zo",
};
const TYPE_META: Record<TrainingSession["type"], { icon: string; label: string }> = {
  run: { icon: "🏃", label: "Hardlopen" },
  gym: { icon: "🏋️", label: "Kracht" },
  cross: { icon: "🚴", label: "Cross" },
  brick: { icon: "🧱", label: "Brick" },
  rust: { icon: "😌", label: "Rust" },
};

const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
function shortDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
// Weekdagen op volgorde ma→zo binnen een week.
const DAY_ORDER = ["ma", "di", "wo", "do", "vr", "za", "zo"];

export default function PlanView({
  profile,
  blocks,
  doneIds,
  races,
  aiEnabled,
  zones,
  currentWeekStart,
}: {
  profile: ProfileSummary;
  blocks: TrainingBlock[];
  doneIds: string[];
  races: RaceHint[];
  aiEnabled: boolean;
  zones: ZoneResult | null;
  currentWeekStart: string;
}) {
  const router = useRouter();
  const [done, setDone] = useState<Set<string>>(new Set(doneIds));
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenFor, setRegenFor] = useState<number | null>(null);
  const [adjust, setAdjust] = useState("");

  const target = races.find((r) => r.date) ?? races[0] ?? null;

  function toggle(id: string) {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    startTransition(() => {
      void toggleDone(id);
    });
  }

  async function build(mode: "append" | "regenerate", blockIndex?: number) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/training-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, blockIndex, adjust: mode === "regenerate" ? adjust : undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Bouwen mislukte (${res.status}).`);
      setRegenFor(null);
      setAdjust("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }

  const nextBlockNumber = blocks.length * 10 + 1;

  return (
    <main className="plan">
      <header className="plan__mast">
        <Link href="/" className="form__back">
          ← Agenda
        </Link>
        <form action={resetPlan}>
          <button type="submit" className="plan__reset" title="Vragenlijst opnieuw invullen">
            Opnieuw beginnen
          </button>
        </form>
      </header>

      <h1>Jouw trainingsplan</h1>
      {target ? (
        <p className="plan__target">
          Op weg naar <strong>{target.title}</strong>
          {target.weeksAway != null && ` · over ${target.weeksAway} weken`}
        </p>
      ) : (
        <p className="plan__target plan__target--none">
          Nog geen doelrace. Meld je aan voor een <Link href="/" className="plan__link">event</Link> of
          vul er één in via &ldquo;Opnieuw beginnen&rdquo;.
        </p>
      )}
      {profile.goal && <p className="plan__goal">🎯 {profile.goal}</p>}

      <div className="plan__tools">
        <HeartRateZones zones={zones} />
        <NotionExport hasPlan={blocks.length > 0} />
        <GymPreferences gymDays={profile.gymDays} gymSplits={profile.gymSplits} />
      </div>

      {!aiEnabled && (
        <p className="form__error">
          De AI-coach is niet geconfigureerd (GEMINI_API_KEY ontbreekt), dus er kan nog geen plan gebouwd worden.
        </p>
      )}
      {error && <p className="form__error">{error}</p>}

      {blocks.length === 0 ? (
        <div className="plan__empty">
          <p>Nog geen plan. Laat de AI-coach je eerste 10 weken bouwen.</p>
          <button
            type="button"
            className="btn btn--solid"
            disabled={busy || !aiEnabled}
            onClick={() => build("append")}
          >
            {busy ? "Bezig met bouwen…" : "Bouw mijn eerste 10 weken"}
          </button>
        </div>
      ) : (
        blocks.map((block) => {
          const plan = block.weeks as TrainingPlan;
          return (
            <section key={block.id} className="plan__block">
              <div className="plan__block-head">
                <h2 className="plan__focus">{plan.focus || `Blok ${block.blockIndex + 1}`}</h2>
                <button
                  type="button"
                  className="plan__regen"
                  onClick={() => setRegenFor(regenFor === block.blockIndex ? null : block.blockIndex)}
                  disabled={busy || !aiEnabled}
                >
                  Opnieuw genereren
                </button>
              </div>

              {regenFor === block.blockIndex && (
                <div className="plan__regen-box">
                  <textarea
                    rows={2}
                    value={adjust}
                    onChange={(e) => setAdjust(e.target.value)}
                    placeholder="Wat wil je anders? Bijv. meer gym, minder lange duurlopen, meer hersteldagen"
                  />
                  <button
                    type="button"
                    className="btn btn--solid"
                    disabled={busy}
                    onClick={() => build("regenerate", block.blockIndex)}
                  >
                    {busy ? "Bezig…" : "Genereer dit blok opnieuw"}
                  </button>
                </div>
              )}

              <ol className="plan__weeks">
                {plan.weeks.map((w) => (
                  <CollapsibleWeek key={w.week} isCurrentWeek={w.startDate === currentWeekStart} heading={
                    <>
                      <span className="plan__week-no">Week {w.week}</span>
                      <span className="plan__week-date">vanaf {shortDate(w.sessions.length ? w.sessions.map((session) => plusDays(w.startDate, Math.max(0, DAY_ORDER.indexOf(session.day)))).sort()[0] : w.startDate)}</span>
                      {w.theme && <span className="plan__week-theme">{w.theme}</span>}
                      <span className="plan__week-progress">{w.sessions.filter((session) => done.has(session.id)).length}/{w.sessions.length} klaar</span>
                    </>
                  }>
                    {w.note && <p className="plan__week-note">{w.note}</p>}
                    <ul className="plan__sessions">
                      {[...w.sessions]
                        .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day))
                        .map((s) => {
                          const isDone = done.has(s.id);
                          const meta = TYPE_META[s.type] ?? TYPE_META.run;
                          return (
                            <li key={s.id} className={`plan__session${isDone ? " plan__session--done" : ""}`}>
                              <label className="plan__check">
                                <input type="checkbox" checked={isDone} onChange={() => toggle(s.id)} />
                              </label>
                              <span className="plan__day">{DAY_LABEL[s.day] ?? s.day}</span>
                              <span className={`plan__type plan__type--${s.type}`} title={meta.label}>
                                {meta.icon}
                              </span>
                              <span className="plan__session-body">
                                <span className="plan__session-title">
                                  {s.type === "run" || s.type === "brick" ? compactRunText(s.title) : s.title}
                                  {s.duration && !/^0\s*(min|km)?$/i.test(s.duration.trim()) && (
                                    <span className="plan__session-dur"> · {s.duration}</span>
                                  )}
                                </span>
                                {s.detail && <span className="plan__session-detail">{s.type === "run" || s.type === "brick" ? compactRunText(s.detail) : s.detail}</span>}
                                {s.exercises && s.exercises.length > 0 && (
                                  <ol className="plan__ex">
                                    {s.exercises.map((ex, i) => (
                                      <li key={i} className="plan__ex-item">
                                        <span className="plan__ex-name">{ex.name}</span>
                                        {ex.prescription && (
                                          <span className="plan__ex-scheme">{ex.prescription}</span>
                                        )}
                                      </li>
                                    ))}
                                  </ol>
                                )}
                              </span>
                            </li>
                          );
                        })}
                    </ul>
                  </CollapsibleWeek>
                ))}
              </ol>
            </section>
          );
        })
      )}

      {blocks.length > 0 && (
        <div className="plan__foot">
          <button
            type="button"
            className="btn btn--solid"
            disabled={busy || !aiEnabled}
            onClick={() => build("append")}
          >
            {busy ? "Bezig met bouwen…" : `Bouw week ${nextBlockNumber}–${nextBlockNumber + 9}`}
          </button>
        </div>
      )}
    </main>
  );
}

function HeartRateZones({ zones }: { zones: ZoneResult | null }) {
  return (
    <details className="plan__zones">
      <summary aria-label="Hartslagzones" title="Hartslagzones"><span aria-hidden="true">♡</span> Zones</summary>
      {zones ? (
        <>
          <p>
            Max-hartslag: {zones.maxHr} bpm ({zones.estimatedMax ? "geschat uit je leeftijd" : "zelf ingevuld"}).
            {zones.restHr != null && ` Rusthartslag: ${zones.restHr} bpm.`}
          </p>
          <table>
            <caption>Jouw loopzones in slagen per minuut</caption>
            <thead><tr><th scope="col">Zone</th><th scope="col">Doel</th><th scope="col">bpm</th></tr></thead>
            <tbody>
              {zones.zones.map((z) => (
                <tr key={z.zone}><th scope="row">Z{z.zone}</th><td>{z.label}</td><td>{z.low}–{z.high}</td></tr>
              ))}
            </tbody>
          </table>
          <p>
            {zones.method === "hrr"
              ? "Berekend met hartslagreserve (Karvonen): rusthartslag + percentage × (max-hartslag − rusthartslag)."
              : "Berekend als percentage van je max-hartslag."}
            {" "}Zones gebruiken stappen van 10% tussen 50% en 100%. Dit zijn richtwaarden; je persoonlijke zones kunnen afwijken.
          </p>
        </>
      ) : (
        <p>Je hebt nog geen leeftijd of max-hartslag ingevuld. Vul die in via de vragenlijst om je zones te berekenen. ‘Opnieuw beginnen’ wist je huidige plan en voortgang.</p>
      )}
    </details>
  );
}

function CollapsibleWeek({ isCurrentWeek, heading, children }: { isCurrentWeek: boolean; heading: ReactNode; children: ReactNode }) {
  const [expanded, setExpanded] = useState<boolean | null>(null);
  return (
    <li className="plan__week">
      <details open={expanded ?? isCurrentWeek}>
        <summary className="plan__week-head" onClick={(event) => {
          event.preventDefault();
          setExpanded(!(expanded ?? isCurrentWeek));
        }}>{heading}</summary>
        {children}
      </details>
    </li>
  );
}
