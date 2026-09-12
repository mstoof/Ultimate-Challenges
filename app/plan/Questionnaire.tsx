"use client";

import { useState } from "react";
import { SPORTS } from "@/lib/distances";
import GymSplitPicker from "./GymSplitPicker";
import { saveProfile } from "./actions";

const DAYS: { key: string; label: string }[] = [
  { key: "ma", label: "Maandag" },
  { key: "di", label: "Dinsdag" },
  { key: "wo", label: "Woensdag" },
  { key: "do", label: "Donderdag" },
  { key: "vr", label: "Vrijdag" },
  { key: "za", label: "Zaterdag" },
  { key: "zo", label: "Zondag" },
];

// Naast de wedstrijdsporten kun je kracht/gym als losse "sport" kiezen; die
// staat niet in de event-lijst (SPORTS) maar hoort hier wel thuis.
const SPORT_OPTIONS = [...SPORTS.filter((s) => s !== "Anders"), "Kracht / Gym", "Anders"];

type RaceHint = { title: string; date: string | null; weeksAway: number | null };

type RaceOption = { id: string; title: string; date: string | null };

export default function Questionnaire({ races, raceOptions }: { races: RaceHint[]; raceOptions: RaceOption[] }) {
  const [gymDays, setGymDays] = useState("1");
  const [raceChoice, setRaceChoice] = useState("");
  const selectedRace = raceOptions.find((race) => race.id === raceChoice);
  const [sports, setSports] = useState<string[]>(["Hardlopen"]);

  const toggleSport = (s: string) =>
    setSports((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  return (
    <>
      <h1>Jouw trainingsplan</h1>
      <p className="form__lead">
        Beantwoord een paar vragen, dan bouwt de AI-coach een schema van 10 weken richting je races —
        hardlopen én kracht. Later laat je gewoon de volgende 10 weken bijbouwen.
      </p>

      {races.length > 0 && (
        <div className="quiz__races">
          <span className="quiz__races-title">We trainen richting:</span>
          <ul>
            {races.map((r, i) => (
              <li key={i}>
                {r.title}
                {r.weeksAway != null && <span className="quiz__races-away"> · over {r.weeksAway} weken</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form action={saveProfile} className="quiz">
        <fieldset className="quiz__section">
          <legend>1. Jouw doel & sporten</legend>
          <p className="quiz__hint">Vertel waar je naartoe wilt werken en wat je graag doet.</p>
          <label>Welke sporten wil je doen?</label>
          <div className="quiz__chips">
            {SPORT_OPTIONS.map((s) => {
              const on = sports.includes(s);
              return (
                <label key={s} className={`quiz__chip${on ? " quiz__chip--on" : ""}`}>
                  <input
                    type="checkbox"
                    name="sports"
                    value={s}
                    checked={on}
                    onChange={() => toggleSport(s)}
                  />
                  {s}
                </label>
              );
            })}
          </div>

          <label htmlFor="goal">Wat wil je kunnen of worden?</label>
          <textarea
            id="goal"
            name="goal"
            rows={3}
            placeholder="Bijv. mijn eerste marathon onder 4 uur lopen, sterker worden en blessurevrij blijven"
          />

          <label htmlFor="raceChoice">Doelrace (optioneel)</label>
          <select id="raceChoice" value={raceChoice} onChange={(event) => setRaceChoice(event.target.value)} aria-describedby="race-hint">
            <option value="">Geen extra doelrace</option>
            {raceOptions.map((race) => (
              <option key={race.id} value={race.id}>
                {race.title} · {race.date ? race.date.split("-").reverse().join("-") : "Datum nog onbekend"}
              </option>
            ))}
            <option value="custom">Andere race zelf invullen…</option>
          </select>
          <p id="race-hint" className="quiz__hint">Kies een race uit de agenda of voeg je eigen race toe. Races waarvoor je al bent aangemeld, nemen we automatisch mee.</p>
          {raceChoice === "custom" ? (
            <div className="form__two">
              <div>
                <label htmlFor="targetRace">Naam van je race</label>
                <input id="targetRace" name="targetRace" placeholder="Bijv. Marathon Rotterdam" required />
              </div>
              <div>
                <label htmlFor="targetRaceDate">Racedatum (optioneel)</label>
                <input id="targetRaceDate" name="targetRaceDate" type="date" />
              </div>
            </div>
          ) : (
            <>
              <input type="hidden" name="targetRace" value={selectedRace?.title ?? ""} />
              <input type="hidden" name="targetRaceDate" value={selectedRace?.date ?? ""} />
            </>
          )}
        </fieldset>

        <fieldset className="quiz__section">
          <legend>2. Jouw trainingsweek</legend>
          <p className="quiz__hint">Kies een ritme dat in je week past.</p>
          <label>Op welke dagen heb je tijd voor lange of dubbele trainingen?</label>
          <div className="quiz__days">
            {DAYS.map((d) => (
              <label key={d.key} className="quiz__day">
                <input type="checkbox" name="longRunDays" value={d.key} defaultChecked={d.key === "za" || d.key === "zo"} />
                {d.label.slice(0, 2)}
              </label>
            ))}
          </div>

          <div className="form__two">
            <div>
              <label htmlFor="sessionsPerWeek">Trainingen per week</label>
              <input id="sessionsPerWeek" name="sessionsPerWeek" type="number" min="1" max="14" defaultValue="4" />
            </div>
            <div>
              <label htmlFor="gymDays">Krachttraining (dagen/week)</label>
              <input id="gymDays" name="gymDays" type="number" min="0" max="7" value={gymDays} onChange={(event) => setGymDays(event.target.value)} />
            </div>
          </div>
          {Number(gymDays) > 0 && <GymSplitPicker />}
        </fieldset>

        <fieldset className="quiz__section">
          <legend>3. Jouw startpunt</legend>
          <p className="quiz__hint">Je huidige ervaring helpt om de belasting op jou af te stemmen.</p>
          <label htmlFor="experience">Je niveau nu</label>
          <input
            id="experience"
            name="experience"
            placeholder="Bijv. loop ~25 km per week, halve marathon in 1:55"
          />
        </fieldset>

        <fieldset className="quiz__section">
          <legend>4. Jouw hartslagzones</legend>
          <p className="quiz__hint">
            Hiermee rekenen we je zones 1–5 uit. Max-hartslag mag leeg — dan schatten we die uit je
            leeftijd. Rusthartslag maakt de berekening nauwkeuriger.
          </p>
          <div className="form__two">
            <div>
              <label htmlFor="age">Leeftijd</label>
              <input id="age" name="age" type="number" min="10" max="100" placeholder="bv. 34" />
            </div>
            <div>
              <label htmlFor="restHr">Rusthartslag</label>
              <input id="restHr" name="restHr" type="number" min="30" max="110" placeholder="bv. 55" />
            </div>
            <div>
              <label htmlFor="maxHr">Max-hartslag</label>
              <input id="maxHr" name="maxHr" type="number" min="120" max="230" placeholder="optioneel" />
            </div>
          </div>
        </fieldset>

        <button type="submit" className="btn btn--solid">
          Bewaar en ga verder
        </button>
      </form>
    </>
  );
}
