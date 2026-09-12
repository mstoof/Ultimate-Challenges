import { amsterdamDateTime, parseAmsterdam, TIME_ZONE } from "./timezone";
import type { Event } from "@/db/schema";

/** Een event met een vaste datum. "Ooit"-events (startsAt null) horen niet in een agenda. */
export type DatedEvent = Event & { startsAt: Date };

export function isDated(event: Event): event is DatedEvent {
  return event.startsAt != null;
}

const DOMAIN = process.env.NEXT_PUBLIC_SITE_URL ?? "https://startlijst.vercel.app";

/** RFC 5545 wil CRLF en tekst-escaping van , ; \ en newlines. */
function esc(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Regels mogen max 75 octets zijn. Langer moet gevouwen worden met CRLF + spatie.
 * Zonder dit weigert Outlook lange beschrijvingen en kapt Google ze af.
 */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let start = 0;
  while (start < bytes.length) {
    const size = out.length === 0 ? 75 : 74;
    let end = Math.min(start + size, bytes.length);
    // niet midden in een multibyte-teken knippen
    while (end > start && end < bytes.length && (bytes[end] & 0xc0) === 0x80) end--;
    out.push((out.length === 0 ? "" : " ") + bytes.subarray(start, end).toString("utf8"));
    start = end;
  }
  return out.join("\r\n");
}

/** 2026-10-18T13:15:00+02:00 -> 20261018T111500Z */
function utc(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

// Modern Europe/Amsterdam rules (CET/CEST, effective since 1996).
// Embed them so standalone .ics files work without the calendar's default zone.
const AMSTERDAM_TIMEZONE = [
  "BEGIN:VTIMEZONE", `TZID:${TIME_ZONE}`, `X-LIC-LOCATION:${TIME_ZONE}`,
  "BEGIN:DAYLIGHT", "DTSTART:19960331T020000", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200",
  "TZNAME:CEST", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
  "BEGIN:STANDARD", "DTSTART:19961027T030000", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100",
  "TZNAME:CET", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
  "END:VTIMEZONE",
];

function eventTime(property: "DTSTART" | "DTEND", date: Date): string {
  const local = amsterdamDateTime(date);
  // The second occurrence of 02:xx during autumn cannot be expressed
  // unambiguously with TZID. Retain its exact instant using UTC in that case.
  if (date.getUTCFullYear() < 1996 || parseAmsterdam(local).getTime() !== Math.floor(date.getTime() / 1000) * 1000) {
    return `${property}:${utc(date)}`;
  }
  return `${property};TZID=${TIME_ZONE}:${local.replace(/[-:]/g, "")}`;
}

function defaultEnd(event: DatedEvent): Date {
  if (event.endsAt) return event.endsAt;
  return new Date(event.startsAt.getTime() + 3 * 60 * 60 * 1000); // 3 uur is een redelijke gok
}

function summaryOf(event: Event): string {
  return event.distance ? `${event.title} (${event.distance})` : event.title;
}

function vevent(event: DatedEvent): string[] {
  const url = `${DOMAIN}/e/${event.slug}`;
  const body = [event.description, `Aanmelden en support: ${url}`]
    .filter(Boolean)
    .join("\n\n");

  return [
    "BEGIN:VEVENT",
    fold(`UID:${event.id}@startlijst`),
    `DTSTAMP:${utc(new Date())}`,
    eventTime("DTSTART", event.startsAt),
    eventTime("DTEND", defaultEnd(event)),
    // Elke wijziging krijgt een hogere SEQUENCE, anders negeren agenda-apps de update.
    `SEQUENCE:${Math.floor(event.updatedAt.getTime() / 1000)}`,
    fold(`SUMMARY:${esc(summaryOf(event))}`),
    fold(`LOCATION:${esc(event.location)}`),
    fold(`DESCRIPTION:${esc(body)}`),
    fold(`URL:${url}`),
    "END:VEVENT",
  ];
}

/** Volledige feed met expliciete Amsterdamse tijdzone en zomer-/wintertijd. */
export function buildFeed(events: Event[]): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ultimate Challenges//NL",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Ultimate Challenges",
    `X-WR-TIMEZONE:${TIME_ZONE}`,
    ...AMSTERDAM_TIMEZONE,
    // Hint aan Google/Apple hoe vaak ze mogen verversen. Google houdt zich er
    // maar half aan, vandaar dat we per event ook een directe knop aanbieden.
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H",
    // Ooit-events hebben geen datum en horen dus niet in de agenda.
    ...events.filter(isDated).flatMap(vevent),
    "END:VCALENDAR",
  ].join("\r\n");
}

/** Losse .ics voor één event: werkt in Samsung Agenda, Outlook, Apple Agenda. */
export function buildSingle(event: DatedEvent): string {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Ultimate Challenges//NL",
    "METHOD:PUBLISH",
    "CALSCALE:GREGORIAN",
    `X-WR-TIMEZONE:${TIME_ZONE}`,
    ...AMSTERDAM_TIMEZONE,
    ...vevent(event),
    "END:VCALENDAR",
  ].join("\r\n");
}

/**
 * De betrouwbaarste route op Android: deze URL opent de Google Agenda-app
 * direct met een ingevuld nieuw event. Geen abonnement, geen syncvertraging.
 */
export function googleCalendarUrl(event: DatedEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: summaryOf(event),
    dates: `${utc(event.startsAt)}/${utc(defaultEnd(event))}`,
    location: event.location,
    details: [event.description, `${DOMAIN}/e/${event.slug}`].filter(Boolean).join("\n\n"),
    ctz: TIME_ZONE,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
