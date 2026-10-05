import { describe, expect, it, vi } from "vitest";
import { getTeamGroundingContext } from "./teamContext";

function response(data) {
  return { ok: true, status: 200, json: vi.fn().mockResolvedValue(data) };
}

function pokemon(id, name) {
  return {
    id,
    name,
    types: [{ type: { name: "electric" } }],
    stats: [
      { base_stat: 35, stat: { name: "hp" } },
      { base_stat: 90, stat: { name: "speed" } },
    ],
    abilities: [{ ability: { name: "static" } }],
    moves: [{ move: { name: "thunderbolt" } }],
  };
}

function teamMember(slot, id) {
  return {
    slot,
    id,
    level: 50,
    item: "light-ball",
    ability: "static",
    nature: "timid",
    teraType: "fairy",
    gender: "",
    moves: ["thunderbolt"],
    evs: { hp: 4, attack: 0, defense: 0, specialAttack: 252, specialDefense: 0, speed: 252 },
    ivs: { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
  };
}

describe("getTeamGroundingContext", () => {
  it("verifies species and moves before building team analysis", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/pokemon/25")) return response(pokemon(25, "pikachu"));
      if (url.endsWith("/pokemon/26")) return response(pokemon(26, "raichu"));
      throw new Error(`Unexpected URL: ${url}`);
    });
    const context = await getTeamGroundingContext({
      kind: "team",
      mode: "competitive",
      format: "gen9-singles",
      campaign: null,
      moveTypes: ["electric"],
      members: [teamMember(1, 25), null, null, null, teamMember(5, 26), null],
    }, { fetchImpl });

    expect(context).toMatchObject({
      kind: "team",
      format: "gen9-singles",
      filledSlots: 2,
      emptySlots: [2, 3, 4, 6],
    });
    expect(context.members[0]).toMatchObject({
      slot: 1,
      verifiedPokemon: {
        id: 25,
        name: "pikachu",
        types: ["electric"],
        defensiveDamageMultipliers: expect.objectContaining({
          electric: 0.5,
          ground: 2,
          rock: 1,
        }),
      },
      userConfiguration: {
        abilityExistsForSpecies: true,
        moves: [{
          name: "thunderbolt",
          existsForSpecies: true,
        }],
      },
    });
    expect(context.members[0].verifiedPokemon.legalMoves).toBeUndefined();
    expect(context.analysis.sharedWeaknesses).toContainEqual(
      expect.objectContaining({ type: "ground", weakCount: 2 }),
    );
    expect(context.analysis.offensiveCoverage.coveredTypes)
      .toEqual(expect.arrayContaining(["water", "flying"]));
    expect(context.competitive).toBeNull();
  });

  it("adds curated campaign context without competitive statistics", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/pokemon/25")) return response(pokemon(25, "pikachu"));
      throw new Error(`Unexpected URL: ${url}`);
    });
    const context = await getTeamGroundingContext({
      kind: "team",
      mode: "campaign",
      format: "emerald",
      campaign: { gameId: "emerald", milestoneId: "before-roxanne" },
      moveTypes: [],
      members: [teamMember(1, 25), null, null, null, null, null],
    }, { fetchImpl });

    expect(context).toMatchObject({
      mode: "campaign",
      competitive: null,
      campaign: {
        game: { id: "emerald" },
        milestone: { objective: "Gym Leader Roxanne" },
      },
    });
    expect(context.members[0].verifiedPokemon.legalMoves).toEqual([
      { name: "thunderbolt", method: "level-up", level: 0 },
    ]);
  });

  it("includes format-specific legal moves for Fire Red campaign members", async () => {
    const sandshrewWithMoves = {
      ...pokemon(27, "sandshrew"),
      moves: [
        {
          move: { name: "thunderbolt" },
          version_group_details: [{
            version_group: { name: "firered-leafgreen" },
            level_learned_at: 0,
            move_learn_method: { name: "machine" },
          }],
        },
        {
          move: { name: "volt-tackle" },
          version_group_details: [{
            version_group: { name: "firered-leafgreen" },
            level_learned_at: 20,
            move_learn_method: { name: "level-up" },
          }],
        },
      ],
    };
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/pokemon/27")) return response(sandshrewWithMoves);
      throw new Error(`Unexpected URL: ${url}`);
    });
    const context = await getTeamGroundingContext({
      kind: "team",
      mode: "campaign",
      format: "firered",
      campaign: { gameId: "firered", milestoneId: "before-brock" },
      moveTypes: [],
      members: [teamMember(1, 27), null, null, null, null, null],
    }, { fetchImpl });

    expect(context.members[0].verifiedPokemon.legalMoves).toEqual([
      { name: "thunderbolt", method: "machine", level: 0 },
      { name: "volt-tackle", method: "level-up", level: 20 },
    ]);
  });
});
