/** Complete gym programmes; each option is one coherent split system. */
export const GYM_SPLITS = [
  { id: "ppl", label: "Push / Pull / Legs", focus: "Push: borst, schouders en triceps · Pull: rug en biceps · Legs: benen en billen", days: "3-daagse rotatie" },
  { id: "upper-lower", label: "Upper / Lower", focus: "Upper: bovenlichaam · Lower: benen en billen", days: "2-daagse rotatie" },
  { id: "full-body", label: "Full body", focus: "hele lichaam per sessie", days: "iedere sessie" },
  { id: "phul", label: "PHUL", focus: "Power Upper · Power Lower · Hypertrophy Upper · Hypertrophy Lower", days: "4-daagse rotatie" },
  { id: "arnold", label: "Arnold split", focus: "borst/rug · schouders/armen · benen", days: "3-daagse rotatie" },
  { id: "bro-split", label: "Bro split", focus: "één hoofdspiergroep per sessie", days: "5-daagse rotatie" },
  { id: "torso-limbs", label: "Torso / Limbs", focus: "Torso: bovenlichaam · Limbs: armen en benen", days: "2-daagse rotatie" },
] as const;
export type GymSplit = (typeof GYM_SPLITS)[number]["id"];

const LEGACY_MAP: Record<string, GymSplit> = {
  full: "full-body", push: "ppl", pull: "ppl", legs: "ppl", upper: "upper-lower", lower: "upper-lower", core: "full-body",
};

export function normalizeGymSplits(input: unknown): GymSplit[] {
  if (!Array.isArray(input)) return [];
  const values = input.map(String);
  const modern = GYM_SPLITS.filter((split) => values.includes(split.id)).map((split) => split.id);
  if (modern.length) return modern;
  return [...new Set(values.map((value) => LEGACY_MAP[value]).filter(Boolean))];
}

export function readGymSplits(value: string | null | undefined): GymSplit[] {
  try { return normalizeGymSplits(JSON.parse(value || "[]")); }
  catch { return []; }
}

export function gymInstructions(gymDays: number, input: unknown): string {
  if (gymDays <= 0) return 'De sporter doet geen krachttraining: gebruik geen "gym"-sessies en laat "exercises" overal leeg. ';
  const selected = normalizeGymSplits(input);
  const splits = GYM_SPLITS.filter((split) => selected.includes(split.id));
  const focus = splits.length
    ? `Gekozen volledige gymsplit${splits.length > 1 ? "s" : ""}: ${splits.map((split) => `${split.label} (${split.focus}; ${split.days})`).join("; ")}. ` +
      `Gebruik één gekozen systeem als leidraad: zet de fase of trainingsdag van de split in de gymsessietitel (bijvoorbeeld “PPL — Push” of “Upper/Lower — Lower”) en kies oefeningen passend bij die fase. ` +
      `De rotatielengte van de split (bijvoorbeeld 3 dagen bij PPL) is NIET het aantal gymdagen: herhaal de fases in vaste volgorde net zo vaak als nodig om precies ${gymDays} gymsessies per volledige week te vullen (bij ${gymDays} gymdagen en PPL bijvoorbeeld: Push, Pull, Legs, Push, Pull, Legs). Meerdere gekozen splits voegen geen extra gymdagen toe. `
    : 'Er is geen splitvoorkeur: kies zelf één evenwichtige indeling passend bij het aantal gymdagen. ';
  return `De sporter doet krachttraining: plan in elke volledige week precies ${gymDays} sessies met "type": "gym" (in een gedeeltelijke week naar rato minder). ` + focus +
    'Plan voldoende herstel tussen sessies voor dezelfde spiergroepen en stem beentraining af op lange of zware looptrainingen. Elke sessie met "type": "gym" krijgt in "exercises" precies 6 oefeningen, elk met "name" en "prescription" (sets×reps met eventueel gewicht/RPE en rust). Bij alle andere types laat je "exercises" leeg. ';
}
