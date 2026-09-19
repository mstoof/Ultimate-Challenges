import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

function encryptionKey(): Buffer {
  const key = Buffer.from(process.env.NOTION_TOKEN_ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("Notion is nog niet geconfigureerd.");
  return key;
}

export function notionConfigured(): boolean {
  return Boolean(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET &&
    process.env.NOTION_REDIRECT_URI && Buffer.from(process.env.NOTION_TOKEN_ENCRYPTION_KEY ?? "", "base64").length === 32);
}

export function encrypt(value: string, userId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(userId));
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decrypt(value: string, userId: string): string {
  const [iv, tag, ciphertext] = value.split(".").map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !ciphertext) throw new Error("Verbind Notion opnieuw.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAAD(Buffer.from(userId));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function validState(cookie: string | undefined, state: string | null, userId: string): boolean {
  if (!cookie || !state) return false;
  try {
    const saved = JSON.parse(decrypt(cookie, userId)) as { state: string; expires: number };
    const a = Buffer.from(saved.state);
    const b = Buffer.from(state);
    return saved.expires > Date.now() && a.length === b.length && timingSafeEqual(a, b);
  } catch { return false; }
}

export function sameOrigin(req: Request): boolean {
  return req.headers.get("origin") === new URL(req.url).origin;
}
