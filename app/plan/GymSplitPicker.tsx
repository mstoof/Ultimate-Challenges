"use client";

import { useId, useState } from "react";
import { GYM_SPLITS } from "@/lib/gym-splits";

export default function GymSplitPicker({ initialSplits = [] }: { initialSplits?: string[] }) {
  const [selected, setSelected] = useState(initialSplits);
  const hintId = useId();
  return (
    <fieldset className="quiz__splits" aria-describedby={hintId}>
      <legend>Welke volledige split wil je trainen?</legend>
      <p className="quiz__hint" id={hintId}>Kies één compleet systeem. Push / Pull / Legs en Upper / Lower zijn elk één split; de coach wisselt de fases af binnen je gymdagen.</p>
      <div className="quiz__chips">
        {GYM_SPLITS.map((split) => (
          <label key={split.id} className={`quiz__chip${selected.includes(split.id) ? " quiz__chip--on" : ""}`}>
            <input type="radio" name="gymSplits" value={split.id} checked={selected.includes(split.id)}
              onChange={() => setSelected([split.id])} />
            <span>{split.label}<small className="quiz__split-focus">{split.focus}</small><small className="quiz__split-focus">{split.days}</small></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
