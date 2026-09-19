import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  uuid,
  integer,
  date,
  jsonb,
  boolean,
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
    // Wanneer dit lid naar het event afreist. Preset-code (zie TRAVEL_PLANS in
    // app/e/[id]/page.tsx): "day-before" | "eve-before" | "morning" | "unsure".
    travelPlan: text("travel_plan"),
    transportMode: text("transport_mode"), // car | train | plane | other
    seatsAvailable: integer("seats_available"),
    needsRide: boolean("needs_ride").notNull().default(false),
    arrivalAt: timestamp("arrival_at", { withTimezone: true }),
    departureAt: timestamp("departure_at", { withTimezone: true }),
    accommodation: text("accommodation"),
    bookingUrl: text("booking_url"),
    stayFrom: date("stay_from"),
    stayUntil: date("stay_until"),
    travelCostCents: integer("travel_cost_cents"),
    travelContact: text("travel_contact"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.eventId, t.userId] }), // één antwoord per persoon per event
  })
);

/** Gezamenlijke uitgaven die over de deelnemers/support verdeeld kunnen worden. */
export const eventCosts = pgTable("event_costs", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  amountCents: integer("amount_cents").notNull(),
  paidBy: uuid("paid_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Kleine taken en deadlines op het event-dashboard. */
export const eventTasks = pgTable("event_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  dueDate: date("due_date"),
  done: boolean("done").notNull().default(false),
  createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
  gymSplits: text("gym_splits").notNull().default("[]"), // JSON: push, pull, legs, upper, lower, full, core
  experience: text("experience"), // vrij veld: huidig niveau / km per week
  recoveryMethods: text("recovery_methods").notNull().default("[]"), // JSON: sauna, ijsbad, mobiliteit, etc.
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

/** OAuth credentials stay server-side and are encrypted separately for each member. */
export const notionConnections = pgTable("notion_connections", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  workspaceId: text("workspace_id").notNull(),
  workspaceName: text("workspace_name").notNull(),
  botId: text("bot_id").notNull(),
  parentPageId: text("parent_page_id"),
  databaseId: text("database_id"),
  dataSourceId: text("data_source_id"),
  pageMap: jsonb("page_map").$type<Record<string, string>>().notNull().default({}),
  exportJob: jsonb("export_job").$type<import("@/lib/notion/format").ExportJob>(),
  lastExportedAt: timestamp("last_exported_at", { withTimezone: true }),
  lockId: text("lock_id"),
  lockUntil: timestamp("lock_until", { withTimezone: true }),
});
export type NotionConnection = typeof notionConnections.$inferSelect;

/* ------------------------------ uitrusting ------------------------------ */

/**
 * De sporten waarvoor een lid uitrusting bijhoudt. Losstaand van het
 * trainingsprofiel: op de gear-pagina kies je zelf welke sporten je volgt.
 * PK (userId, sport) → één rij per sport per lid.
 */
export const gearSports = pgTable(
  "gear_sports",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sport: text("sport").notNull(), // vrij veld, meestal uit SPORTS (lib/distances.ts)
    targetEventId: uuid("target_event_id").references(() => events.id, { onDelete: "set null" }),
    tripCountry: text("trip_country"),
    tripDate: date("trip_date"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.sport] }),
  })
);

/**
 * Eén uitrustingsitem. Zowel door de AI gegenereerd als handmatig toegevoegd.
 * We bundelen afvinken (have) en prijs in dezelfde rij: items zijn al per lid,
 * dus een aparte "done"-tabel zoals bij trainingen is hier niet nodig.
 * De effectieve prijs is price ?? estPrice (zie lib/gear.ts).
 */
export const gearItems = pgTable(
  "gear_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sport: text("sport").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    // JSON-array met codes: "tw" (tweedehands kan), "no" (nieuw kopen),
    // "ch" (keuze maken), "op" (optioneel). Zie GEAR_TAGS in lib/gear.ts.
    tags: text("tags").notNull().default("[]"),
    searchQuery: text("search_query"), // zoekterm voor de shop-link
    productUrl: text("product_url"), // handmatig gekozen product-/webshoplink
    estPrice: integer("est_price").notNull().default(0), // AI-richtprijs in hele euro's
    price: integer("price"), // handmatige prijs; null = val terug op estPrice
    have: boolean("have").notNull().default(false), // afgevinkt / al in bezit
    aiGenerated: boolean("ai_generated").notNull().default(false),
    // Dezelfde fysieke aankoop in meerdere sporten, bv. "bike-gps".
    // Checkbox en handmatige prijs worden voor items met dezelfde sleutel gesynchroniseerd.
    sharedKey: text("shared_key"),
    // 2–3 concrete productopties die de AI voorstelt (model/maat/prijsklasse),
    // afgestemd op de lichaamsmaten uit gear_profiles. Zie GearOption.
    options: jsonb("options").$type<GearOption[]>(),
    // Index in options[] die het lid koos; null = nog geen keuze.
    chosenOption: integer("chosen_option"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userSportIdx: index("gear_items_user_sport_idx").on(t.userId, t.sport),
  })
);

/** Eén concrete productkeuze die de AI voorstelt bij een gear-item. */
export type GearOption = {
  label: string; // "Salomon X Ultra 4 GTX"
  note?: string; // korte reden/aandachtspunt
  price: number; // richtprijs in hele euro's
  size?: string; // aanbevolen maat, bv. "43" of "M"
  query?: string; // eigen Google-Shopping-zoekterm voor deze optie
};

/**
 * Lichaamsmaten voor de gear-pagina. Losstaand van trainingProfiles (dat heeft
 * geen lengte/gewicht): de AI gebruikt deze om maten en modellen te kiezen.
 */
export const gearProfiles = pgTable("gear_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  heightCm: integer("height_cm"),
  weightKg: integer("weight_kg"),
  shoeSize: text("shoe_size"), // EU-maat als tekst, bv. "43" of "43,5"
  clothingSize: text("clothing_size"), // bv. "M" of "L/XL"
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GearSport = typeof gearSports.$inferSelect;
export type GearItem = typeof gearItems.$inferSelect;
export type GearProfile = typeof gearProfiles.$inferSelect;
