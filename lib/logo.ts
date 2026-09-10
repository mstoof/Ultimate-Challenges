/**
 * Het "logo" van een event: de sport als emoji. Gedeeld tussen de homepage
 * (klein logo naast de datum) en de OG-afbeelding (die naar WhatsApp gaat).
 */
/**
 * De logo-afbeelding van een event: een expliciet opgegeven logo, anders het
 * merk-icoon (favicon) van de event-link. Geen van beide -> null (val terug op
 * de sport-emoji).
 */
export function logoSrc(imageUrl: string | null, link: string | null): string | null {
  if (imageUrl && /^https?:\/\//i.test(imageUrl)) return imageUrl;
  if (link) {
    try {
      const host = new URL(link).hostname;
      return `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
    } catch {
      /* ongeldige link */
    }
  }
  return null;
}

export function sportEmoji(sport: string): string {
  const s = sport.toLowerCase();
  if (s.includes("triat") || s.includes("iron")) return "🏊";
  if (s.includes("hardlop") || s.includes("run") || s.includes("marathon") || s.includes("ultra"))
    return "🏃";
  if (s.includes("obstacle") || s.includes("spartan") || s.includes("mud")) return "🤸";
  if (s.includes("boulder") || s.includes("klim")) return "🧗";
  if (s.includes("squash") || s.includes("tennis") || s.includes("padel")) return "🎾";
  if (s.includes("fiets") || s.includes("wieler") || s.includes("gravel")) return "🚴";
  if (s.includes("zwem") || s.includes("swim")) return "🏊";
  return "🏅";
}
