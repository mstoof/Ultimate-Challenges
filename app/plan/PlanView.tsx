"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { TrainingBlock, TrainingPlan, TrainingSession } from "@/db/schema";
import type { ZoneResult } from "@/lib/training";
import GymPreferences from "./GymPreferences";
import NotionExport from "./NotionExport";
import Logo from "../Logo";
import { plusDays } from "@/lib/training-dates";
import { logoSrc } from "@/lib/logo";
import { compactRunText } from "@/lib/plan-display";
import { toggleDone, resetPlan } from "./actions";

type RaceHint = {
  title: string;
  date: string | null;
  weeksAway: number | null;
  imageUrl?: string | null;
  signupUrl?: string | null;
  role?: "run" | "support";
};
type ProfileSummary = { sports: string[]; goal: string | null; gymDays: number; gymSplits: string[]; sessionsPerWeek: number };

const DAY_LABEL: Record<string, string> = {
  ma: "ma", di: "di", wo: "wo", do: "do", vr: "vr", za: "za", zo: "zo",
};
const TYPE_META: Record<TrainingSession["type"], { icon: TrainingIconName; label: string }> = {
  run: { icon: "run", label: "Hardlopen" },
  gym: { icon: "gym", label: "Kracht" },
  cross: { icon: "cross", label: "Cross" },
  brick: { icon: "brick", label: "Brick" },
  rust: { icon: "rest", label: "Rust" },
};

const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
function calendarWeek(iso: string) {
  const date = new Date(`${iso}T12:00:00Z`);
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  return Math.ceil((((thursday.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
function weekRange(iso: string) {
  const end = plusDays(iso, 6);
  const startDate = new Date(`${iso}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  const startMonth = MONTHS[startDate.getMonth()];
  const endMonth = MONTHS[endDate.getMonth()];
  return startMonth === endMonth
    ? `${startDate.getDate()}–${endDate.getDate()} ${endMonth}`
    : `${startDate.getDate()} ${startMonth}–${endDate.getDate()} ${endMonth}`;
}
function dateKey(value: string) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(new Date(value));
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

  useEffect(() => {
    const toolbar = document.querySelector(".plan__tools");
    if (!toolbar) return;
    const closeSiblings = (event: Event) => {
      const summary = (event.target as HTMLElement).closest("summary");
      const current = summary?.closest("details");
      if (!current) return;
      toolbar.querySelectorAll("details[open]").forEach((detail) => {
        if (detail !== current) detail.removeAttribute("open");
      });
    };
    toolbar.addEventListener("click", closeSiblings);
    return () => toolbar.removeEventListener("click", closeSiblings);
  }, []);

  const target = races.find((r) => r.date && r.role !== "support") ?? null;

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
          <button type="submit" className="plan__reset" title="Vragenlijst opnieuw invullen" aria-label="Vragenlijst opnieuw invullen">
            <ActionIcon name="reset" />
            <span className="plan__action-label">Opnieuw beginnen</span>
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
          const blockIsCurrent = plan.weeks.some((week) => week.startDate === currentWeekStart);
          return (
            <section key={block.id} className="plan__block">
              <div className="plan__block-head">
                <h2 className="plan__focus">{plan.focus || `Blok ${block.blockIndex + 1}`}</h2>
                <button
                  type="button"
                  className="plan__regen"
                  title="Dit trainingsblok opnieuw genereren"
                  aria-label="Dit trainingsblok opnieuw genereren"
                  onClick={() => setRegenFor(regenFor === block.blockIndex ? null : block.blockIndex)}
                  disabled={busy || !aiEnabled}
                >
                  <ActionIcon name="regen" />
                  <span className="plan__action-label">Opnieuw genereren</span>
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
                    aria-busy={busy}
                    onClick={() => build("regenerate", block.blockIndex)}
                  >
                    {busy ? "Bezig…" : "Genereer dit blok opnieuw"}
                  </button>
                  {busy && <p className="plan__regen-status" role="status">De coach maakt twee delen van dit blok. Dit kan even duren.</p>}
                  {error && <p className="plan__regen-error" role="alert">{error}</p>}
                </div>
              )}

              <CollapsibleBlock
                isCurrent={blockIsCurrent}
                label={`Weken ${plan.weeks[0]?.week ?? block.blockIndex * 10 + 1}–${plan.weeks.at(-1)?.week ?? (block.blockIndex + 1) * 10}`}
              >
              <ol className="plan__weeks">
                {plan.weeks.map((w) => (
                  <CollapsibleWeek key={w.week} isCurrentWeek={w.startDate === currentWeekStart} heading={
                    <>
                      <span className="plan__week-no">WK{calendarWeek(w.startDate)}</span>
                      <span className="plan__week-date">{weekRange(w.startDate)}</span>
                      {races.filter((race) => race.date && dateKey(race.date) >= w.startDate && dateKey(race.date) <= plusDays(w.startDate, 6)).map((race) => (
                        <span className="plan__week-race" key={`${w.week}-${race.title}`} title={race.title} aria-label={race.title}>
                          <RaceLogo race={race} />
                        </span>
                      ))}
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
                                <TrainingIcon name={meta.icon} />
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
              </CollapsibleBlock>
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
      <summary aria-label="Hartslagzones" title="Hartslagzones"><ToolIcon name="heart" /> Zones</summary>
      {zones ? (
        <div className="plan__zones-body">
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
        </div>
      ) : (
        <div className="plan__zones-body"><p>Je hebt nog geen leeftijd of max-hartslag ingevuld. Vul die in via de vragenlijst om je zones te berekenen. ‘Opnieuw beginnen’ wist je huidige plan en voortgang.</p></div>
      )}
    </details>
  );
}

type TrainingIconName = "run" | "gym" | "cross" | "brick" | "rest";
function TrainingIcon({ name }: { name: TrainingIconName }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "run") {
    return <svg className="plan__training-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}>
      <circle cx="14.5" cy="4" r="2" />
      <path d="m12.5 8 2.5 2.5 3.5 1M12.5 8l-2 4.5-3.5 2M15 10.5l-1.5 4.5 3.5 4M10.5 12.5l-1 5.5-3 2.5" />
    </svg>;
  }
  if (name === "gym") {
    return <svg className="plan__training-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}>
      <path d="M4 9v6M7 6v12M10 10h4M17 6v12M20 9v6M7 12h10" />
    </svg>;
  }
  if (name === "cross") {
    return <svg className="plan__training-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}>
      <circle cx="7" cy="17" r="2.5" /><circle cx="17" cy="17" r="2.5" />
      <path d="m7 17 4-7 3 7m-3-7 3-3m-3 3 5 2 1.5 5" />
    </svg>;
  }
  if (name === "brick") {
    return <svg className="plan__training-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}>
      <path d="M4 7h16v10H4zM4 12h16M10 7v5M16 12v5" />
    </svg>;
  }
  return <svg className="plan__training-icon" viewBox="0 0 24 24" aria-hidden="true" {...common}>
    <path d="M6 15a6 6 0 1 0 7-8 5 5 0 1 1-7 8Z" />
    <path d="M17.5 4.5h.01M20 7h.01" />
  </svg>;
}

function ToolIcon({ name }: { name: "heart" | "notion" | "gym" }) {
  if (name === "notion") return <span className="plan__tool-icon" aria-hidden="true">N</span>;
  const path = name === "heart"
    ? "M12 20S4 15.5 4 9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.5 12 20 12 20Z"
    : "M4 9v6M7 7v10M10 10h4v4h-4M17 7v10M20 9v6M7 12h10";
  return <svg className="plan__tool-svg" viewBox="0 0 24 24" aria-hidden="true"><path d={path} /></svg>;
}

function ActionIcon({ name }: { name: "reset" | "regen" }) {
  const path = name === "reset"
    ? "M3 8.5V3m0 5.5h5.5M3.8 8a9 9 0 1 1 2.1 9.8"
    : "M20 11a8 8 0 0 0-14.9-4L4 9M4 5v4h4M4 13a8 8 0 0 0 14.9 4L20 15M20 19v-4h-4";
  return <svg className="plan__action-icon" viewBox="0 0 24 24" aria-hidden="true"><path d={path} /></svg>;
}

function RaceLogo({ race }: { race: RaceHint }) {
  return <Logo src={logoSrc(race.imageUrl ?? null, race.signupUrl ?? null)} emoji="🏁" className="plan__race-logo" />;
}

function CollapsibleBlock({ isCurrent, label, children }: { isCurrent: boolean; label: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const isOpen = expanded ?? isCurrent;
  return (
    <details className="plan__block-details" open={isOpen}>
      <summary
        className="plan__block-summary"
        onClick={(event) => {
          event.preventDefault();
          setExpanded(!isOpen);
        }}
      >
        <span>{label}</span>
        <span className="plan__block-summary-note">{isOpen ? "Inklappen" : "Openklappen"}</span>
      </summary>
      {children}
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
