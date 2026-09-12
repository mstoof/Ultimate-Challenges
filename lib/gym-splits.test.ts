import { describe, expect, it } from "vitest";
import { gymInstructions, normalizeGymSplits, readGymSplits } from "./gym-splits";

describe("gym split preferences", () => {
  it("keeps multiple supported splits and removes duplicates and unknown values", () => {
    expect(normalizeGymSplits(["legs", "push", "pull", "push", "invented"])).toEqual(["push", "pull", "legs"]);
  });
  it("handles old profiles and malformed stored values", () => {
    for (const value of [null, undefined, "", "not json", '{}', '"push"']) expect(readGymSplits(value)).toEqual([]);
    expect(readGymSplits('["upper","lower"]')).toEqual(["upper", "lower"]);
  });
  it("uses the selected splits without adding days when there are more splits than gym days", () => {
    const instruction = gymInstructions(2, ["push", "pull", "legs"]);
    expect(instruction).toContain("2 dag(en)");
    expect(instruction).toContain("Push (borst, schouders en triceps)");
    expect(instruction).toContain("Pull (rug en biceps)");
    expect(instruction).toContain("Legs (benen en billen)");
    expect(instruction).toContain("rotatie door in de volgende week");
    expect(instruction).not.toContain("Full body");
  });
  it("allows coach-selected splits when no preference is stored", () => {
    expect(gymInstructions(1, [])).toContain("geen splitvoorkeur");
    expect(gymInstructions(1, [])).toContain("precies 6 oefeningen");
  });
  it("ignores any splits when strength training is disabled", () => {
    const instruction = gymInstructions(0, ["push", "pull", "legs"]);
    expect(instruction).toContain("geen krachttraining");
    expect(instruction).not.toContain("Push");
    expect(instruction).not.toContain("6 oefeningen");
  });
});
