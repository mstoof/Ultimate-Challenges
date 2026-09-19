import Link from "next/link";
import { asc, inArray, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events, rsvps, users } from "@/db/schema";
import type { Event } from "@/db/schema";
import { auth, signOut } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { sportEmoji, logoSrc } from "@/lib/logo";
import Logo from "./Logo";
import Brand from "./Brand";
import { AppleIcon, GoogleIcon } from "./icons";

export const dynamic = "force-dynamic";

const DAYS = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const MONTHS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function until(date: Date) {
  const days = Math.ceil((date.getTime() - Date.now()) / 86400000);
  if (days === 0) return "vandaag";
  if (days === 1) return "morgen";
  if (days < 14) return `over ${days} dagen`;
  if (days < 60) return `over ${Math.round(days / 7)} weken`;
  return `over ${Math.round(days / 30)} maanden`;
}

export default async function Home() {
  const session = await auth();

  // Registreer dat dit lid de app opende (voor het admin-ledenoverzicht).
  if (session?.user?.id) {
    await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, session.user.id));
  }
  const admin = isAdmin(session?.user?.email, session?.user?.role);

  // Gisteren als ondergrens: een event van vanochtend wil je vandaag nog zien.
  const since = new Date(Date.now() - 86400000);
  const rows = await db.select().from(events).orderBy(asc(events.startsAt));

  // Drie lagen: dit jaar, volgend jaar en "ooit" (bucketlist zonder datum).
  // Verlopen events (voor gisteren) vallen weg; ooit-events blijven altijd staan.
  const dated = rows
    .filter((e): e is Event & { startsAt: Date } => e.startsAt != null && e.startsAt >= since)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  // Ooit-lijst: nieuwste bovenaan (zo staat de laatst toegevoegde, Norseman, top).
  const someday = rows
    .filter((e) => e.startsAt == null)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const thisYear = new Date().getFullYear();
  // Dit jaar en volgend jaar zijn er altijd; extra jaren alleen als er events zijn.
  const years = Array.from(
    new Set([thisYear, thisYear + 1, ...dated.map((e) => e.startsAt.getFullYear())])
  ).sort((a, b) => a - b);

  const shown = [...dated, ...someday];
  const all = shown.length
    ? await db.select().from(rsvps).where(inArray(rsvps.eventId, shown.map((e) => e.id)))
    : [];

  const countFor = (eventId: string, role: string) =>
    all.filter((r) => r.eventId === eventId && r.role === role).length;
  const mineFor = (eventId: string) =>
    all.find((r) => r.eventId === eventId && r.userId === session?.user?.id)?.role;

  function row(event: Event) {
    const runners = countFor(event.id, "run");
    const support = countFor(event.id, "support");
    const mine = mineFor(event.id);
    const d = event.startsAt;

    return (
      <li key={event.id}>
        <Link href={`/e/${event.slug}`} className="home__row">
          <Logo src={logoSrc(event.imageUrl, null)} fallbackSrc={logoSrc(null, event.signupUrl)} emoji={sportEmoji(event.sport)} />
          <span className="home__rail">
            {d ? (
              <>
                <span className="home__wd">{DAYS[d.getDay()]}</span>
                <span className="home__day">{d.getDate()}</span>
                <span className="home__mo">{MONTHS[d.getMonth()]}</span>
              </>
            ) : (
              <span className="home__someday">ooit</span>
            )}
          </span>
          <span className="home__body">
            <span className="home__title">{event.title}</span>
            <span className="home__meta">
              {event.sport}
              {event.distance ? ` · ${event.distance}` : ""} · {event.location}
              {event.price ? ` · ${event.price}` : ""}
              {d ? ` · ${until(d)}` : ""}
            </span>
            <span className="home__tally">
              <span className="pill pill--run">{runners} doen mee</span>
              <span className="pill pill--support">{support} support</span>
              {mine === "run" && <span className="home__mine">jij loopt mee</span>}
              {mine === "support" && <span className="home__mine">jij bent support</span>}
            </span>
          </span>
        </Link>
      </li>
    );
  }

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  // Abonneren i.p.v. eenmalig downloaden, zodat updates vanzelf binnenkomen.
  // Apple begrijpt webcal://; Google/Android niet, die heeft een eigen
  // "abonneer via URL"-deeplink (feed moet wel via https draaien).
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const webcalUrl = `${site.replace(/^https?:\/\//, "webcal://")}/api/calendar.ics`;
  const googleCalUrl = `https://calendar.google.com/calendar/render?ctz=Europe%2FAmsterdam&cid=${encodeURIComponent(webcalUrl)}`;

  return (
    <main className="home">
      <header className="home__mast">
        <div className="home__brand">
          <Brand />
          <h1>Ultimate Challenges</h1>
        </div>
        <div className="home__account">
          <details className="home__menu">
            <summary className="home__admin">
              Mijn
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
            </summary>
            <div className="home__menu-panel">
              <Link href="/plan">Mijn Plan</Link>
              <Link href="/gear">Mijn Uitrusting</Link>
            </div>
          </details>
          {admin && (
            <Link href="/admin" className="home__admin">
              Admin
            </Link>
          )}
          <form action={logout}>
            <button type="submit" className="home__logout">
              {session?.user?.name ?? "Uitloggen"}
            </button>
          </form>
        </div>
      </header>

      {shown.length === 0 ? (
        <p className="home__empty">
          Niks gepland. Voeg het eerste event toe, dan kan de rest zich aanmelden.
        </p>
      ) : (
        <>
          {years.map((year) => {
            const items = dated.filter((e) => e.startsAt.getFullYear() === year);
            return (
              <section key={year} className="home__section">
                <h2 className="home__heading">{year}</h2>
                {items.length ? (
                  <ol className="home__list">{items.map(row)}</ol>
                ) : (
                  <p className="home__none">Nog niks gepland.</p>
                )}
              </section>
            );
          })}

          <section className="home__section">
            <h2 className="home__heading">Ooit — bucketlist</h2>
            {someday.length ? (
              <ol className="home__list home__scroll">{someday.map(row)}</ol>
            ) : (
              <p className="home__none">Nog niks op de someday-lijst.</p>
            )}
          </section>
        </>
      )}

      <div className="home__foot">
        <Link href="/new" className="btn btn--solid">
          Event toevoegen
        </Link>
        <a href={webcalUrl} className="btn btn--icon" aria-label="Abonneer via Apple Agenda">
          <AppleIcon />
        </a>
        <a
          href={googleCalUrl}
          target="_blank"
          rel="noreferrer"
          className="btn btn--icon"
          aria-label="Abonneer via Google Agenda"
        >
          <GoogleIcon />
        </a>
      </div>
    </main>
  );
}
