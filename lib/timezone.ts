export const TIME_ZONE = "Europe/Amsterdam";

const formatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export function amsterdamDateTime(date: Date): string {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

export function amsterdamInput(date: Date | null): string {
  return date && Number.isFinite(date.getTime()) ? amsterdamDateTime(date).slice(0, 16) : "";
}

/** Interpret datetime-local fields in Amsterdam, independent of server/browser TZ.
 * Nonexistent spring-forward times are rejected; a repeated autumn time uses
 * its first occurrence, matching RFC 5545's local-time convention. */
export function parseAmsterdam(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return new Date(NaN);
  const full = value.length === 16 ? `${value}:00` : value;
  const naive = new Date(`${full}Z`).getTime();
  if (!Number.isFinite(naive)) return new Date(NaN);
  const candidates = new Set<number>();
  for (const delta of [-36, 0, 36]) {
    const sample = naive + delta * 3600000;
    const offset = new Date(`${amsterdamDateTime(new Date(sample))}Z`).getTime() - sample;
    const candidate = naive - offset;
    if (amsterdamDateTime(new Date(candidate)) === full) candidates.add(candidate);
  }
  return new Date(candidates.size ? Math.min(...candidates) : NaN);
}

export function importedAmsterdamInput(value: string): string {
  if (!value) return "";
  // Imports without an offset already express the intended Amsterdam clock time.
  return amsterdamInput(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? new Date(value) : parseAmsterdam(value));
}
