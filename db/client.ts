import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
import * as authSchema from "./auth-schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL ontbreekt. Zie .env.example.");
}

// neon-http praat over HTTP in plaats van TCP, wat op Vercel scheelt in
// koude starts en geen connection pooling nodig heeft.
const sql = neon(process.env.DATABASE_URL);

export const db = drizzle(sql, { schema: { ...schema, ...authSchema } });
