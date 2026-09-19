import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { SPORTS } from "@/lib/distances";
import { safePublicUrl } from "@/lib/safe-url";

// Gebruikt een gratis AI (Google Gemini) om uit een event-link de velden te
// raden. Nooit blind opslaan: de gebruiker bevestigt in het formulier.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Vind het merk-logo/afbeelding in de pagina: eerst een vierkant app-icoon,
 *  dan de og:image. Relatieve paden worden absoluut gemaakt. */
function extractImage(html: string, baseUrl: string): string {
  const head = html.slice(0, 200000);
  const patterns = [
    /<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'][^"']*apple-touch-icon[^"']*["']/i,
    /<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i,
  ];
  for (const re of patterns) {
    const m = head.match(re);
    if (m?.[1]) {
      try {
        return new URL(m[1], baseUrl).href;
      } catch {
        /* ongeldige href */
      }
    }
  }
  return "";
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Log eerst in." }, { status: 401 });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "AI-import is niet geconfigureerd (GEMINI_API_KEY ontbreekt)." },
      { status: 503 }
    );
  }

  let url: string;
  try {
    ({ url } = await req.json());
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  let safeUrl: URL;
  try {
    safeUrl = await safePublicUrl(url);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Ongeldige event-link." }, { status: 400 });
  }

  // Paginatekst ophalen. Lukt dat niet, dan mag de AI het met de URL + kennis doen.
  let pageText = "";
  let rawHtml = "";
  try {
    const page = await fetch(safeUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (UltimateChallenges bot)" },
      redirect: "manual",
      signal: AbortSignal.timeout(10000),
    });
    if (page.status >= 300 && page.status < 400) throw new Error("redirect");
    if (!page.ok) throw new Error("http");
    const length = Number(page.headers.get("content-length") ?? 0);
    if (length > 2_000_000) throw new Error("too-large");
    rawHtml = (await page.text()).slice(0, 2_000_000);
    pageText = htmlToText(rawHtml).slice(0, 12000);
  } catch {
    /* laat leeg */
  }

  const today = new Date().toISOString().slice(0, 10);
  const instruction =
    `Je haalt gestructureerde gegevens uit een pagina over een sportevenement. ` +
    `Vandaag is ${today}. Antwoord uitsluitend met de gevraagde JSON. ` +
    `Laat een veld leeg ("") als het onbekend is. ` +
    `"sport" moet exact een van: ${SPORTS.join(", ")}. ` +
    `"startsAt" is ISO 8601 met tijd en tijdzone (ga uit van Europe/Amsterdam) als de datum bekend is, anders "". ` +
    `"distance" is de afstand of duur, bv. "Marathon (42,2 km)" of "Ironman (140.6)". ` +
    `"price" is de deelname-/inschrijfprijs met valuta, bv. "€45" of "vanaf €50"; "Gratis" als gratis; "" als onbekend.`;

  const body = {
    system_instruction: { parts: [{ text: instruction }] },
    contents: [
      {
        parts: [{ text: `URL: ${safeUrl.href}\n\nPaginatekst:\n${pageText || "(kon de pagina niet ophalen)"}` }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          sport: { type: "STRING", enum: SPORTS },
          distance: { type: "STRING" },
          location: { type: "STRING" },
          startsAt: { type: "STRING" },
          price: { type: "STRING" },
          description: { type: "STRING" },
        },
        required: ["title", "sport", "distance", "location", "startsAt", "price", "description"],
      },
    },
  };

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      }
    );
  } catch {
    return NextResponse.json({ error: "Kon de AI niet bereiken." }, { status: 502 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `AI gaf een fout (${res.status}). ${detail.slice(0, 200)}` },
      { status: 502 }
    );
  }

  const payload = await res.json().catch(() => null);
  const text: string | undefined = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return NextResponse.json({ error: "Geen bruikbaar antwoord van de AI." }, { status: 502 });
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "AI-antwoord was geen geldige JSON." }, { status: 502 });
  }

  // Het merk-logo komt uit de HTML, niet uit de AI.
  const extractedImage = extractImage(rawHtml, safeUrl.href);
  if (extractedImage) {
    try { data.imageUrl = (await safePublicUrl(extractedImage)).href; }
    catch { data.imageUrl = ""; }
  } else {
    data.imageUrl = "";
  }
  return NextResponse.json(data);
}
