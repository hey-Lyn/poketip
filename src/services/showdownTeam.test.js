import { describe, expect, it } from "vitest";
import { exportShowdownTeam, importShowdownTeam } from "./showdownTeam";

describe("showdownTeam", () => {
  const team = [{
    name: "pikachu",
    item: "Light Ball",
    ability: "lightning-rod",
    level: 50,
    gender: "female",
    teraType: "fairy",
    nature: "timid",
    ivs: { hp: 31, attack: 0, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
    evs: { hp: 4, specialAttack: 252, speed: 252 },
    moves: ["thunderbolt", "volt-switch", "surf", "alluring-voice"],
  }];

  it("exports a team in the human-readable Showdown format", () => {
    expect(exportShowdownTeam(team)).toContain(
      "Pikachu (F) @ Light Ball\nAbility: Lightning Rod\nLevel: 50\nTera Type: Fairy",
    );
    expect(exportShowdownTeam(team)).toContain("EVs: 4 HP / 252 SpA / 252 Spe");
    expect(exportShowdownTeam(team)).toContain("Timid Nature");
    expect(exportShowdownTeam(team)).toContain("IVs: 0 Atk");
    expect(exportShowdownTeam(team)).toContain("- Thunderbolt");
  });

  it("imports Showdown fields into editable settings", () => {
    const imported = importShowdownTeam(exportShowdownTeam(team));

    expect(imported[0]).toMatchObject({
      species: "pikachu",
      item: "Light Ball",
      ability: "Lightning Rod",
      level: 50,
      gender: "female",
      teraType: "Fairy",
      nature: "Timid",
      evs: { hp: 4, specialAttack: 252, speed: 252 },
      ivs: { attack: 0 },
      moves: ["Thunderbolt", "Volt Switch", "Surf", "Alluring Voice"],
    });
  });
});
