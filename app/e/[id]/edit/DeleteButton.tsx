"use client";

/**
 * Verwijderen is onomkeerbaar, dus een harde bevestiging ervoor. De actie zelf
 * is een server action die als prop binnenkomt.
 */
export default function DeleteButton({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Dit event definitief verwijderen? Dit kan niet ongedaan worden gemaakt.")) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="form__delete">
        Verwijder dit event
      </button>
    </form>
  );
}
