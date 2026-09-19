const DAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];

export function plusDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function todayInAmsterdam(now = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam" }).format(now);
}

export function tomorrowInAmsterdam(now = new Date()): string {
  return plusDays(todayInAmsterdam(now), 1);
}

export function mondayFor(iso: string): string {
  const weekday = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return plusDays(iso, -((weekday + 6) % 7));
}

export function allowedDays(monday: string, earliest: string): string[] {
  return DAYS.filter((_, index) => plusDays(monday, index) >= earliest);
}
