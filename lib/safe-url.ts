import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const PUBLIC_PROTOCOLS = new Set(["http:", "https:"]);

function isPrivateAddress(address: string) {
  const value = address.toLowerCase();
  if (value === "::1" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

/** Parse a user-supplied URL and reject credentials, localhost and private networks. */
export async function safePublicUrl(raw: unknown) {
  let url: URL;
  try { url = new URL(String(raw ?? "")); } catch { throw new Error("Gebruik een geldige openbare http(s)-link."); }
  if (!PUBLIC_PROTOCOLS.has(url.protocol) || url.username || url.password) throw new Error("Gebruik een openbare http(s)-link.");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "localhost.localdomain") throw new Error("Lokale links zijn niet toegestaan.");
  let addresses: Array<{ address: string }>;
  try { addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true }); }
  catch { throw new Error("De hostnaam kon niet worden gecontroleerd."); }
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error("Deze link verwijst niet naar een openbare website.");
  return url;
}
