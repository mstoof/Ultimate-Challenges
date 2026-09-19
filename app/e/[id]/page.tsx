import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events, rsvps, users, eventCosts, eventTasks, trainingBlocks, trainingDone, gearSports, gearItems } from "@/db/schema";
import { googleCalendarUrl } from "@/lib/calendar";
import { auth } from "@/lib/auth";
import { sportEmoji, logoSrc } from "@/lib/logo";
import Logo from "@/app/Logo";
import { WhatsAppIcon } from "@/app/icons";
import { parseAmsterdam } from "@/lib/timezone";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
};

// Wanneer iemand naar het event afreist. Preset-codes matchen rsvps.travel_plan.
const TRAVEL_PLANS = [
  { code: "day-before", label: "Dag ervoor" },
  { code: "eve-before", label: "Avond ervoor" },
  { code: "morning", label: "Ochtend zelf" },
  { code: "unsure", label: "Weet ik nog niet" },
] as const;
const TRAVEL_LABEL: Record<string, string> = Object.fromEntries(
  TRAVEL_PLANS.map((p) => [p.code, p.label])
);

async function getEvent(slug: string) {
  const [event] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
  if (!event) return null;

  const [attending, costs, tasks] = await Promise.all([
    db.select({
      name: users.name, userId: users.id, role: rsvps.role, travelPlan: rsvps.travelPlan,
      transportMode: rsvps.transportMode, seatsAvailable: rsvps.seatsAvailable, needsRide: rsvps.needsRide,
      arrivalAt: rsvps.arrivalAt, departureAt: rsvps.departureAt, accommodation: rsvps.accommodation,
      bookingUrl: rsvps.bookingUrl, stayFrom: rsvps.stayFrom, stayUntil: rsvps.stayUntil,
      travelCostCents: rsvps.travelCostCents, travelContact: rsvps.travelContact,
    }).from(rsvps).innerJoin(users, eq(users.id, rsvps.userId)).where(eq(rsvps.eventId, event.id)),
    db.select({ id: eventCosts.id, label: eventCosts.label, amountCents: eventCosts.amountCents, paidBy: eventCosts.paidBy, payer: users.name })
      .from(eventCosts).innerJoin(users, eq(users.id, eventCosts.paidBy)).where(eq(eventCosts.eventId, event.id)).orderBy(asc(eventCosts.createdAt)),
    db.select().from(eventTasks).where(eq(eventTasks.eventId, event.id)).orderBy(asc(eventTasks.done), asc(eventTasks.dueDate), asc(eventTasks.createdAt)),
  ]);

  return { event, attending, costs, tasks };
}

const inputDateTime = (date: Date | null | undefined) => date
  ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date).replace(" ", "T")
  : "";
const euro = (cents: number) => new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(cents / 100);

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
    title: `${event.title} | Ultimate Challenges`,
    description: `${where}. ${runners} aangemeld. Doe je mee of kom je supporten?`,
    openGraph: { type: "website" },
  };
}

export default async function EventPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { new: isNew } = await searchParams;
  const data = await getEvent(id);
  if (!data) notFound();

  const { event, attending, costs, tasks } = data;
  const session = await auth();
  const mineRsvp = attending.find((a) => a.userId === session?.user?.id);
  const mine = mineRsvp?.role;
  const myTravel = mineRsvp?.travelPlan ?? null;

  const [myBlocks, myDone, myGear] = session?.user?.id ? await Promise.all([
    db.select().from(trainingBlocks).where(eq(trainingBlocks.userId, session.user.id)),
    db.select().from(trainingDone).where(eq(trainingDone.userId, session.user.id)),
    db.select({ id: gearItems.id, have: gearItems.have, name: gearItems.name })
      .from(gearSports).innerJoin(gearItems, and(eq(gearItems.userId, gearSports.userId), eq(gearItems.sport, gearSports.sport)))
      .where(and(eq(gearSports.userId, session.user.id), eq(gearSports.targetEventId, event.id))),
  ]) : [[], [], []];
  const sessionIds = myBlocks.flatMap((block) => block.weeks.weeks.flatMap((week) => week.sessions.map((training) => training.id)));
  const doneIds = new Set(myDone.map((done) => done.sessionId));
  const trainingDoneCount = sessionIds.filter((sessionId) => doneIds.has(sessionId)).length;
  const missingGear = myGear.filter((item) => !item.have);

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

  // Reismoment vastleggen. Alleen zinvol als je al een RSVP-rij hebt; daarom
  // updaten we (geen insert) en negeren we het stil als je nog niet meedoet.
  async function setTravel(plan: string) {
    "use server";
    const session = await auth();
    if (!session?.user?.id) throw new Error("Niet ingelogd");
    const valid = TRAVEL_PLANS.some((p) => p.code === plan);
    if (!valid) return;

    await db
      .update(rsvps)
      .set({ travelPlan: plan, updatedAt: new Date() })
      .where(and(eq(rsvps.eventId, event.id), eq(rsvps.userId, session.user.id)));

    revalidatePath(`/e/${event.slug}`);
  }

  async function saveTravelDetails(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session?.user?.id) throw new Error("Niet ingelogd");
    const dateTime = (name: string) => {
      const value = String(formData.get(name) ?? "").trim();
      if (!value) return null;
      const parsed = parseAmsterdam(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    const integer = (name: string, max: number) => {
      const value = Number(formData.get(name));
      return Number.isFinite(value) && value >= 0 ? Math.min(Math.round(value), max) : null;
    };
    const money = String(formData.get("travelCost") ?? "").replace(",", ".");
    const amount = Number(money);
    await db.update(rsvps).set({
      transportMode: String(formData.get("transportMode") ?? "").slice(0, 30) || null,
      seatsAvailable: integer("seatsAvailable", 20),
      needsRide: formData.get("needsRide") === "on",
      arrivalAt: dateTime("arrivalAt"), departureAt: dateTime("departureAt"),
      accommodation: String(formData.get("accommodation") ?? "").trim().slice(0, 160) || null,
      bookingUrl: String(formData.get("bookingUrl") ?? "").trim().slice(0, 1000) || null,
      stayFrom: String(formData.get("stayFrom") ?? "") || null,
      stayUntil: String(formData.get("stayUntil") ?? "") || null,
      travelCostCents: Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) : null,
      travelContact: String(formData.get("travelContact") ?? "").trim().slice(0, 120) || null,
      updatedAt: new Date(),
    }).where(and(eq(rsvps.eventId, event.id), eq(rsvps.userId, session.user.id)));
    revalidatePath(`/e/${event.slug}`);
  }

  async function addCost(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session?.user?.id) throw new Error("Niet ingelogd");
    const label = String(formData.get("label") ?? "").trim().slice(0, 100);
    const amount = Number(String(formData.get("amount") ?? "").replace(",", "."));
    if (!label || !Number.isFinite(amount) || amount <= 0) return;
    await db.insert(eventCosts).values({ eventId: event.id, label, amountCents: Math.round(amount * 100), paidBy: session.user.id });
    revalidatePath(`/e/${event.slug}`);
  }

  async function addTask(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session?.user?.id) throw new Error("Niet ingelogd");
    const title = String(formData.get("title") ?? "").trim().slice(0, 140);
    if (!title) return;
    await db.insert(eventTasks).values({ eventId: event.id, title, dueDate: String(formData.get("dueDate") ?? "") || null, createdBy: session.user.id });
    revalidatePath(`/e/${event.slug}`);
  }

  async function toggleTask(taskId: string) {
    "use server";
    const session = await auth();
    if (!session?.user?.id) throw new Error("Niet ingelogd");
    const [task] = await db.select({ done: eventTasks.done }).from(eventTasks).where(and(eq(eventTasks.id, taskId), eq(eventTasks.eventId, event.id))).limit(1);
    if (!task) return;
    await db.update(eventTasks).set({ done: !task.done }).where(and(eq(eventTasks.id, taskId), eq(eventTasks.eventId, event.id)));
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
  const activePeople = attending.filter((person) => person.role === "run" || person.role === "support");
  const travelReady = activePeople.filter((person) => person.transportMode || person.arrivalAt).length;
  const totalCosts = costs.reduce((sum, cost) => sum + cost.amountCents, 0) + activePeople.reduce((sum, person) => sum + (person.travelCostCents ?? 0), 0);
  const openTasks = tasks.filter((task) => !task.done).length;

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

      <section className="event__dashboard" aria-label="Event-dashboard">
        <div><span>Team</span><strong>{activePeople.length}</strong><small>{group("run").length} deelnemers · {group("support").length} support</small></div>
        <div><span>Reis geregeld</span><strong>{travelReady}/{activePeople.length}</strong><small>{activePeople.filter((person) => person.needsRide).length} zoeken vervoer</small></div>
        <Link href="/plan"><span>Mijn training</span><strong>{sessionIds.length ? `${Math.round(trainingDoneCount / sessionIds.length * 100)}%` : "Geen"}</strong><small>{trainingDoneCount}/{sessionIds.length} sessies voltooid</small></Link>
        <Link href="/gear"><span>Mijn gear</span><strong>{missingGear.length}</strong><small>items ontbreken voor dit event</small></Link>
        <div><span>Gedeelde kosten</span><strong>{euro(totalCosts)}</strong><small>{activePeople.length ? `${euro(Math.round(totalCosts / activePeople.length))} p.p.` : "nog niet verdeeld"}</small></div>
        <div><span>Deadlines</span><strong>{openTasks}</strong><small>openstaande acties</small></div>
      </section>

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

      {(mine === "run" || mine === "support") && (
        <div className="event__travel">
          <span className="event__travel-label">Wanneer ga je?</span>
          <form className="event__travel-choice">
            {TRAVEL_PLANS.map((plan) => (
              <button
                key={plan.code}
                formAction={setTravel.bind(null, plan.code)}
                data-selected={myTravel === plan.code}
              >
                {plan.label}
              </button>
            ))}
          </form>
          <details className="event__travel-details">
            <summary>Vervoer &amp; verblijf plannen</summary>
            <form action={saveTravelDetails}>
              <div className="event__form-grid">
                <label>Vervoer
                  <select name="transportMode" defaultValue={mineRsvp?.transportMode ?? ""}>
                    <option value="">Nog niet gekozen</option><option value="car">Auto</option><option value="train">Trein</option><option value="plane">Vliegtuig</option><option value="other">Anders</option>
                  </select>
                </label>
                <label>Vrije plaatsen<input name="seatsAvailable" type="number" min="0" max="20" defaultValue={mineRsvp?.seatsAvailable ?? ""} /></label>
                <label>Aankomst<input name="arrivalAt" type="datetime-local" defaultValue={inputDateTime(mineRsvp?.arrivalAt)} /></label>
                <label>Vertrek terug<input name="departureAt" type="datetime-local" defaultValue={inputDateTime(mineRsvp?.departureAt)} /></label>
              </div>
              <label className="event__inline-check"><input name="needsRide" type="checkbox" defaultChecked={mineRsvp?.needsRide} /> Ik wil meerijden</label>
              <div className="event__form-grid">
                <label>Accommodatie<input name="accommodation" defaultValue={mineRsvp?.accommodation ?? ""} placeholder="Hotel, camping of appartement" /></label>
                <label>Boekingslink<input name="bookingUrl" type="url" defaultValue={mineRsvp?.bookingUrl ?? ""} placeholder="https://…" /></label>
                <label>Verblijf vanaf<input name="stayFrom" type="date" defaultValue={mineRsvp?.stayFrom ?? ""} /></label>
                <label>Verblijf tot<input name="stayUntil" type="date" defaultValue={mineRsvp?.stayUntil ?? ""} /></label>
                <label>Geschatte kosten €<input name="travelCost" inputMode="decimal" defaultValue={mineRsvp?.travelCostCents != null ? mineRsvp.travelCostCents / 100 : ""} /></label>
                <label>Contactpersoon<input name="travelContact" defaultValue={mineRsvp?.travelContact ?? ""} placeholder="Naam of telefoonnummer" /></label>
              </div>
              <button className="btn btn--solid" type="submit">Reisplan bewaren</button>
            </form>
          </details>
        </div>
      )}

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
                  .map((a) => (a.travelPlan ? `${a.name} · ${TRAVEL_LABEL[a.travelPlan] ?? ""}`.trim() : a.name))
                  .join(", ")
              : "Nog niemand."}
          </p>
        </section>
      ))}

      <section className="event__panel">
        <h2>Vervoer &amp; verblijf</h2>
        {activePeople.length ? <div className="event__travel-list">
          {activePeople.map((person) => (
            <article key={person.userId}>
              <strong>{person.name}</strong>
              <span>{person.transportMode === "car" ? `Auto${person.seatsAvailable ? ` · ${person.seatsAvailable} plek(ken) vrij` : ""}` : person.transportMode === "train" ? "Trein" : person.transportMode === "plane" ? "Vliegtuig" : person.transportMode === "other" ? "Anders" : "Vervoer nog open"}</span>
              {person.needsRide && <span className="event__attention">Wil meerijden</span>}
              {person.arrivalAt && <span>Aankomst {person.arrivalAt.toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Amsterdam" })}</span>}
              {person.accommodation && <span>{person.bookingUrl ? <a href={person.bookingUrl} target="_blank" rel="noreferrer">{person.accommodation}</a> : person.accommodation}{person.stayFrom ? ` · vanaf ${person.stayFrom}` : ""}</span>}
              {person.travelContact && <span>Contact: {person.travelContact}</span>}
            </article>
          ))}
        </div> : <p className="event__muted">Nog geen reisplannen.</p>}
      </section>

      <section className="event__panel">
        <h2>Gedeelde kosten</h2>
        {costs.length > 0 && <div className="event__cost-list">{costs.map((cost) => <div key={cost.id}><span>{cost.label}<small>betaald door {cost.payer}</small></span><strong>{euro(cost.amountCents)}</strong></div>)}</div>}
        {session?.user?.id && <form action={addCost} className="event__compact-form"><input name="label" required placeholder="Bijv. hotel of huurauto" /><input name="amount" required inputMode="decimal" placeholder="€ bedrag" /><button className="btn" type="submit">Kosten toevoegen</button></form>}
      </section>

      <section className="event__panel">
        <h2>Deadlines &amp; acties</h2>
        {tasks.length > 0 && <div className="event__task-list">{tasks.map((task) => (
          <form key={task.id} action={toggleTask.bind(null, task.id)} data-done={task.done}>
            <button type="submit" aria-label={`${task.title} ${task.done ? "heropenen" : "afronden"}`}>{task.done ? "✓" : ""}</button>
            <span>{task.title}{task.dueDate && <small>voor {new Date(`${task.dueDate}T12:00:00`).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}</small>}</span>
          </form>
        ))}</div>}
        {session?.user?.id && <form action={addTask} className="event__compact-form"><input name="title" required placeholder="Nieuwe actie of deadline" /><input name="dueDate" type="date" /><button className="btn" type="submit">Toevoegen</button></form>}
      </section>

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
