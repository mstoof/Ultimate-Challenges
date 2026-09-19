"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { GearItem } from "@/db/schema";
import type { GearSectionView, GearBucket, GearProfileView, GearEventOption } from "@/lib/gear-shared";
import { GEAR_TAGS, effectivePrice, safeTags } from "@/lib/gear-shared";
import {
  addGearSport,
  addGearSportForEvent,
  removeGearSport,
  toggleHave,
  setPrice,
  addManualItem,
  removeItem,
  saveGearProfile,
  chooseGearOption,
  selectGearEvent,
  saveGearTrip,
} from "./actions";

type Filter = "all" | "buy" | "second";
const GEAR_FILTERS_KEY = "ultimate-challenges:gear-filters";

const BUCKET_META: Record<GearBucket, { label: string; cls: string }> = {
  now: { label: "Binnenkort nodig", cls: "now" },
  soon: { label: "Dit seizoen", cls: "soon" },
  later: { label: "Later", cls: "later" },
};
const BUDGET_LABEL: Record<GearBucket, string> = {
  now: "Binnenkort",
  soon: "Dit seizoen",
  later: "Later",
};

const eur = (n: number) => "€" + Math.round(n).toLocaleString("nl-NL");
const shopUrl = (q: string) => "https://www.google.com/search?tbm=shop&q=" + encodeURIComponent(q + " kopen");
const mpUrl = (q: string) => "https://www.marktplaats.nl/q/" + encodeURIComponent(q) + "/";

export default function GearView({
  sections,
  profile,
  eventOptions,
  aiEnabled,
}: {
  sections: GearSectionView[];
  profile: GearProfileView;
  eventOptions: GearEventOption[];
  aiEnabled: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [hideCompleted, setHideCompleted] = useState(false);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(GEAR_FILTERS_KEY) || "null");
      if (saved && ["all", "buy", "second"].includes(saved.filter)) setFilter(saved.filter as Filter);
      if (typeof saved?.hideCompleted === "boolean") setHideCompleted(saved.hideCompleted);
    } catch {
      // Ongeldige of geblokkeerde browseropslag: gebruik de standaardfilters.
    }
    setFiltersLoaded(true);
  }, []);

  useEffect(() => {
    if (!filtersLoaded) return;
    try {
      window.localStorage.setItem(GEAR_FILTERS_KEY, JSON.stringify({ filter, hideCompleted }));
    } catch {
      // De filters blijven in deze sessie gewoon werken als opslag geblokkeerd is.
    }
  }, [filter, hideCompleted, filtersLoaded]);

  const run = (fn: () => Promise<unknown>) => startTransition(async () => {
    await fn();
    router.refresh();
  });

  // Budget per emmer + voortgang, alleen niet-afgevinkte items tellen mee.
  const budget: Record<GearBucket, number> = { now: 0, soon: 0, later: 0 };
  let total = 0;
  let owned = 0;
  const countedShared = new Set<string>();
  for (const sec of sections) {
    for (const it of sec.items) {
      if (it.sharedKey && countedShared.has(it.sharedKey)) continue;
      if (it.sharedKey) countedShared.add(it.sharedKey);
      total++;
      if (it.have) owned++;
      else budget[sec.bucket] += effectivePrice(it);
    }
  }
  const budgetTotal = budget.now + budget.soon + budget.later;
  const pct = total ? owned / total : 1;
  const C = 2 * Math.PI * 22;

  return (
    <div className={"gear__wrap" + (isPending ? " is-busy" : "")}>
      <header className="gear__mast">
        <h1>Uitrusting voor inkoop en budget</h1>
        <p className="form__lead">
          Kies je sporten, laat de AI een inkooplijst maken, vul echte prijzen in en vink af wat je hebt.
          De deadline per sport volgt je aankomende races.
        </p>
      </header>

      <ProfileCard profile={profile} onSave={(input) => run(() => saveGearProfile(input))} />

      {/* Budget */}
      <section className="gear__budget">
        <div className="gear__ring">
          <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
            <circle cx="26" cy="26" r="22" fill="none" stroke="var(--line)" strokeWidth="6" />
            <circle
              cx="26" cy="26" r="22" fill="none" stroke="var(--lane)" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={C.toFixed(1)} strokeDashoffset={(C * (1 - pct)).toFixed(1)}
              transform="rotate(-90 26 26)"
            />
          </svg>
          <div>
            <div className="gear__ring-big">{owned} van {total} in bezit</div>
            <div className="gear__ring-small">{total - owned} nog te kopen</div>
          </div>
        </div>
        <div className="gear__budget-grid">
          <div className="gear__cell"><span className="k"><i className="dot now" />{BUDGET_LABEL.now}</span><span className="v">{eur(budget.now)}</span></div>
          <div className="gear__cell"><span className="k"><i className="dot soon" />{BUDGET_LABEL.soon}</span><span className="v">{eur(budget.soon)}</span></div>
          <div className="gear__cell"><span className="k"><i className="dot later" />{BUDGET_LABEL.later}</span><span className="v">{eur(budget.later)}</span></div>
          <div className="gear__cell total"><span className="k">Totaal resterend</span><span className="v">{eur(budgetTotal)}</span></div>
        </div>
      </section>

      {/* Sport toevoegen */}
      <AddSport
        events={eventOptions}
        onAdd={(sport) => run(() => addGearSport(sport))}
        onAddEvent={(eventId) => run(() => addGearSportForEvent(eventId))}
      />

      {/* Filters */}
      <div className="gear__filters">
        <button className="gear__chip" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>Alles</button>
        <button className="gear__chip" aria-pressed={filter === "buy"} onClick={() => setFilter("buy")}>Nog te kopen</button>
        <button className="gear__chip" aria-pressed={filter === "second"} onClick={() => setFilter("second")}>Tweedehands kan</button>
        <label className="gear__hide-done">
          <input type="checkbox" checked={hideCompleted} onChange={(e) => setHideCompleted(e.target.checked)} />
          Afgevinkte items verbergen
        </label>
      </div>

      {sections.length === 0 ? (
        <p className="gear__empty">Nog geen sporten. Voeg er hierboven één toe om te beginnen.</p>
      ) : (
        sections.map((sec) => (
          <SportSection
            key={sec.sport}
            section={sec}
            filter={filter}
            hideCompleted={hideCompleted}
            eventOptions={eventOptions}
            aiEnabled={aiEnabled}
            onRefresh={() => router.refresh()}
            onToggle={(id) => run(() => toggleHave(id))}
            onPrice={(id, value) => run(() => setPrice(id, value))}
            onRemoveItem={(id) => run(() => removeItem(id))}
            onRemoveSport={(sport) => run(() => removeGearSport(sport))}
            onAddItem={(sport, input) => run(() => addManualItem(sport, input))}
            onChooseOption={(id, index) => run(() => chooseGearOption(id, index))}
            onSelectEvent={(sport, eventId) => run(() => selectGearEvent(sport, eventId))}
            onSaveTrip={(sport, country, date) => run(() => saveGearTrip(sport, country, date))}
          />
        ))
      )}

      <footer className="gear__legend">
        <b>Legenda</b>
        <div className="gear__legend-row">
          <span><i className="t tw">tweedehands</i> prima 2e-hands</span>
          <span><i className="t no">nieuw kopen</i> geen 2e-hands (veiligheid)</span>
          <span><i className="t ch">keuze maken</i> beslissing open</span>
          <span><i className="t op">optioneel</i> niet essentieel</span>
        </div>
        <p className="gear__legend-note">
          <b>Let op:</b> helmen en schoenen nooit tweedehands. Na een val is de bescherming onbetrouwbaar en pasvorm en demping zijn persoonlijk.
        </p>
      </footer>
    </div>
  );
}

function ProfileCard({ profile, onSave }: {
  profile: GearProfileView;
  onSave: (input: { heightCm: string; weightKg: string; shoeSize: string; clothingSize: string }) => void;
}) {
  const [open, setOpen] = useState(!profile.heightCm && !profile.weightKg);
  const [heightCm, setHeightCm] = useState(profile.heightCm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(profile.weightKg?.toString() ?? "");
  const [shoeSize, setShoeSize] = useState(profile.shoeSize ?? "");
  const [clothingSize, setClothingSize] = useState(profile.clothingSize ?? "");
  const summary = [
    profile.heightCm && `${profile.heightCm} cm`,
    profile.weightKg && `${profile.weightKg} kg`,
    profile.shoeSize && `schoen ${profile.shoeSize}`,
    profile.clothingSize && `kleding ${profile.clothingSize}`,
  ].filter(Boolean).join(" · ");

  return (
    <section className="gear__profile">
      <button type="button" className="gear__profile-head" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span><b>Mijn pasvorm</b><small>{summary || "Vul je maten in voor persoonlijkere keuzes"}</small></span>
        <span>{open ? "Sluiten" : summary ? "Wijzigen" : "Invullen"}</span>
      </button>
      {open && (
        <div className="gear__profile-body">
          <label>Lengte <span><input type="number" min="100" max="250" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} /> cm</span></label>
          <label>Gewicht <span><input type="number" min="30" max="300" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} /> kg</span></label>
          <label>Schoenmaat <input inputMode="decimal" placeholder="bijv. 43,5" value={shoeSize} onChange={(e) => setShoeSize(e.target.value)} /></label>
          <label>Kledingmaat <input placeholder="bijv. M of L/XL" value={clothingSize} onChange={(e) => setClothingSize(e.target.value)} /></label>
          <button className="btn btn--solid" type="button" onClick={() => { onSave({ heightCm, weightKg, shoeSize, clothingSize }); setOpen(false); }}>Maten bewaren</button>
          <p>Deze gegevens worden alleen gebruikt om maten, draagvermogen en geschikte gear-opties te adviseren.</p>
        </div>
      )}
    </section>
  );
}

function AddSport({ events, onAdd, onAddEvent }: {
  events: GearEventOption[];
  onAdd: (sport: string) => void;
  onAddEvent: (eventId: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const [showEvents, setShowEvents] = useState(false);
  const eventQuery = value.trim().toLowerCase();
  const matchingEvents = events.filter((event) =>
    !eventQuery || [event.title, event.sport, event.location].some((text) => text.toLowerCase().includes(eventQuery))
  );
  useEffect(() => {
    if (!showEvents) return;
    const closeOutside = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setShowEvents(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [showEvents]);
  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onAdd(v);
    setValue("");
    setShowEvents(false);
  };
  return (
    <div className="gear__add-wrap" ref={wrapRef}>
      <div className="gear__add-sport">
        <input
          placeholder="Sport handmatig toevoegen of kies een event…"
          value={value}
          role="combobox"
          aria-expanded={showEvents}
          aria-controls="gear-event-menu"
          autoComplete="off"
          onFocus={() => setShowEvents(true)}
          onChange={(e) => { setValue(e.target.value); setShowEvents(true); }}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
          aria-label="Sport toevoegen"
        />
        <button className="btn btn--solid" type="button" onClick={submit}>+ Sport</button>
      </div>
      {showEvents && (
        <div className="gear__event-menu" id="gear-event-menu" role="listbox">
          <b>Kies een gepland event of typ zelf een sport</b>
          {matchingEvents.length ? matchingEvents.map((event) => (
            <button key={event.id} type="button" onClick={() => { onAddEvent(event.id); setShowEvents(false); }}>
              <span>{event.title}</span>
              <small>{event.sport} · {event.date ? new Date(event.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" }) : "datum nog niet bekend"} · {event.location}</small>
            </button>
          )) : <p>Geen event gevonden. Gebruik `+ Sport` om “{value}” handmatig toe te voegen.</p>}
        </div>
      )}
    </div>
  );
}

function SportSection({
  section, filter, hideCompleted, eventOptions, aiEnabled, onRefresh, onToggle, onPrice, onRemoveItem, onRemoveSport, onAddItem, onChooseOption, onSelectEvent, onSaveTrip,
}: {
  section: GearSectionView;
  filter: Filter;
  hideCompleted: boolean;
  eventOptions: GearEventOption[];
  aiEnabled: boolean;
  onRefresh: () => void;
  onToggle: (id: string) => void;
  onPrice: (id: string, value: string) => void;
  onRemoveItem: (id: string) => void;
  onRemoveSport: (sport: string) => void;
  onAddItem: (sport: string, input: { name: string; description?: string; tags?: string[]; price?: number; productUrl?: string }) => void;
  onChooseOption: (id: string, index: number) => void;
  onSelectEvent: (sport: string, eventId: string) => void;
  onSaveTrip: (sport: string, country: string, date: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [openStateLoaded, setOpenStateLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingTarget, setEditingTarget] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(`ultimate-challenges:gear-section:${section.sport}`);
      if (saved === "closed") setOpen(false);
      if (saved === "open") setOpen(true);
    } catch {
      // Browseropslag kan geblokkeerd zijn; de kaart blijft dan normaal werken.
    }
    setOpenStateLoaded(true);
  }, [section.sport]);

  useEffect(() => {
    if (!openStateLoaded) return;
    try {
      window.localStorage.setItem(`ultimate-challenges:gear-section:${section.sport}`, open ? "open" : "closed");
    } catch {
      // Alleen persistentie valt weg; in- en uitklappen blijft werken.
    }
  }, [open, openStateLoaded, section.sport]);

  const bucket = BUCKET_META[section.bucket];
  const bucketLabel = section.bucket === "later" && !section.race && !section.trip ? "Later / geen race" : bucket.label;
  const items = section.items;
  const total = items.length;
  const done = items.filter((i) => i.have).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const visible = items.filter((it) => {
    if (hideCompleted && it.have) return false;
    if (filter === "buy") return !it.have;
    if (filter === "second") return safeTags(it.tags).includes("tw");
    return true;
  });

  async function generate() {
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch("/api/gear-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport: section.sport }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGenError(data?.error || "Er ging iets mis.");
      } else {
        onRefresh();
      }
    } catch {
      setGenError("Kon de AI niet bereiken.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="gear__grp" data-open={open}>
      <div className="gear__grp-head">
        <button className="gear__grp-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <span className="gear__grp-title">
            <span className="name">{section.sport}</span>
            {section.race && (
              <span className="gear__race">
                {section.race.title} · {section.race.date
                  ? `${new Date(section.race.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" })} · over ~${section.race.weeksAway} wk`
                  : "datum nog niet bekend"}
              </span>
            )}
            {section.trip && (
              <span className="gear__race">Reis naar {section.trip.country} · {new Date(`${section.trip.date}T12:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}</span>
            )}
          </span>
          <span className="gear__grp-prog">
            <span>{done}/{total}</span>
            <span className="gear__bar"><i style={{ width: pct + "%" }} /></span>
          </span>
        </button>
        <button type="button" className={"gear__dl gear__target-trigger " + bucket.cls}
          aria-expanded={editingTarget} aria-label={`Event voor ${section.sport} aanpassen`}
          onClick={() => { setOpen(true); setEditingTarget((value) => !value); }}>{bucketLabel}</button>
        <button className="gear__grp-remove" title="Sport verwijderen" aria-label={`${section.sport} verwijderen`}
          onClick={() => { if (confirm(`"${section.sport}" en al zijn items verwijderen?`)) onRemoveSport(section.sport); }}>
          ✕
        </button>
      </div>

      {open && (
        <div className="gear__grp-body">
          {editingTarget && (
            <RacePicker
              section={section}
              events={eventOptions}
              onCancel={() => setEditingTarget(false)}
              onSelect={(sport, eventId) => { onSelectEvent(sport, eventId); setEditingTarget(false); }}
              onSaveTrip={(sport, country, date) => { onSaveTrip(sport, country, date); setEditingTarget(false); }}
            />
          )}
          {aiEnabled && (
            <div className="gear__ai">
              <button className="btn btn--solid" type="button" disabled={generating} onClick={generate}>
                {generating ? "AI denkt na…" : total ? "AI-lijst aanvullen" : "AI-lijst genereren"}
              </button>
              {genError && <span className="gear__ai-error">{genError}</span>}
            </div>
          )}

          {visible.length === 0 && (
            <p className="gear__grp-empty">
              {total === 0
                ? (aiEnabled ? "Nog geen items. Genereer een lijst of voeg er zelf één toe." : "Nog geen items. Voeg er zelf één toe.")
                : hideCompleted && done === total ? "Alles is afgevinkt. Zet ‘Afgevinkte items verbergen’ uit om ze terug te zien." : "Geen items in dit filter."}
            </p>
          )}

          {visible.map((it) => (
            <GearRow key={it.id} item={it} onToggle={onToggle} onPrice={onPrice} onRemove={onRemoveItem} onChooseOption={onChooseOption} />
          ))}

          {adding ? (
            <ManualItemForm
              onCancel={() => setAdding(false)}
              onSave={(input) => { onAddItem(section.sport, input); setAdding(false); }}
            />
          ) : (
            <button className="gear__add-item" type="button" onClick={() => setAdding(true)}>+ Item toevoegen</button>
          )}
        </div>
      )}
    </section>
  );
}

function RacePicker({ section, events, onSelect, onSaveTrip, onCancel }: {
  section: GearSectionView;
  events: GearEventOption[];
  onSelect: (sport: string, eventId: string) => void;
  onSaveTrip: (sport: string, country: string, date: string) => void;
  onCancel: () => void;
}) {
  const [tripMode, setTripMode] = useState(Boolean(section.trip));
  const [country, setCountry] = useState(section.trip?.country ?? "");
  const [tripDate, setTripDate] = useState(section.trip?.date ?? "");
  const matching = events.filter((event) => event.sport === section.sport);
  const other = events.filter((event) => event.sport !== section.sport);
  const renderOption = (event: GearEventOption) => (
    <option key={event.id} value={event.id}>
      {event.title} | {event.date ? new Date(event.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" }) : "ooit"} · {event.location}
    </option>
  );

  return (
    <div className="gear__target">
      {!tripMode && <label>
        <span>Doelrace of event</span>
        <select value={section.targetEventId ?? ""} onChange={(e) => onSelect(section.sport, e.target.value)}>
          <option value="">Automatisch: eerstvolgende waar ik heen ga</option>
          {matching.length > 0 && <optgroup label={section.sport}>{matching.map(renderOption)}</optgroup>}
          {other.length > 0 && <optgroup label="Andere events en reizen">{other.map(renderOption)}</optgroup>}
        </select>
      </label>}
      {tripMode && (
        <div className="gear__trip-fields">
          <label><span>Land</span><input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="bijv. Frankrijk" /></label>
          <label><span>Vertrekdatum</span><input type="date" value={tripDate} onChange={(e) => setTripDate(e.target.value)} /></label>
          <button className="gear__btn" type="button" disabled={!country.trim() || !tripDate} onClick={() => onSaveTrip(section.sport, country, tripDate)}>Reis bewaren</button>
        </div>
      )}
      <div className="gear__target-actions">
        <a className="gear__btn" href={`/new?kind=race&sport=${encodeURIComponent(section.sport)}&from=gear`}>+ Race/event</a>
        <button className="gear__btn" type="button" onClick={() => setTripMode((value) => !value)}>{tripMode ? "Kies event" : "+ Reis zonder event"}</button>
        {section.race && <a className="gear__btn" href={`/e/${section.race.slug}`}>Bekijk</a>}
        <button className="gear__btn" type="button" onClick={onCancel}>Sluiten</button>
      </div>
    </div>
  );
}

function GearRow({
  item, onToggle, onPrice, onRemove, onChooseOption,
}: {
  item: GearItem;
  onToggle: (id: string) => void;
  onPrice: (id: string, value: string) => void;
  onRemove: (id: string) => void;
  onChooseOption: (id: string, index: number) => void;
}) {
  const tags = safeTags(item.tags);
  const isSecond = tags.includes("tw");
  const chosenOption = item.options?.[item.chosenOption ?? -1];
  const [price, setLocalPrice] = useState(String(effectivePrice(item)));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Houd het lokale veld in sync als de server-waarde verandert (na refresh).
  useEffect(() => { setLocalPrice(String(effectivePrice(item))); }, [item]);

  const onInput = (value: string) => {
    setLocalPrice(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onPrice(item.id, value), 500);
  };

  return (
    <div className={"gear__item" + (item.have ? " checked" : "")}>
      <button
        className="gear__box"
        role="checkbox"
        aria-checked={item.have}
        aria-label={`${item.name} afvinken`}
        onClick={() => onToggle(item.id)}
      >
        {item.have ? "✓" : ""}
      </button>
      <div className="gear__txt">
        <span className="gear__lbl">{item.name}</span>
        {item.description && <span className="gear__desc">{item.description}</span>}
        {tags.length > 0 && (
          <span className="gear__tags">
            {tags.map((code) => (
              <span key={code} className={"t " + GEAR_TAGS[code].cls}>{GEAR_TAGS[code].label}</span>
            ))}
          </span>
        )}
        {item.sharedKey && <span className="gear__shared">Gedeeld tussen sporten · prijs en vinkje gesynchroniseerd</span>}
        {item.options && item.options.length > 0 && (
          <div className="gear__options" aria-label={`Aanbevolen opties voor ${item.name}`}>
            {item.options.map((option, index) => (
              <div key={`${option.label}-${index}`} className="gear__option" data-selected={item.chosenOption === index}>
                <button type="button" onClick={() => onChooseOption(item.id, index)} aria-pressed={item.chosenOption === index}>
                  <span><b>{option.label}</b>{option.size && <i>Maat {option.size}</i>}</span>
                  {option.note && <small>{option.note}</small>}
                  <strong>{eur(option.price)} <em>{item.chosenOption === index ? "Gekozen" : "Kies"}</em></strong>
                </button>
                {isSecond && (
                  <a href={mpUrl(option.query || option.label)} target="_blank" rel="noopener" aria-label={`${option.label} zoeken op Marktplaats`}>
                    Zoek dit model 2e-hands
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
        <span className="gear__actions">
          <a className="gear__btn zoek" href={shopUrl(chosenOption?.query || item.searchQuery || item.name)} target="_blank" rel="noopener">Nieuw zoeken</a>
          {item.productUrl && <a className="gear__btn" href={item.productUrl} target="_blank" rel="noopener">Productlink</a>}
          {isSecond && (
            <a className="gear__btn mp" href={mpUrl(chosenOption?.query || item.searchQuery || item.name)} target="_blank" rel="noopener">Marktplaats</a>
          )}
          <span className="gear__price">
            <span className="eu">€</span>
            <input
              type="number" inputMode="decimal" min="0" step="1" value={price}
              onChange={(e) => onInput(e.target.value)} aria-label={`Prijs voor ${item.name}`}
            />
          </span>
          <button className="gear__remove" title="Item verwijderen" aria-label={`${item.name} verwijderen`} onClick={() => onRemove(item.id)}>✕</button>
        </span>
      </div>
    </div>
  );
}

function ManualItemForm({
  onCancel, onSave,
}: {
  onCancel: () => void;
  onSave: (input: { name: string; description?: string; tags?: string[]; price?: number; productUrl?: string }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [foundPrice, setFoundPrice] = useState("");
  const [priceBusy, setPriceBusy] = useState(false);
  const [priceMessage, setPriceMessage] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const toggleTag = (code: string) =>
    setTags((prev) => (prev.includes(code) ? prev.filter((t) => t !== code) : [...prev, code]));

  async function fetchPrice() {
    if (!productUrl.trim()) return;
    setPriceBusy(true);
    setPriceMessage(null);
    try {
      const response = await fetch("/api/gear-price-preview", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: productUrl }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Prijs ophalen is niet gelukt.");
      setFoundPrice(String(data.price));
      setPriceMessage(`Beste gevonden prijs op deze pagina: ${eur(data.price)}`);
    } catch (error) {
      setPriceMessage(error instanceof Error ? error.message : "Prijs ophalen is niet gelukt.");
    } finally {
      setPriceBusy(false);
    }
  }

  return (
    <div className="gear__manual">
      <input placeholder="Naam" value={name} onChange={(e) => setName(e.target.value)} aria-label="Itemnaam" />
      <input placeholder="Omschrijving (optioneel)" value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Omschrijving" />
      <div className="gear__manual-link">
        <input type="url" placeholder="Link naar product of webshop" value={productUrl} onChange={(e) => setProductUrl(e.target.value)} aria-label="Productlink" />
        <button className="gear__btn" type="button" disabled={!productUrl.trim() || priceBusy} onClick={fetchPrice}>{priceBusy ? "Ophalen…" : "Beste prijs ophalen"}</button>
      </div>
      {priceMessage && <span className="gear__price-message">{priceMessage}</span>}
      <label className="gear__manual-price">Prijs € <input type="number" min="0" step="1" value={foundPrice} onChange={(e) => setFoundPrice(e.target.value)} placeholder="0" /></label>
      <div className="gear__manual-tags">
        {(Object.keys(GEAR_TAGS) as (keyof typeof GEAR_TAGS)[]).map((code) => (
          <button key={code} type="button" className={"t " + GEAR_TAGS[code].cls + (tags.includes(code) ? " on" : "")} onClick={() => toggleTag(code)}>
            {GEAR_TAGS[code].label}
          </button>
        ))}
      </div>
      <div className="gear__manual-actions">
        <button className="btn btn--solid" type="button" disabled={!name.trim()} onClick={() => onSave({ name, description, tags, productUrl, price: foundPrice === "" ? undefined : Number(foundPrice) })}>Bewaar</button>
        <button className="gear__btn" type="button" onClick={onCancel}>Annuleer</button>
      </div>
    </div>
  );
}
