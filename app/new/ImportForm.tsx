"use client";

import { useState } from "react";
import Link from "next/link";
import { importedAmsterdamInput } from "@/lib/timezone";
import { createEvent } from "./actions";
import { SPORTS, distanceGroupsForSport } from "@/lib/distances";

type Fields = {
  title: string;
  sport: string;
  distance: string;
  location: string;
  startsAt: string;
  hours: string;
  someday: boolean;
  price: string;
  imageUrl: string;
  description: string;
  signupUrl: string;
};

const emptyFields = (kind: "race" | "trip", sport?: string): Fields => ({
  title: "",
  sport: sport && SPORTS.includes(sport) ? sport : kind === "trip" ? "Anders" : "Hardlopen",
  distance: "",
  location: "",
  startsAt: "",
  hours: kind === "trip" ? "24" : "3",
  someday: false,
  price: "",
  imageUrl: "",
  description: "",
  signupUrl: "",
});

export default function ImportForm({ error, kind = "race", initialSport, fromGear = false }: { error?: string; kind?: "race" | "trip"; initialSport?: string; fromGear?: boolean }) {
  const [f, setF] = useState<Fields>(() => emptyFields(kind, initialSport));
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  // Afstand-opties horen bij de gekozen sport.
  const groups = distanceGroupsForSport(f.sport);
  const visible = new Set(groups.flatMap((g) => g.options));

  async function runImport() {
    if (!f.signupUrl.trim()) return;
    setBusy(true);
    setImportError(null);
    try {
      const res = await fetch("/api/import-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: f.signupUrl }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Ophalen mislukte (${res.status}).`);

      const sport = SPORTS.includes(data.sport) ? data.sport : "Anders";
      setF((prev) => ({
        ...prev,
        title: data.title || prev.title,
        sport,
        distance: data.distance || prev.distance,
        location: data.location || prev.location,
        startsAt: importedAmsterdamInput(data.startsAt) || prev.startsAt,
        someday: !data.startsAt,
        price: data.price || prev.price,
        imageUrl: data.imageUrl || prev.imageUrl,
        description: data.description || prev.description,
        // De link die je plakte is meteen de event-/inschrijflink.
      }));
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Er ging iets mis.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="form">
      <Link href={fromGear ? "/gear" : "/"} className="form__back">
        ← Terug naar {fromGear ? "uitrusting" : "de agenda"}
      </Link>
      <h1>{kind === "trip" ? "Nieuwe reis" : "Nieuwe race of event"}</h1>
      <p className="form__lead">
        {kind === "trip"
          ? "Leg de reis vast als gezamenlijk event. Je kunt daarna aangeven wie meegaat en wanneer iedereen vertrekt."
          : "Plak één link naar het evenement en laat AI de velden invullen. Controleer ze en pas aan waar nodig. Je wordt zelf meteen als deelnemer aangemeld."}
      </p>

      <form action={createEvent}>
        {fromGear && <input type="hidden" name="returnTo" value="gear" />}
        {/* Eén link: bron voor de AI-import én de opgeslagen event-/inschrijflink. */}
        <label htmlFor="signupUrl">Link naar het event</label>
        <div className="form__import">
          <input
            id="signupUrl"
            name="signupUrl"
            type="url"
            value={f.signupUrl}
            onChange={(e) => set("signupUrl", e.target.value)}
            placeholder="https://link-naar-het-event…"
          />
          <button type="button" onClick={runImport} disabled={busy} className="btn">
            {busy ? "Ophalen…" : "Ophalen met AI"}
          </button>
        </div>
        {importError && <p className="form__error">{importError}</p>}
        {error === "leeg" && <p className="form__error">Naam, locatie en datum zijn verplicht.</p>}
        {error === "datum" && <p className="form__error">Die datum kon ik niet lezen.</p>}
        {error === "link" && <p className="form__error">Gebruik voor een logo een openbare http(s)-link.</p>}

        <label htmlFor="title">Wat gaan we doen</label>
        <input
          id="title"
          name="title"
          required
          value={f.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Halve van Utrecht"
        />

        <div className="form__two">
          <div>
            <label htmlFor="sport">Sport</label>
            <select id="sport" name="sport" value={f.sport} onChange={(e) => set("sport", e.target.value)}>
              {SPORTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="distance">Afstand of duur</label>
            <select
              id="distance"
              name="distance"
              value={f.distance}
              onChange={(e) => set("distance", e.target.value)}
            >
              <option value="">Kies een sport</option>
              {f.distance && !visible.has(f.distance) && (
                <option value={f.distance}>{f.distance}</option>
              )}
              {groups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        <label htmlFor="location">Waar</label>
        <input
          id="location"
          name="location"
          required
          value={f.location}
          onChange={(e) => set("location", e.target.value)}
          placeholder="Utrecht"
        />

        <div className="form__two">
          <div>
            <label htmlFor="startsAt">Wanneer (Amsterdam)</label>
            <input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              value={f.startsAt}
              onChange={(e) => set("startsAt", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="hours">Duur in uren</label>
            <input
              id="hours"
              name="hours"
              type="number"
              min="1"
              max={kind === "trip" ? "336" : "24"}
              value={f.hours}
              onChange={(e) => set("hours", e.target.value)}
            />
          </div>
        </div>

        <label className="form__check">
          <input
            type="checkbox"
            name="someday"
            checked={f.someday}
            onChange={(e) => set("someday", e.target.checked)}
          />
          Nog geen datum. Zet dit op de <strong>someday</strong>-lijst (bucketlist)
        </label>

        <label htmlFor="price">Deelnamekosten</label>
        <input
          id="price"
          name="price"
          value={f.price}
          onChange={(e) => set("price", e.target.value)}
          placeholder="€45, vanaf €50 of Gratis"
        />

        <label htmlFor="imageUrl">Logo van het event (URL)</label>
        <div className="form__logo">
          {f.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={f.imageUrl} alt="" className="form__logo-preview" />
          )}
          <input
            id="imageUrl"
            name="imageUrl"
            type="url"
            value={f.imageUrl}
            onChange={(e) => set("imageUrl", e.target.value)}
            placeholder="Leeg = icoon van de link"
          />
        </div>

        <label htmlFor="description">Toelichting</label>
        <textarea
          id="description"
          name="description"
          rows={3}
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Waar staat de support crew, wat neem je mee"
        />

        <button type="submit" className="btn btn--solid">
          Event plaatsen
        </button>
      </form>
    </main>
  );
}
