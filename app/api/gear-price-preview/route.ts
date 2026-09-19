import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isPrivateAddress(address: string) {
  const value = address.toLowerCase();
  if (value === "::1" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
  const parts = value.split(".").map(Number);
  if (parts.length !== 4) return false;
  return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

async function safeUrl(raw: unknown) {
  const url = new URL(String(raw ?? ""));
  if (!(["http:", "https:"] as string[]).includes(url.protocol) || url.username || url.password) throw new Error("Gebruik een openbare http(s)-link.");
  if (["localhost", "localhost.localdomain"].includes(url.hostname.toLowerCase())) throw new Error("Lokale links zijn niet toegestaan.");
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((entry) => isPrivateAddress(entry.address))) throw new Error("Deze link verwijst niet naar een openbare webshop.");
  return url;
}

function collectPrices(value: unknown, prices: number[]) {
  if (Array.isArray(value)) return value.forEach((item) => collectPrices(item, prices));
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  const type = String(record["@type"] ?? "").toLowerCase();
  if (type.includes("offer") || type.includes("product") || "priceCurrency" in record) {
    for (const key of ["price", "lowPrice", "highPrice"]) {
      const number = Number(String(record[key] ?? "").replace(",", "."));
      if (Number.isFinite(number) && number > 0 && number < 1_000_000) prices.push(number);
    }
  }
  Object.values(record).forEach((item) => collectPrices(item, prices));
}

function extractPrices(html: string) {
  const prices: number[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { collectPrices(JSON.parse(match[1]), prices); } catch { /* ongeldige JSON-LD */ }
  }
  const metaPatterns = [
    /<meta[^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount)["'][^>]+content=["']([\d.,]+)["']/gi,
    /<meta[^>]+content=["']([\d.,]+)["'][^>]+(?:property|name)=["'](?:product:price:amount|og:price:amount)["']/gi,
    /itemprop=["']price["'][^>]+content=["']([\d.,]+)["']/gi,
  ];
  for (const pattern of metaPatterns) {
    for (const match of html.matchAll(pattern)) {
      const number = Number(match[1].replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", "."));
      if (Number.isFinite(number) && number > 0 && number < 1_000_000) prices.push(number);
    }
  }
  return prices;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Log eerst in." }, { status: 401 });
  try {
    const input = await request.json();
    const url = await safeUrl(input?.url);
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; UltimateChallenges/1.0)" },
      redirect: "manual", signal: AbortSignal.timeout(12000),
    });
    if (response.status >= 300 && response.status < 400) {
      return NextResponse.json({ error: "Deze webshop stuurt door. Plak de uiteindelijke productlink." }, { status: 400 });
    }
    if (!response.ok) throw new Error(`De webshop gaf fout ${response.status}.`);
    const html = (await response.text()).slice(0, 2_000_000);
    const prices = extractPrices(html);
    if (!prices.length) return NextResponse.json({ error: "Op deze pagina kon geen openbare productprijs worden gevonden." }, { status: 422 });
    return NextResponse.json({ price: Math.round(Math.min(...prices)), source: url.hostname });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ongeldige productlink.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
