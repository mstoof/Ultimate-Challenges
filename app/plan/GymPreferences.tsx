"use client";

import { useActionState, useState } from "react";
import GymSplitPicker from "./GymSplitPicker";
import { saveGymPreferences } from "./actions";

export default function GymPreferences({ gymDays, gymSplits }: { gymDays: number; gymSplits: string[] }) {
  const [days, setDays] = useState(String(gymDays));
  const [result, action, pending] = useActionState(saveGymPreferences, null);
  return (
    <details className="plan__gym">
      <summary aria-label="Gymvoorkeuren" title="Gymvoorkeuren"><svg className="plan__tool-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6M7 7v10M10 10h4v4h-4M17 7v10M20 9v6M7 12h10" /></svg> Gym</summary>
      <form action={action}>
        <p>Richt je krachttraining op één compleet splitsysteem.</p>
        <label htmlFor="plan-gym-days">Krachttraining (dagen/week)</label>
        <input id="plan-gym-days" name="gymDays" type="number" min="0" max="7" required value={days} onChange={(event) => setDays(event.target.value)} />
        {Number(days) > 0 && <GymSplitPicker initialSplits={gymSplits} />}
        <p className="quiz__hint">Je voorkeuren gelden voor nieuwe of opnieuw gegenereerde blokken. Je huidige plan blijft bewaard.</p>
        <button className="btn btn--solid" type="submit" disabled={pending}>{pending ? "Opslaan…" : "Bewaar gymvoorkeuren"}</button>
        {result && <p role="status">{result.message}</p>}
      </form>
    </details>
  );
}
