/**
 * Bekende afstanden/duren, gegroepeerd per soort. Wordt als <select> met
 * <optgroup> getoond, zodat de lijst ook op de telefoon leesbaar blijft.
 */
export const DISTANCE_GROUPS: { label: string; options: string[] }[] = [
  {
    label: "Hardlopen",
    options: [
      "5 km",
      "10 km",
      "10 EM (16,1 km)",
      "15 km",
      "Halve marathon (21,1 km)",
      "30 km",
      "Marathon (42,2 km)",
    ],
  },
  {
    label: "Ultra",
    options: [
      "50 km",
      "50 mijl (80 km)",
      "100 km",
      "100 mijl (161 km)",
      "Backyard ultra",
      "UTMB (171 km)",
      "Western States 100 (161 km)",
      "Badwater 135 (217 km)",
      "Spartathlon (246 km)",
      "Moab 240 (386 km)",
      "Comrades (~90 km)",
    ],
  },
  {
    label: "Triatlon",
    options: ["Sprint triatlon", "Olympische afstand", "Half / 70.3", "Ironman (140.6)"],
  },
  {
    label: "Obstacle run",
    options: [
      "Spartan Sprint (5 km)",
      "Spartan Super (10 km)",
      "Spartan Beast (21 km)",
      "Strong Viking 13 km",
      "Strong Viking 19 km",
      "Strong Viking 42 km",
      "Strong Viking 60 km",
      "Strong Viking ULTRON (za 60 km + zo 42 km)",
    ],
  },
  {
    label: "Fietsen",
    options: ["Wielren 100 km", "Wielren 150 km", "Wielren 200 km", "Gran Fondo"],
  },
  {
    label: "Mountainbike",
    options: ["Cross-country", "Marathon MTB", "Trail", "Enduro", "Bikepacking"],
  },
  {
    label: "Zwemmen (open water)",
    options: ["1 km", "2 km open water", "5 km open water", "10 km open water"],
  },
  {
    label: "Anders",
    options: ["Best of 5", "2 uur"],
  },
];

/** Alle bekende waarden, om te checken of een bestaande/AI-waarde in de lijst zit. */
export const KNOWN_DISTANCES = new Set(DISTANCE_GROUPS.flatMap((g) => g.options));

/** De sporten in het dropdown. */
export const SPORTS = [
  "Hardlopen",
  "Triatlon",
  "Obstacle run",
  "Bouldering",
  "Squash",
  "Fietsen",
  "Mountainbike",
  "Zwemmen",
  "Anders",
];

/** Welke afstandsgroepen horen bij een sport. Zo toont het afstand-dropdown
 *  alleen wat past bij de gekozen sport. */
const SPORT_TO_GROUPS: Record<string, string[]> = {
  Hardlopen: ["Hardlopen", "Ultra"],
  Triatlon: ["Triatlon"],
  "Obstacle run": ["Obstacle run"],
  Fietsen: ["Fietsen"],
  Mountainbike: ["Mountainbike"],
  Zwemmen: ["Zwemmen (open water)"],
  Squash: ["Anders"],
  Bouldering: ["Anders"],
};

export function distanceGroupsForSport(sport: string) {
  const labels = SPORT_TO_GROUPS[sport];
  // Onbekend of "Anders": laat alles zien.
  if (!labels) return DISTANCE_GROUPS;
  return DISTANCE_GROUPS.filter((g) => labels.includes(g.label));
}
