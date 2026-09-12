import { describe, expect, it } from "vitest";
import { allowedDays, mondayFor, todayInAmsterdam, tomorrowInAmsterdam } from "./training-dates";
import { compactRunText } from "./plan-display";

describe("upcoming training dates", () => {
  it("identifies the current Amsterdam week across the Sunday-to-Monday boundary", () => {
    expect(mondayFor(todayInAmsterdam(new Date("2026-09-13T21:59:00Z")))).toBe("2026-09-07");
    expect(mondayFor(todayInAmsterdam(new Date("2026-09-13T22:00:00Z")))).toBe("2026-09-14");
  });
  it("starts on Sunday when generating on Saturday, with only one day in week one", () => {
    const tomorrow = tomorrowInAmsterdam(new Date("2026-09-12T12:00:00Z"));
    expect(tomorrow).toBe("2026-09-13");
    expect(mondayFor(tomorrow)).toBe("2026-09-07");
    expect(allowedDays(mondayFor(tomorrow), tomorrow)).toEqual(["zo"]);
    expect(allowedDays("2026-09-14", tomorrow)).toEqual(["ma", "di", "wo", "do", "vr", "za", "zo"]);
  });
  it("starts next week when generating on Sunday", () => {
    const tomorrow = tomorrowInAmsterdam(new Date("2026-09-13T12:00:00Z"));
    expect(mondayFor(tomorrow)).toBe("2026-09-14");
  });
  it("uses Amsterdam's day even while the Vercel server is still on the previous UTC date", () => {
    expect(tomorrowInAmsterdam(new Date("2026-09-12T22:30:00Z"))).toBe("2026-09-14");
  });
  it("handles the daylight-saving transition and rejects all days of an old week", () => {
    expect(tomorrowInAmsterdam(new Date("2026-10-24T22:30:00Z"))).toBe("2026-10-26");
    expect(allowedDays("2026-09-07", "2026-09-14")).toEqual([]);
  });
});

describe("compact running instructions", () => {
  it("keeps zone labels and removes inline bpm ranges from old plans", () => {
    expect(compactRunText("45 min in zone 2 (130–145 bpm), daarna Z1 (110-130 bpm)."))
      .toBe("45 min in Z2, daarna Z1.");
  });
  it("preserves pace, intervals and distances", () => {
    expect(compactRunText("6×800 m in Z4, 5:00–5:20 min/km, 90 sec rust."))
      .toBe("6×800 m in Z4, 5:00–5:20 min/km, 90 sec rust.");
  });
});
