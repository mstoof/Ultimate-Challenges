import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events, gearItems, gearSports, gearProfiles, type GearOption } from "@/db/schema";
import { auth } from "@/lib/auth";
import { GEAR_TAGS, sharedKeyForName } from "@/lib/gear-shared";

// Laat een gratis AI (Google Gemini) een inkooplijst voor een sport genereren,
// net als de event-import (app/api/import-event). De items worden meteen als
// gear_items voor het lid opgeslagen; de gebruiker vinkt daarna af en past prijzen aan.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TAG_ENUM = Object.keys(GEAR_TAGS); // ["tw","no","ch","op"]
type GearTag = keyof typeof GEAR_TAGS;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Log eerst in." }, { status: 401 });
  }
  const userId = session.user.id;

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "De AI-uitrustingshulp is niet geconfigureerd (GEMINI_API_KEY ontbreekt)." },
      { status: 503 }
    );
  }
  const model = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

  let sport = "";
  try {
    const body = await req.json();
    sport = String(body?.sport ?? "").trim().slice(0, 60);
  } catch {
    return NextResponse.json({ error: "Ongeldige aanvraag." }, { status: 400 });
  }
  if (!sport) {
    return NextResponse.json({ error: "Geen sport opgegeven." }, { status: 400 });
  }

  // De sport moet bij dit lid horen (voorkomt items in willekeurige sporten).
  const [tracked] = await db
    .select({ sport: gearSports.sport, targetEventId: gearSports.targetEventId, tripCountry: gearSports.tripCountry, tripDate: gearSports.tripDate })
    .from(gearSports)
    .where(and(eq(gearSports.userId, userId), eq(gearSports.sport, sport)));
  if (!tracked) {
    return NextResponse.json({ error: "Voeg deze sport eerst toe." }, { status: 400 });
  }

  const [profile] = await db.select().from(gearProfiles).where(eq(gearProfiles.userId, userId)).limit(1);
  const [targetEvent] = tracked.targetEventId
    ? await db.select({ title: events.title, date: events.startsAt, location: events.location, distance: events.distance, description: events.description })
        .from(events).where(eq(events.id, tracked.targetEventId)).limit(1)
    : [];
  const profileText = [
    profile?.heightCm && `lengte ${profile.heightCm} cm`,
    profile?.weightKg && `gewicht ${profile.weightKg} kg`,
    profile?.shoeSize && `EU-schoenmaat ${profile.shoeSize}`,
    profile?.clothingSize && `kledingmaat ${profile.clothingSize}`,
  ].filter(Boolean).join(", ");
  const targetText = targetEvent
    ? [
        `gekozen event: ${targetEvent.title}`,
        targetEvent.date && `datum ${targetEvent.date.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Amsterdam" })}`,
        `locatie ${targetEvent.location}`,
        targetEvent.distance && `afstand ${targetEvent.distance}`,
        targetEvent.description && `details ${targetEvent.description}`,
      ].filter(Boolean).join(", ")
    : tracked.tripCountry && tracked.tripDate
      ? `reis naar ${tracked.tripCountry} op ${tracked.tripDate}`
      : "geen specifiek event geselecteerd";

  const instruction =
    `Je bent een uitrustingsadviseur voor een recreatieve maar ambitieuze sporter in Nederland. ` +
    `Geef een complete maar realistische inkooplijst voor de sport "${sport}". ` +
    `Antwoord uitsluitend met de gevraagde JSON, in het Nederlands. ` +
    `Geef 6 tot 14 items, van essentieel naar optioneel. ` +
    `Per item: een korte "name", een "description" van één zin met de reden/aandachtspunt, ` +
    `een "query" (korte Nederlandse Google-Shopping-zoekterm), en "price" (richtprijs in hele euro's, nieuw). ` +
    `Geef daarnaast per item 2 of 3 concrete, werkelijk bestaande productopties in "options", van voordelig tot premium. ` +
    `Elke optie bevat "label", "note", "price", waar relevant "size", en een gerichte "query". ` +
    `Stem maat, pasvorm, draagvermogen en demping af op het profiel; verzin geen precieze pasvorm als gegevens ontbreken. ` +
    `Als een doel-event is opgegeven, maak de lijst specifiek voor dat event. Houd rekening met locatie, seizoen, afstand, terrein en waarschijnlijke omstandigheden. ` +
    `Voeg bij kou, hitte, regen, wind, hoogte, modder of duisternis de relevante specialistische uitrusting toe en leg in de omschrijving uit waarom. ` +
    `Doe geen alsof een weersverwachting zeker is als het event nog te ver weg is; formuleer dan als voorbereiding op aannemelijke omstandigheden. ` +
    `Bij fietsen (zoals triatlonfiets, racefiets of mountainbike): geef herkenbare merk/model-opties die gangbaar zijn op de Nederlandse tweedehandsmarkt, ` +
    `zet de aanbevolen framemaat in "size" als het profiel dat verantwoord toelaat, gebruik "tw" en noem in "note" kort wat bij tweedehands gecontroleerd moet worden (frame, lagers, aandrijving en onderhoud). ` +
    `Gebruik "sharedKey" voor één fysiek product dat logisch in meerdere sporten gebruikt wordt. Gebruik exact dezelfde korte kebab-case sleutel over sporten heen, ` +
    `bijvoorbeeld "bike-gps" voor een fiets-GPS bij wielrennen, triatlon en mountainbiken. Laat sharedKey leeg voor sportspecifieke of individueel benodigde items. ` +
    `"tags" is een lijst met nul of meer van: "tw" (tweedehands verantwoord), "no" (koop nieuw — verplicht bij helmen, schoenen en andere veiligheids-/pasvormitems), "ch" (er valt nog een keuze te maken), "op" (optioneel/niet essentieel). ` +
    `Zet nooit "tw" én "no" samen op één item. Wees eerlijk over veiligheid: helmen en schoenen krijgen altijd "no".`;

  const body = {
    system_instruction: { parts: [{ text: instruction }] },
    contents: [{ parts: [{ text: `Sport: ${sport}\nProfiel: ${profileText || "nog geen lichaamsmaten ingevuld"}\nDoel: ${targetText}\n\nMaak de inkooplijst.` }] }],
    generationConfig: {
      temperature: 0.3,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          items: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                description: { type: "STRING" },
                tags: { type: "ARRAY", items: { type: "STRING", enum: TAG_ENUM } },
                query: { type: "STRING" },
                price: { type: "NUMBER" },
                options: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      label: { type: "STRING" }, note: { type: "STRING" }, price: { type: "NUMBER" },
                      size: { type: "STRING" }, query: { type: "STRING" },
                    },
                    required: ["label", "note", "price", "query"],
                  },
                },
                sharedKey: { type: "STRING" },
              },
              required: ["name", "description", "tags", "query", "price", "options", "sharedKey"],
            },
          },
        },
        required: ["items"],
      },
    },
  };

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(55000),
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

  let parsed: { items?: Array<{ name?: string; description?: string; tags?: unknown; query?: string; price?: unknown; options?: unknown; sharedKey?: unknown }> };
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "AI-antwoord was geen geldige JSON." }, { status: 502 });
  }
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  if (!rawItems.length) {
    return NextResponse.json({ error: "De AI leverde geen items op. Probeer opnieuw." }, { status: 502 });
  }

  // Bestaande namen ophalen om dubbelen over te slaan (case-insensitief).
  const existing = await db
    .select({ id: gearItems.id, name: gearItems.name, sortOrder: gearItems.sortOrder })
    .from(gearItems)
    .where(and(eq(gearItems.userId, userId), eq(gearItems.sport, sport)));
  const existingByName = new Map(existing.map((e) => [e.name.toLowerCase().trim(), e]));
  const seen = new Set<string>();
  let sortOrder = existing.reduce((max, e) => Math.max(max, e.sortOrder), -1) + 1;

  const rows = [];
  for (const raw of rawItems) {
    const name = String(raw?.name ?? "").trim().slice(0, 120);
    if (!name) continue;
    const keyName = name.toLowerCase();
    if (seen.has(keyName)) continue;
    seen.add(keyName);

    let tags = (Array.isArray(raw?.tags) ? raw.tags : [])
      .map(String)
      .filter((code): code is GearTag => (TAG_ENUM as string[]).includes(code));
    // Veiligheidsnet: "tw" en "no" samen kan niet — "no" (veiligheid) wint.
    if (tags.includes("no")) tags = tags.filter((t) => t !== "tw");

    const priceNum = Number(raw?.price);
    const estPrice = Number.isFinite(priceNum) && priceNum >= 0 ? Math.min(Math.round(priceNum), 100000) : 0;
    const aiSharedKey = String(raw?.sharedKey ?? "").trim().toLowerCase();
    const sharedKey = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(aiSharedKey) && aiSharedKey.length <= 60
      ? aiSharedKey
      : sharedKeyForName(name, String(raw?.query ?? ""));

    const rawOptions = Array.isArray(raw?.options) ? raw.options : [];
    const options: GearOption[] = rawOptions.slice(0, 3).flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const option = value as Record<string, unknown>;
      const label = String(option.label ?? "").trim().slice(0, 120);
      const optionPrice = Number(option.price);
      if (!label || !Number.isFinite(optionPrice) || optionPrice < 0) return [];
      return [{
        label,
        note: String(option.note ?? "").trim().slice(0, 220) || undefined,
        price: Math.min(Math.round(optionPrice), 100000),
        size: String(option.size ?? "").trim().slice(0, 30) || undefined,
        query: String(option.query ?? "").trim().slice(0, 160) || label,
      }];
    });

    const current = existingByName.get(keyName);
    if (current) {
      await db.update(gearItems).set({
        description: String(raw?.description ?? "").trim().slice(0, 400) || null,
        tags: JSON.stringify(tags), searchQuery: String(raw?.query ?? "").trim().slice(0, 160) || name,
        estPrice, options, chosenOption: null, sharedKey,
      }).where(and(eq(gearItems.userId, userId), eq(gearItems.id, current.id)));
      continue;
    }

    rows.push({
      userId,
      sport,
      name,
      description: String(raw?.description ?? "").trim().slice(0, 400) || null,
      tags: JSON.stringify(tags),
      searchQuery: String(raw?.query ?? "").trim().slice(0, 160) || name,
      estPrice,
      options,
      sharedKey,
      aiGenerated: true,
      sortOrder: sortOrder++,
    });
  }

  if (rows.length) {
    await db.insert(gearItems).values(rows);
  }

  return NextResponse.json({ ok: true, added: rows.length });
}
