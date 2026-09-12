"use client";

import { useId, useState } from "react";
import { GYM_SPLITS } from "@/lib/gym-splits";

export default function GymSplitPicker({ initialSplits = [] }: { initialSplits?: string[] }) {
  const [selected, setSelected] = useState(initialSplits);
  const hintId = useId();
  return (
    <fieldset className="quiz__splits" aria-describedby={hintId}>
      <legend>Welke gymsplits wil je trainen?</legend>
      <p className="quiz__hint" id={hintId}>Kies meerdere, bijvoorbeeld Push + Pull + Legs of Upper body + Lower body. We wisselen ze af binnen je gymdagen. Niets gekozen? Dan kiest de coach de indeling.</p>
      <div className="quiz__chips">
        {GYM_SPLITS.map((split) => (
          <label key={split.id} className={`quiz__chip${selected.includes(split.id) ? " quiz__chip--on" : ""}`}>
            <input type="checkbox" name="gymSplits" value={split.id} checked={selected.includes(split.id)}
              onChange={() => setSelected((previous) => previous.includes(split.id) ? previous.filter((id) => id !== split.id) : [...previous, split.id])} />
            <span>{split.label}<small className="quiz__split-focus">{split.focus}</small></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
