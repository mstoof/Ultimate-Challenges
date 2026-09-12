export const GYM_SPLITS = [
  { id: "push", label: "Push", focus: "borst, schouders en triceps" },
  { id: "pull", label: "Pull", focus: "rug en biceps" },
  { id: "legs", label: "Legs", focus: "benen en billen" },
  { id: "upper", label: "Upper body", focus: "bovenlichaam" },
  { id: "lower", label: "Lower body", focus: "onderlichaam" },
  { id: "full", label: "Full body", focus: "hele lichaam" },
  { id: "core", label: "Core", focus: "romp en stabiliteit" },
] as const;
export type GymSplit = (typeof GYM_SPLITS)[number]["id"];

export function normalizeGymSplits(input: unknown): GymSplit[] {
  if (!Array.isArray(input)) return [];
  return GYM_SPLITS.filter((split) => input.includes(split.id)).map((split) => split.id);
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
    ? `Gekozen gymsplits: ${splits.map((split) => `${split.label} (${split.focus})`).join("; ")}. ` +
      'Geef iedere gymsessie één van deze splits als focus en zet de splitnaam in de titel. Kies oefeningen passend bij die focus. ' +
      'Wissel alle gekozen splits af over de beschikbare gymdagen en weken; als er meer splits dan gymdagen zijn, loopt de rotatie door in de volgende week. ' +
      'Meerdere splits selecteren voegt geen extra gymdagen toe. Houd rekening met overlappende spiergroepen bij combinaties van splits. '
    : 'Er is geen splitvoorkeur: kies zelf een evenwichtige indeling passend bij het aantal gymdagen. ';
  return `De sporter doet ${gymDays} dag(en) per volledige week kracht. ` + focus +
    'Plan voldoende herstel tussen sessies voor dezelfde spiergroepen en stem beentraining af op lange of zware looptrainingen. ' +
    'Elke sessie met "type": "gym" krijgt in "exercises" precies 6 oefeningen, elk met "name" en "prescription" ' +
    '(sets×reps met eventueel gewicht/RPE en rust, bv. "4×8 @ RPE 7, 90s rust"). Bij alle andere types laat je "exercises" leeg. ';
}
