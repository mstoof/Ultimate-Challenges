import { describe, it, expect } from "vitest";
import { buildFeed, buildSingle, googleCalendarUrl, type DatedEvent } from "./calendar";
import type { Event } from "@/db/schema";

/**
 * Tijden staan expliciet met offset in de fixtures. Zo maakt het niet uit
 * in welke tijdzone de CI-runner staat: 13:15+02:00 is altijd hetzelfde moment.
 */
function makeEvent(overrides: Partial<Event> = {}): DatedEvent {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "halve-van-amsterdam",
    title: "Halve van Amsterdam",
    sport: "Hardlopen",
    distance: "21,1 km",
    location: "Amsterdam",
    startsAt: new Date("2026-10-18T13:15:00+02:00"),
    endsAt: new Date("2026-10-18T16:15:00+02:00"),
    description: "Support staat bij km 15.",
    signupUrl: null,
    createdBy: "22222222-2222-2222-2222-222222222222",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  } as DatedEvent;
}

const lines = (ics: string) => ics.split("\r\n");
const find = (ics: string, prefix: string) => lines(ics).find((l) => l.startsWith(prefix));

describe("regelopmaak", () => {
  it("scheidt regels met CRLF en nooit met een kale newline", () => {
    const ics = buildSingle(makeEvent());
    expect(ics).toContain("\r\n");
    // Elke \n moet voorafgegaan worden door \r
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });

  it("houdt elke regel binnen 75 octets", () => {
    const ics = buildSingle(
      makeEvent({ description: "Heel lang verhaal over de route. ".repeat(20) })
    );
    for (const line of lines(ics)) {
      expect(Buffer.byteLength(line, "utf8")).toBeLessThanOrEqual(75);
    }
  });

  it("vouwt zo dat de originele waarde terugkomt na ontvouwen", () => {
    const title = "Ultraloop ".repeat(15).trim();
    const ics = buildSingle(makeEvent({ title, distance: null }));
    // Ontvouwen volgens RFC 5545: CRLF + spatie weghalen
    const unfolded = ics.split("\r\n ").join("");
    expect(unfolded).toContain(`SUMMARY:${title}`);
  });

  it("vouwt niet midden in een multibyte-teken", () => {
    const ics = buildSingle(makeEvent({ description: "Café ".repeat(40) }));
    for (const line of lines(ics)) {
      expect(line).not.toContain("\uFFFD"); // vervangingsteken = kapotte UTF-8
    }
  });
});

describe("escaping", () => {
  it("ontsnapt komma, puntkomma en newline in vrije tekst", () => {
    const ics = buildSingle(
      makeEvent({ description: "Neem water, gel; en droge kleren\nmee." })
    );
    const unfolded = ics.split("\r\n ").join("");
    expect(unfolded).toContain("water\\, gel\\; en droge kleren\\nmee.");
  });

  it("laat de locatie ongemoeid als er niets te ontsnappen valt", () => {
    expect(find(buildSingle(makeEvent()), "LOCATION:")).toBe("LOCATION:Amsterdam");
  });
});

describe("tijdzones", () => {
  it("zet een zomertijd-event om naar UTC met twee uur verschil", () => {
    // 18 oktober valt nog in CEST (+02:00)
    const ics = buildSingle(makeEvent());
    expect(find(ics, "DTSTART:")).toBe("DTSTART:20261018T111500Z");
  });

  it("zet een wintertijd-event om met één uur verschil", () => {
    // 8 november valt na de wissel van eind oktober, dus CET (+01:00)
    const ics = buildSingle(
      makeEvent({
        startsAt: new Date("2026-11-08T10:00:00+01:00"),
        endsAt: new Date("2026-11-08T12:00:00+01:00"),
      })
    );
    expect(find(ics, "DTSTART:")).toBe("DTSTART:20261108T090000Z");
  });

  it("neemt drie uur als er geen eindtijd bekend is", () => {
    const ics = buildSingle(makeEvent({ endsAt: null }));
    expect(find(ics, "DTEND:")).toBe("DTEND:20261018T141500Z");
  });
});

describe("update-gedrag", () => {
  it("verhoogt SEQUENCE als het event later is bijgewerkt", () => {
    const eerst = buildSingle(makeEvent());
    const later = buildSingle(makeEvent({ updatedAt: new Date("2026-06-01T00:00:00Z") }));

    const seq = (ics: string) => Number(find(ics, "SEQUENCE:")!.split(":")[1]);
    expect(seq(later)).toBeGreaterThan(seq(eerst));
  });

  it("houdt de UID stabiel zodat een update geen dubbel event oplevert", () => {
    const a = find(buildSingle(makeEvent()), "UID:");
    const b = find(buildSingle(makeEvent({ title: "Andere naam" })), "UID:");
    expect(a).toBe(b);
  });
});

describe("feed", () => {
  it("verpakt alle events in één kalender", () => {
    const ics = buildFeed([
      makeEvent(),
      makeEvent({ id: "33333333-3333-3333-3333-333333333333", slug: "squash" }),
    ]);

    expect(lines(ics).filter((l) => l === "BEGIN:VEVENT")).toHaveLength(2);
    expect(lines(ics)[0]).toBe("BEGIN:VCALENDAR");
    expect(lines(ics).at(-1)).toBe("END:VCALENDAR");
  });

  it("draagt een naam en tijdzone-hint voor agenda-apps", () => {
    const ics = buildFeed([makeEvent()]);
    expect(ics).toContain("X-WR-CALNAME:Ultimate Challenges");
    expect(ics).toContain("X-WR-TIMEZONE:Europe/Amsterdam");
  });

  it("blijft geldig zonder events", () => {
    const ics = buildFeed([]);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });
});

describe("google-link", () => {
  it("bevat begin- en eindtijd in UTC en de Amsterdamse tijdzone", () => {
    const url = new URL(googleCalendarUrl(makeEvent()));
    expect(url.searchParams.get("dates")).toBe("20261018T111500Z/20261018T141500Z");
    expect(url.searchParams.get("ctz")).toBe("Europe/Amsterdam");
    expect(url.searchParams.get("text")).toBe("Halve van Amsterdam (21,1 km)");
  });

  it("laat de afstand weg als die er niet is", () => {
    const url = new URL(googleCalendarUrl(makeEvent({ distance: null })));
    expect(url.searchParams.get("text")).toBe("Halve van Amsterdam");
  });
});
