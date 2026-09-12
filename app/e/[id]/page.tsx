import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events, rsvps, users } from "@/db/schema";
import { googleCalendarUrl } from "@/lib/calendar";
import { auth } from "@/lib/auth";
import { sportEmoji, logoSrc } from "@/lib/logo";
import Logo from "@/app/Logo";
import { WhatsAppIcon } from "@/app/icons";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
};

async function getEvent(slug: string) {
  const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  if (!event) return null;

  const attending = await db
    .select({ name: users.name, userId: users.id, role: rsvps.role })
    .from(rsvps)
    .innerJoin(users, eq(users.id, rsvps.userId))
    .where(eq(rsvps.eventId, event.id));

  return { event, attending };
}

/** Deze metadata maakt het WhatsApp-kaartje. Zonder dit is het een kale link. */
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const data = await getEvent(id);
  if (!data) return { title: "Niet gevonden" };

  const { event, attending } = data;
  const runners = attending.filter((a) => a.role === "run").length;
  const date = event.startsAt
    ? event.startsAt.toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "long",
        timeZone: "Europe/Amsterdam",
      })
    : null;
  const where = date ? `${date} in ${event.location}` : `Ooit · ${event.location}`;

  return {
    title: `${event.title} — Ultimate Challenges`,
    description: `${where}. ${runners} aangemeld. Doe je mee of kom je supporten?`,
    openGraph: { type: "website" },
  };
}

export default async function EventPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const data = await getEvent(id);
  if (!data) notFound();

  const { event, attending } = data;
  const session = await auth();
  const mine = attending.find((a) => a.userId === session?.user?.id)?.role;

  // Rol gaat via een gebonden argument, niet via een form-veld: React claimt
  // het name-attribuut van een button met een function-formAction voor zichzelf,
  // waardoor formData.get("role") null zou zijn.
  async function respond(role: "run" | "support" | "maybe" | "no") {
    "use server";
    const session = await auth();
    if (!session?.user?.id) throw new Error("Niet ingelogd");

    await db
      .insert(rsvps)
      .values({ eventId: event.id, userId: session.user.id, role })
      .onConflictDoUpdate({
        target: [rsvps.eventId, rsvps.userId],
        set: { role, updatedAt: new Date() },
      });

    revalidatePath(`/e/${event.slug}`);
  }

  const group = (role: string) => attending.filter((a) => a.role === role);
  const when = event.startsAt
    ? event.startsAt.toLocaleString("nl-NL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Amsterdam",
      })
    : "Datum nog niet bekend";

  // Deelbericht voor WhatsApp: één tik opent WhatsApp met tekst + link, jij
  // kiest de groep. Auto-posten in een groep kan met geen enkele officiële API.
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const eventUrl = `${site}/e/${event.slug}`;
  const shareText =
    `Nieuw op Ultimate Challenges: ${event.title}\n` +
    `${when} · ${event.location}${event.price ? ` · ${event.price}` : ""}\n` +
    `Meld je aan of kom supporten: ${eventUrl}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

  const isMine = !!session?.user?.id && session.user.id === event.createdBy;

  return (
    <main className="event">
      <div className="event__top">
        <Link href="/" className="event__back">
          ← Terug naar de agenda
        </Link>
        {isMine && (
          <Link href={`/e/${event.slug}/edit`} className="event__edit">
            Bewerken
          </Link>
        )}
      </div>

      {isNew && (
        <div className="event__new">
          <span>Event geplaatst. Deel &apos;m even in de groep 👇</span>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn--wa btn--icon"
            aria-label="Deel in WhatsApp"
          >
            <WhatsAppIcon />
          </a>
        </div>
      )}

      <div className="event__head">
        <Logo
          src={logoSrc(event.imageUrl, null)}
          fallbackSrc={logoSrc(null, event.signupUrl)}
          emoji={sportEmoji(event.sport)}
          className="event__logo"
        />
        <div className="event__headtext">
          <p className="event__kicker">
            {event.sport}
            {event.distance ? ` · ${event.distance}` : ""}
          </p>
          <h1>{event.title}</h1>
          <p className="event__when">
            {when} · {event.location}
            {event.price ? ` · ${event.price}` : ""}
          </p>
        </div>
      </div>

      {event.description && <p className="event__note">{event.description}</p>}

      <form className="event__choice">
        {(
          [
            { role: "run", label: "Ik doe mee" },
            { role: "support", label: "Support crew" },
            { role: "no", label: "Kan niet" },
          ] as const
        ).map((option) => (
          <button
            key={option.role}
            formAction={respond.bind(null, option.role)}
            data-role={option.role}
            data-selected={mine === option.role}
          >
            {option.label}
          </button>
        ))}
      </form>

      {[
        { role: "run", label: "Doen mee" },
        { role: "support", label: "Support crew" },
      ].map(({ role, label }) => (
        <section key={role} className="event__group">
          <h2>
            {label} · {group(role).length}
          </h2>
          <p>
            {group(role).length
              ? group(role)
                  .map((a) => a.name)
                  .join(", ")
              : "Nog niemand."}
          </p>
        </section>
      ))}

      <div className="event__actions">
        {/* Eén tik: opent WhatsApp met bericht + link, jij kiest de groep. */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="btn--wa btn--icon"
          aria-label="Deel in WhatsApp"
        >
          <WhatsAppIcon />
        </a>
        {/* Agenda-knoppen alleen bij een echte datum; een ooit-event heeft er geen. */}
        {event.startsAt && (
          <>
            {/* Werkt direct in de Google Agenda-app op Android */}
            <a
              href={googleCalendarUrl({ ...event, startsAt: event.startsAt })}
              target="_blank"
              rel="noreferrer"
            >
              Zet in Google Agenda
            </a>
            {/* Voor Samsung Agenda, Outlook en Apple Agenda */}
            <a href={`/api/event/${event.slug}/ics`}>Download .ics</a>
          </>
        )}
        {event.signupUrl && (
          <a href={event.signupUrl} target="_blank" rel="noreferrer">
            Officieel inschrijven
          </a>
        )}
      </div>
    </main>
  );
}
