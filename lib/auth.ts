import NextAuth from "next-auth";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { accounts, sessions, verificationTokens } from "@/db/auth-schema";
import { magicLinkEmail } from "@/lib/email";

/**
 * Wie mag er in. Een open magic-link login betekent dat iedereen die de URL
 * kent een account kan maken; bij een vriendengroep wil je dat niet.
 * Zet de adressen als komma-gescheiden lijst in ALLOWED_EMAILS.
 */
const allowed = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

// De Auth.js e-mailprovider maakt een user aan met alleen een e-mailadres,
// maar users.name is NOT NULL. Zonder default faalt de insert. We vullen de
// naam daarom met het stuk voor de @; later kan iemand die zelf aanpassen.
const baseAdapter = DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
});

const adapter = {
  ...baseAdapter,
  createUser: (data: Parameters<NonNullable<typeof baseAdapter.createUser>>[0]) =>
    baseAdapter.createUser!({
      ...data,
      name: data.name ?? data.email.split("@")[0],
    }),
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,

  // Sessies in de database in plaats van een JWT: dan kun je iemand
  // daadwerkelijk uitloggen door de rij te verwijderen.
  session: { strategy: "database", maxAge: 60 * 60 * 24 * 90 },

  pages: { signIn: "/login", verifyRequest: "/login?check=1", error: "/login" },

  providers: [
    Resend({
      apiKey: process.env.RESEND_API_KEY,
      from: process.env.EMAIL_FROM ?? "Ultimate Challenges <hallo@startlijst.nl>",
      // Standaard 24 uur. Een kwartier is ruim zat en beperkt het venster
      // waarin een gelekte link nog bruikbaar is.
      maxAge: 15 * 60,
      async sendVerificationRequest({ identifier, url, provider }) {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: provider.from,
            to: identifier,
            subject: "Je inloglink voor Ultimate Challenges",
            html: magicLinkEmail(url),
            text: `Klik om in te loggen bij Ultimate Challenges:\n${url}\n\nDe link werkt 15 minuten en maar één keer.`,
          }),
        });

        if (!res.ok) {
          // Gooit door naar de foutpagina in plaats van stilletjes te slagen.
          throw new Error(`Resend gaf ${res.status}: ${await res.text()}`);
        }
      },
    }),
  ],

  callbacks: {
    async signIn({ user }) {
      if (allowed.length === 0) return true; // geen lijst ingesteld: open
      return allowed.includes((user.email ?? "").toLowerCase());
    },
    async session({ session, user }) {
      // De pagina's lezen session.user.id, dus die moet erin.
      session.user.id = user.id;
      return session;
    },
  },
});
