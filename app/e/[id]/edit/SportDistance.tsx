"use client";

import { useState } from "react";
import { SPORTS, distanceGroupsForSport } from "@/lib/distances";

/** Sport + afstand als gekoppeld paar: de afstand-opties volgen de sportkeuze.
 *  Zelfsturend, gevuld met de huidige waarden van het event. */
export default function SportDistance({
  initialSport,
  initialDistance,
}: {
  initialSport: string;
  initialDistance: string;
}) {
  const [sport, setSport] = useState(initialSport || "Hardlopen");
  const [distance, setDistance] = useState(initialDistance);

  const groups = distanceGroupsForSport(sport);
  const visible = new Set(groups.flatMap((g) => g.options));

  return (
    <div className="form__two">
      <div>
        <label htmlFor="sport">Sport</label>
        <select id="sport" name="sport" value={sport} onChange={(e) => setSport(e.target.value)}>
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
          value={distance}
          onChange={(e) => setDistance(e.target.value)}
        >
          <option value="">— kies —</option>
          {distance && !visible.has(distance) && <option value={distance}>{distance}</option>}
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
  );
}
