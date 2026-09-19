import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { auth } from "@/lib/auth";
import { amsterdamInput, parseAmsterdam } from "@/lib/timezone";
import { logoSrc } from "@/lib/logo";
import { safePublicUrl } from "@/lib/safe-url";
import DeleteButton from "./DeleteButton";
import SportDistance from "./SportDistance";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditEventPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { error } = await searchParams;

  const session = await auth();
  if (!session?.user?.id) redirect(`/login?next=/e/${id}/edit`);

  const [event] = await db.select().from(events).where(eq(events.slug, id)).limit(1);
  if (!event) notFound();

  // Alleen wie het event plaatste mag het aanpassen of verwijderen.
  if (event.createdBy !== session.user.id) redirect(`/e/${event.slug}`);

  const eventId = event.id;
  const slug = event.slug;

  const durationHours =
    event.startsAt && event.endsAt
      ? Math.max(1, Math.round((event.endsAt.getTime() - event.startsAt.getTime()) / 3600000))
      : 3;

  async function updateEvent(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session?.user?.id) redirect(`/login?next=/e/${slug}/edit`);

    const title = String(formData.get("title") ?? "").trim();
    const location = String(formData.get("location") ?? "").trim();
    const someday = formData.get("someday") === "on";
    const startsAtRaw = String(formData.get("startsAt") ?? "");
    if (!title || !location || (!someday && !startsAtRaw)) redirect(`/e/${slug}/edit?error=leeg`);

    const signupUrl = String(formData.get("signupUrl") ?? "").trim() || null;
    const imageInput = String(formData.get("imageUrl") ?? "").trim() || null;
    if (imageInput) {
      try { await safePublicUrl(imageInput); }
      catch { redirect(`/e/${slug}/edit?error=link`); }
    }

    let startsAt: Date | null = null;
    let endsAt: Date | null = null;
    if (!someday) {
      startsAt = parseAmsterdam(startsAtRaw);
      if (Number.isNaN(startsAt.getTime())) redirect(`/e/${slug}/edit?error=datum`);
      const hours = Number(formData.get("hours")) || 3;
      endsAt = new Date(startsAt.getTime() + hours * 3600000);
    }

    await db
      .update(events)
      .set({
        title,
        sport: String(formData.get("sport") ?? "Anders"),
        distance: String(formData.get("distance") ?? "").trim() || null,
        location,
        startsAt,
        endsAt,
        description: String(formData.get("description") ?? "").trim() || null,
        signupUrl,
        price: String(formData.get("price") ?? "").trim() || null,
        imageUrl: imageInput || logoSrc(null, signupUrl),
        // Bumpt de SEQUENCE in de ICS, zodat agenda-apps de wijziging oppikken.
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId));

    redirect(`/e/${slug}`);
  }

  async function deleteEvent() {
    "use server";
    const session = await auth();
    if (!session?.user?.id) redirect(`/login?next=/e/${slug}/edit`);
    // rsvps hangen met onDelete cascade, die gaan vanzelf mee.
    await db.delete(events).where(eq(events.id, eventId));
    redirect("/");
  }

  return (
    <main className="form">
      <Link href={`/e/${slug}`} className="form__back">
        ← Terug naar het event
      </Link>
      <h1>Event bewerken</h1>
      <p className="form__lead">Pas de gegevens aan of verzet het event. Aanmeldingen blijven staan.</p>

      {error === "leeg" && <p className="form__error">Naam, locatie en datum zijn verplicht.</p>}
      {error === "datum" && <p className="form__error">Die datum kon ik niet lezen.</p>}
      {error === "link" && <p className="form__error">Gebruik voor een logo een openbare http(s)-link.</p>}

      <form action={updateEvent}>
        <label htmlFor="title">Wat gaan we doen</label>
        <input id="title" name="title" required defaultValue={event.title} />

        <SportDistance initialSport={event.sport} initialDistance={event.distance ?? ""} />

        <label htmlFor="location">Waar</label>
        <input id="location" name="location" required defaultValue={event.location} />

        <div className="form__two">
          <div>
            <label htmlFor="startsAt">Wanneer (Amsterdam)</label>
            <input
              id="startsAt"
              name="startsAt"
              type="datetime-local"
              defaultValue={amsterdamInput(event.startsAt)}
            />
          </div>
          <div>
            <label htmlFor="hours">Duur in uren</label>
            <input id="hours" name="hours" type="number" min="1" max="24" defaultValue={durationHours} />
          </div>
        </div>

        <label className="form__check">
          <input type="checkbox" name="someday" defaultChecked={!event.startsAt} />
          Nog geen datum. Zet dit op de <strong>someday</strong>-lijst (bucketlist)
        </label>

        <label htmlFor="price">Deelnamekosten</label>
        <input
          id="price"
          name="price"
          defaultValue={event.price ?? ""}
          placeholder="€45, vanaf €50 of Gratis"
        />

        <label htmlFor="description">Toelichting</label>
        <textarea id="description" name="description" rows={3} defaultValue={event.description ?? ""} />

        <label htmlFor="signupUrl">Link naar het event / inschrijving</label>
        <input id="signupUrl" name="signupUrl" type="url" defaultValue={event.signupUrl ?? ""} placeholder="https://" />

        <label htmlFor="imageUrl">Logo van het event (URL)</label>
        <input
          id="imageUrl"
          name="imageUrl"
          type="url"
          defaultValue={event.imageUrl ?? ""}
          placeholder="Leeg = icoon van de link"
        />

        <button type="submit" className="btn btn--solid">
          Wijzigingen opslaan
        </button>
      </form>

      <div className="form__danger">
        <DeleteButton action={deleteEvent} />
      </div>
    </main>
  );
}
