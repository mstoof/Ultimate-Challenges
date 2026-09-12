import { describe, expect, it } from "vitest";
import { amsterdamInput, importedAmsterdamInput, parseAmsterdam } from "./timezone";

describe("Amsterdam event inputs", () => {
  it.each([
    ["2026-07-01T10:00", "2026-07-01T08:00:00.000Z"],
    ["2026-12-01T10:00", "2026-12-01T09:00:00.000Z"],
    ["2026-03-29T03:30", "2026-03-29T01:30:00.000Z"],
    ["2026-10-25T02:30", "2026-10-25T00:30:00.000Z"],
    ["2027-01-01T00:30", "2026-12-31T23:30:00.000Z"],
  ])("interprets %s independently of the server timezone", (input, expected) => {
    expect(parseAmsterdam(input).toISOString()).toBe(expected);
    expect(amsterdamInput(new Date(expected))).toBe(input);
  });

  it.each(["2026-03-29T02:30", "2026-02-30T10:00", "invalid", "", "2026-07-01T25:00"])("rejects invalid or nonexistent local time %s", (input) => {
    expect(Number.isNaN(parseAmsterdam(input).getTime())).toBe(true);
  });

  it("shows imported dates in Amsterdam, including dates supplied without an offset", () => {
    expect(importedAmsterdamInput("2026-07-01T10:00:00Z")).toBe("2026-07-01T12:00");
    expect(importedAmsterdamInput("2026-07-01T10:00:00-04:00")).toBe("2026-07-01T16:00");
    expect(importedAmsterdamInput("2026-07-01T10:00")).toBe("2026-07-01T10:00");
    expect(importedAmsterdamInput("")).toBe("");
  });
});
