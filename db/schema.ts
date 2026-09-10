import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  uuid,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";

/**
 * Support crew is geen aparte tabel maar gewoon een rol op de aanmelding.
 * Scheelt joins en je kunt later rollen toevoegen (fotograaf, bezemwagen)
 * zonder migratie van de structuur.
 */
export const rsvpRole = pgEnum("rsvp_role", ["run", "support", "maybe", "no"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  // Deze twee verwacht de Auth.js adapter. emailVerified wordt gezet zodra
  // iemand voor het eerst op een magic link klikt.
  emailVerified: timestamp("email_verified", { withTimezone: true }),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(), // in de deel-URL: /e/halve-van-amsterdam
    title: text("title").notNull(),
    sport: text("sport").notNull(), // "Hardlopen", "Obstacle run", "Squash"
    distance: text("distance"), // vrij veld: "21,1 km", "2 uur", "best of 5"
    location: text("location").notNull(),
    // timestamptz: opslaan in UTC, weergeven in Europe/Amsterdam.
    // Voorkomt dat de zomertijd je ICS-feed een uur verschuift.
    // Nullable: een "ooit"-event (bucketlist) heeft nog geen datum.
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    description: text("description"),
    signupUrl: text("signup_url"), // link naar de officiele inschrijving / het event
    price: text("price"), // deelnamekosten, vrij veld: "€45", "vanaf €50", "Gratis"
    imageUrl: text("image_url"), // logo/afbeelding van het merk; leeg = val terug op favicon of emoji
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    // Bumpt bij elke wijziging. Wordt de SEQUENCE in de ICS, zodat agenda-apps
    // een gewijzigd event bijwerken in plaats van dubbel toevoegen.
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    startsAtIdx: index("events_starts_at_idx").on(t.startsAt),
  })
);

export const rsvps = pgTable(
  "rsvps",
  {
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: rsvpRole("role").notNull(),
    comment: text("comment"), // "kom pas na km 10 kijken"
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.eventId, t.userId] }), // één antwoord per persoon per event
  })
);

export type Event = typeof events.$inferSelect;
export type Rsvp = typeof rsvps.$inferSelect;
