import { pgTable, text, timestamp, uuid, primaryKey, integer } from "drizzle-orm/pg-core";
import { users } from "./schema";

/**
 * Hier leven de magic links. De adapter schrijft bij elke inlogpoging een rij
 * met een gehasht token en een vervaltijd; na gebruik wordt de rij verwijderd.
 * Daarom is een link eenmalig: is de rij weg, dan is de link dood.
 */
export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(), // het e-mailadres
    token: text("token").notNull(),
    expires: timestamp("expires", { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  })
);

/** Serverside sessies. Uitloggen = rij weg, dus dat werkt ook op andere apparaten. */
export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { withTimezone: true }).notNull(),
});

/**
 * Alleen nodig als je later "inloggen met Google" toevoegt. De adapter
 * verwacht de tabel hoe dan ook, dus hij staat er nu al leeg bij.
 */
export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
  })
);
