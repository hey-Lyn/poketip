import { describe, expect, it } from "vitest";
import { applyTeamAiActions } from "./teamAiActions";
import { createTeamMember } from "./teamStorage";

const pikachu = {
  id: 25,
  name: "pikachu",
  speciesName: "pikachu",
  sprite: "pikachu.png",
  types: ["electric"],
  abilities: [{ name: "static" }],
};

describe("applyTeamAiActions", () => {
  it("applies a validated update atomically to the requested slot", () => {
    const team = [createTeamMember(pikachu), null, null, null, null, null];
    const nextTeam = applyTeamAiActions(team, [{
      type: "update_team_slot",
      slot: 1,
      pokemon: pikachu,
      changes: {
        nature: "Timid",
        moves: ["thunderbolt", "volt-switch", "", ""],
        evs: {
          hp: 0,
          attack: 0,
          defense: 0,
          specialAttack: 252,
          specialDefense: 4,
          speed: 252,
        },
      },
    }]);

    expect(nextTeam[0]).toMatchObject({
      id: 25,
      nature: "Timid",
      moves: ["thunderbolt", "volt-switch", "", ""],
    });
    expect(team[0].nature).toBe("");
  });

  it("rejects an edit that would duplicate a team member", () => {
    const raichu = { ...pikachu, id: 26, name: "raichu", sprite: "raichu.png" };
    const team = [
      createTeamMember(pikachu),
      createTeamMember(raichu),
      null,
      null,
      null,
      null,
    ];

    expect(() => applyTeamAiActions(team, [{
      type: "update_team_slot",
      slot: 2,
      pokemon: pikachu,
      changes: {},
    }])).toThrow(/duplicate/iu);
  });
});
