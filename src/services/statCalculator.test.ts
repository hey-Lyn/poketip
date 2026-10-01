import { describe, expect, it } from "vitest";
import type { StatBlock } from "../types";
import {
  calculateFinalStats,
  calculateHp,
  calculateStat,
  getNatureMultiplier,
  pokeApiStatsToBlock,
  sumStats,
} from "./statCalculator";

const baseStats: StatBlock = {
  hp: 100,
  attack: 100,
  defense: 100,
  specialAttack: 100,
  specialDefense: 100,
  speed: 100,
};

const perfectIvs: StatBlock = {
  hp: 31,
  attack: 31,
  defense: 31,
  specialAttack: 31,
  specialDefense: 31,
  speed: 31,
};

const maxEvs: StatBlock = {
  hp: 252,
  attack: 252,
  defense: 252,
  specialAttack: 252,
  specialDefense: 252,
  speed: 252,
};

describe("getNatureMultiplier", () => {
  it("returns 1.1 for the raised stat and 0.9 for the lowered stat", () => {
    expect(getNatureMultiplier("Adamant", "attack")).toBe(1.1);
    expect(getNatureMultiplier("Adamant", "specialAttack")).toBe(0.9);
    expect(getNatureMultiplier("Adamant", "defense")).toBe(1);
  });

  it("treats neutral, missing, and unknown natures as 1", () => {
    expect(getNatureMultiplier("Hardy", "attack")).toBe(1);
    expect(getNatureMultiplier("", "attack")).toBe(1);
    expect(getNatureMultiplier(undefined, "attack")).toBe(1);
    expect(getNatureMultiplier("Bogus", "attack")).toBe(1);
  });

  it("matches natures case-insensitively", () => {
    expect(getNatureMultiplier("adamant", "attack")).toBe(1.1);
  });
});

describe("calculateHp", () => {
  it("computes level 100 HP with max investment", () => {
    expect(calculateHp(100, 31, 252, 100)).toBe(404);
  });

  it("computes level 1 HP", () => {
    expect(calculateHp(100, 31, 0, 1)).toBe(13);
  });

  it("always returns 1 for Shedinja", () => {
    expect(calculateHp(1, 31, 252, 100, true)).toBe(1);
  });
});

describe("calculateStat", () => {
  it("computes a neutral stat with max investment", () => {
    expect(calculateStat(100, 31, 252, 100, 1)).toBe(299);
  });

  it("applies the nature multiplier", () => {
    expect(calculateStat(100, 31, 252, 100, 1.1)).toBe(328);
    expect(calculateStat(100, 31, 252, 100, 0.9)).toBe(269);
  });

  it("computes level 1 stats", () => {
    expect(calculateStat(100, 31, 0, 1, 1)).toBe(7);
  });
});

describe("calculateFinalStats", () => {
  it("computes a full block at level 100", () => {
    const stats = calculateFinalStats({
      baseStats,
      ivs: perfectIvs,
      evs: maxEvs,
      nature: "Hardy",
      level: 100,
    });

    expect(stats.hp).toBe(404);
    expect(stats.attack).toBe(299);
    expect(stats.speed).toBe(299);
  });

  it("applies the nature to the right stats", () => {
    const stats = calculateFinalStats({
      baseStats,
      ivs: perfectIvs,
      evs: maxEvs,
      nature: "Adamant",
      level: 100,
    });

    expect(stats.attack).toBe(328);
    expect(stats.specialAttack).toBe(269);
    expect(stats.hp).toBe(404);
  });

  it("clamps the level and defaults missing IVs and EVs", () => {
    const stats = calculateFinalStats({
      baseStats,
      nature: "Hardy",
      level: 250,
    });

    expect(stats.hp).toBe(341);
  });

  it("gives Shedinja 1 HP regardless of investment", () => {
    const stats = calculateFinalStats({
      baseStats,
      ivs: perfectIvs,
      evs: maxEvs,
      level: 100,
      isShedinja: true,
    });

    expect(stats.hp).toBe(1);
  });
});

describe("pokeApiStatsToBlock", () => {
  it("maps PokéAPI stat names to stat keys", () => {
    const block = pokeApiStatsToBlock([
      { name: "hp", value: 35 },
      { name: "special-attack", value: 50 },
      { name: "special-defense", value: 50 },
      { name: "speed", value: 90 },
      { name: "unknown-stat", value: 1 },
    ]);

    expect(block.hp).toBe(35);
    expect(block.specialAttack).toBe(50);
    expect(block.specialDefense).toBe(50);
    expect(block.speed).toBe(90);
  });

  it("returns an empty block for missing input", () => {
    expect(pokeApiStatsToBlock(null)).toEqual({});
  });
});

describe("sumStats", () => {
  it("returns the base stat total", () => {
    expect(sumStats(baseStats)).toBe(600);
    expect(sumStats({ hp: 35 })).toBe(35);
  });
});
