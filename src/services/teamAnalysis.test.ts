import { describe, expect, it } from "vitest";
import {
  analyzeOffensiveCoverage,
  analyzeTeamDefense,
  getDefensiveMultiplier,
} from "./teamAnalysis";

describe("team type analysis", () => {
  it("combines both defensive types and detects immunities", () => {
    expect(getDefensiveMultiplier("rock", ["fire", "flying"])).toBe(4);
    expect(getDefensiveMultiplier("ground", ["electric", "flying"])).toBe(0);
  });

  it("finds weaknesses and resistances shared by multiple members", () => {
    const analysis = analyzeTeamDefense([
      { types: ["fire", "flying"] },
      { types: ["bug", "flying"] },
      { types: ["grass", "poison"] },
      { types: ["grass", "steel"] },
    ]);

    expect(analysis.sharedWeaknesses).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "rock", weakCount: 2 }),
    ]));
    expect(analysis.resistances).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "grass" }),
    ]));
  });

  it("reports which defending types the selected move types cover", () => {
    const analysis = analyzeOffensiveCoverage(["fire", "water", "fire"]);

    expect(analysis.moveTypes).toEqual(["fire", "water"]);
    expect(analysis.coveredTypes).toEqual(expect.arrayContaining([
      "fire", "grass", "ground", "ice", "bug", "rock", "steel",
    ]));
    expect(analysis.missingTypes).toContain("electric");
  });
});
