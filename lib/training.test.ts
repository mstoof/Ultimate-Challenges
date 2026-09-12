import { describe, expect, it, vi } from "vitest";

vi.mock("@/db/client", () => ({ db: {} }));
import { computeZones } from "./training";

describe("computeZones", () => {
  it("uses the supplied maximum in preference to age", () => {
    const result = computeZones({ age: 40, maxHr: 200 });
    expect(result?.estimatedMax).toBe(false);
    expect(result?.method).toBe("max");
    expect(result?.zones.map(({ low, high }) => [low, high])).toEqual([
      [100, 120], [120, 140], [140, 160], [160, 180], [180, 200],
    ]);
  });

  it("calculates heart-rate reserve when resting heart rate is provided", () => {
    const result = computeZones({ maxHr: 200, restHr: 60 });
    expect(result?.method).toBe("hrr");
    expect(result?.zones.map(({ low, high }) => [low, high])).toEqual([
      [130, 144], [144, 158], [158, 172], [172, 186], [186, 200],
    ]);
  });

  it("estimates the maximum from age when no maximum is supplied", () => {
    expect(computeZones({ age: 40 })).toMatchObject({ maxHr: 180, estimatedMax: true });
  });

  it("does not invent zones when information is missing", () => {
    expect(computeZones({})).toBeNull();
    expect(computeZones({ restHr: 60 })).toBeNull();
  });
});
