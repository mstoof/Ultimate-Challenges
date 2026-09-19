import { ImageResponse } from "next/og";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { events } from "@/db/schema";
import { sportEmoji, logoSrc } from "@/lib/logo";

/** Haalt de logo-afbeelding op en maakt er een data-URI van, zodat Satori hem
 *  niet zelf hoeft te fetchen (en de render niet faalt bij een kapotte URL). */
async function logoDataUri(imageUrl: string | null, link: string | null): Promise<string | null> {
  const src = logoSrc(imageUrl, link);
  if (!src) return null;
  try {
    const r = await fetch(src, { signal: AbortSignal.timeout(6000) });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") || "image/png";
    if (!ct.startsWith("image/")) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export const alt = "Ultimate Challenges";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PINE = "#17251E";
const CHALK = "#EDEEE8";
const HIVIS = "#D9E021";
const MUTE = "#9DB0A4";

export default async function Image({ params }: { params: { id: string } }) {
  const [event] = await db.select().from(events).where(eq(events.slug, params.id)).limit(1);

  const wordmark = (
    <div
      style={{
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: 8,
        textTransform: "uppercase",
        color: HIVIS,
      }}
    >
      Ultimate Challenges
    </div>
  );

  if (!event) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: PINE,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {wordmark}
        </div>
      ),
      size
    );
  }

  const date = event.startsAt
    ? event.startsAt.toLocaleDateString("nl-NL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        timeZone: "Europe/Amsterdam",
      })
    : "Ooit · nog te plannen";

  const titleSize = event.title.length > 28 ? 56 : event.title.length > 16 ? 68 : 84;
  const logo = await logoDataUri(event.imageUrl, event.signupUrl);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: PINE,
          color: CHALK,
          fontFamily: "sans-serif",
          padding: 64,
        }}
      >
        {wordmark}

        {/* Het logo: het merk-icoon van het event, anders de sport als medaille.
            Dit is wat WhatsApp toont. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 260,
            height: 260,
            borderRadius: 260,
            border: `12px solid ${HIVIS}`,
            backgroundImage: "radial-gradient(circle at 35% 28%, #26392e, #14201a)",
            boxShadow: "0 14px 44px rgba(0,0,0,0.4)",
            overflow: "hidden",
            fontSize: 140,
            margin: "40px 0 36px",
          }}
        >
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} width={236} height={236} style={{ objectFit: "cover", borderRadius: 236 }} />
          ) : (
            sportEmoji(event.sport)
          )}
        </div>

        <div
          style={{
            display: "flex",
            fontSize: titleSize,
            fontWeight: 800,
            lineHeight: 1.04,
            letterSpacing: -1,
            textAlign: "center",
          }}
        >
          {event.title}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: MUTE, marginTop: 18 }}>
          {`${event.sport}${event.distance ? ` · ${event.distance}` : ""} · ${date}`}
        </div>
      </div>
    ),
    size
  );
}
