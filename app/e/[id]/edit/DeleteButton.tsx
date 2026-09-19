"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

/** De echte verwijderknop, met een directe "Verwijderen…"-status zodra je klikt.
 *  Die status schildert meteen, dus het scherm reageert direct (lage INP) ook al
 *  duurt de server-actie + navigatie nog even. */
function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="form__delete form__delete--go" disabled={pending}>
      {pending ? "Verwijderen…" : "Ja, verwijder"}
    </button>
  );
}

/**
 * Verwijderen is onomkeerbaar, dus een bevestiging ervoor — maar geen blokkerende
 * native confirm(). Eén klik "wapent" de knop (schildert meteen), de tweede klik
 * voert de server-actie uit.
 */
export default function DeleteButton({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <button type="button" className="form__delete" onClick={() => setArmed(true)}>
        Verwijder dit event
      </button>
    );
  }

  return (
    <form action={action} className="form__confirm">
      <span className="form__confirm-text">Zeker weten? Dit kan niet terug.</span>
      <button type="button" className="btn form__confirm-cancel" onClick={() => setArmed(false)}>
        Annuleren
      </button>
      <ConfirmButton />
    </form>
  );
}
