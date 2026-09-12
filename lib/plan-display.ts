/** Keep heart-rate ranges in the reference panel, including for older AI plans. */
export function compactRunText(value: string): string {
  return value
    .replace(/\b(?:zone|z)\s*([1-5])\b/gi, "Z$1")
    .replace(/\s*\(?\s*\d{2,3}\s*[-–—]\s*\d{2,3}\s*(?:bpm|slagen\s*(?:per\s*minuut|\/\s*min)|sl\s*\/\s*min)\s*\)?/gi, "")
    .replace(/\s*\(?\s*\d{2,3}\s*bpm\s*\)?/gi, "")
    .replace(/\s+([,.;])/g, "$1")
    .replace(/ {2,}/g, " ")
    .trim();
}
