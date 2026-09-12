import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  uuid,
  integer,
  date,
  jsonb,
  primaryKey,
  unique,
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
  // "member" of "admin". Super-admin is vast op e-mailadres (zie lib/admin.ts).
  role: text("role").notNull().default("member"),
  // Laatste keer dat iemand de app opende — voor het ledenoverzicht.
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
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

/* ------------------------------ trainingsplan ---------------------------- */

/**
 * De vragenlijst: één rij per lid. Alles wat de AI nodig heeft om een plan te
 * bouwen. sports en longRunDays zijn JSON-arrays als tekst (geen aparte tabel;
 * het is een persoonlijke instelling, geen relatie waar je op joint).
 */
export const trainingProfiles = pgTable("training_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  sports: text("sports").notNull().default("[]"), // JSON: ["Hardlopen","Fietsen"]
  longRunDays: text("long_run_days").notNull().default("[]"), // JSON: ["za","zo"]
  sessionsPerWeek: integer("sessions_per_week").notNull().default(4),
  gymDays: integer("gym_days").notNull().default(0), // 0 = geen kracht/gym
  experience: text("experience"), // vrij veld: huidig niveau / km per week
  goal: text("goal"), // "wat wil je kunnen worden / doen"
  // Voor de hartslagzones (zones 1–5). age → schatting max-HR als maxHr leeg is;
  // restHr maakt de Karvonen-berekening (hartslagreserve) mogelijk.
  age: integer("age"),
  maxHr: integer("max_hr"),
  restHr: integer("rest_hr"),
  targetRace: text("target_race"), // handmatige doelrace (naast de RSVP-races)
  targetRaceDate: date("target_race_date"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Eén gegenereerd blok van (max) 10 weken. De weken zelf staan als jsonb: door
 * de AI gemaakte, geneste structuur die we niet relationeel willen uitsplitsen.
 * Zie het TrainingWeeks-type hieronder voor de vorm.
 */
export const trainingBlocks = pgTable(
  "training_blocks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    blockIndex: integer("block_index").notNull(), // 0, 1, 2 … volgorde
    startDate: date("start_date").notNull(), // maandag waarop het blok begint
    weeks: jsonb("weeks").$type<TrainingPlan>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Eén blok per index per lid; upsert bij opnieuw genereren mikt hierop.
    userBlock: unique("training_blocks_user_block").on(t.userId, t.blockIndex),
  })
);

/**
 * Afgevinkte sessies. Zelfde toggle-patroon als rsvps: bestaat de rij, dan is
 * de sessie gedaan. sessionId = "<blockId>:<week>:<index>", stabiel per sessie.
 */
export const trainingDone = pgTable(
  "training_done",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionId: text("session_id").notNull(),
    doneAt: timestamp("done_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.sessionId] }),
  })
);

/** De vorm van trainingBlocks.weeks. De AI vult dit; de server kent de id's toe. */
/** Eén krachtoefening binnen een gym-sessie: naam + voorschrift (sets×reps, RPE, rust). */
export type TrainingExercise = {
  name: string; // "Back squat", "Romanian deadlift"
  prescription: string; // "4×8 @ RPE 7, 90s rust"
};
export type TrainingSession = {
  id: string; // "<blockId>:<week>:<index>"
  day: string; // "ma".."zo"
  type: "run" | "gym" | "cross" | "brick" | "rust";
  title: string; // "Duurloop", "Kracht: benen", "Intervals 6×800m"
  duration: string; // "45 min", "10 km"
  detail: string; // uitleg / uitvoering
  // Alleen voor type "gym": precies 6 oefeningen. Leeg bij de overige types.
  exercises?: TrainingExercise[];
};
export type TrainingWeek = {
  week: number; // absoluut weeknummer over blokken heen
  startDate: string; // "YYYY-MM-DD"
  theme: string; // "Rustige opbouw"
  note: string; // coach-notitie voor de week
  sessions: TrainingSession[];
};
export type TrainingPlan = {
  focus: string; // waar dit blok op mikt
  weeks: TrainingWeek[];
};

export type Event = typeof events.$inferSelect;
export type Rsvp = typeof rsvps.$inferSelect;
export type TrainingProfile = typeof trainingProfiles.$inferSelect;
export type TrainingBlock = typeof trainingBlocks.$inferSelect;
