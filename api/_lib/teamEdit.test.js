import { describe, expect, it, vi } from "vitest";
import { resolveTeamEditPlan } from "./teamEdit.js";

const emptyStats = {
  hp: 0,
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
};
const perfectIvs = {
  hp: 31,
  attack: 31,
  defense: 31,
  specialAttack: 31,
  specialDefense: 31,
  speed: 31,
};
const context = {
  format: "gen9-singles",
  members: [{
    id: 25,
    evs: emptyStats,
    ivs: perfectIvs,
  }, null, null, null, null, null],
};

const campaignContext = {
  mode: "campaign",
  format: "emerald",
  campaign: { gameId: "emerald", milestoneId: "before-roxanne" },
  members: [null, null, null, null, null, null],
};

function pokemonData(id = 25, name = "pikachu") {
  return {
    id,
    name,
    species: { name },
    sprites: { front_default: `${name}.png`, other: {} },
    types: [{ type: { name: "electric" } }],
    abilities: [{ ability: { name: "static" }, is_hidden: false }],
    moves: [
      { move: { name: "thunderbolt" } },
      { move: { name: "volt-switch" } },
    ],
  };
}

describe("resolveTeamEditPlan", () => {
  it("validates and normalizes an explicitly requested slot update", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.includes("/pokemon/25")) {
        return { ok: true, json: async () => pokemonData() };
      }
      if (url.includes("/item/light-ball")) {
        return { ok: true, json: async () => ({ name: "light-ball" }) };
      }
      return { ok: false };
    });
    const rawPlan = JSON.stringify({
      message: "Pikachu was configured as a fast attacker.",
      actions: [{
        type: "update_team_slot",
        slot: 1,
        changes: {
          item: "Light Ball",
          nature: "timid",
          ability: "Static",
          teraType: "Electric",
          moves: ["Thunderbolt", "Volt Switch"],
          evs: { specialAttack: 252, speed: 252, specialDefense: 4 },
          ivs: { attack: 0 },
        },
      }],
    });

    const result = await resolveTeamEditPlan(rawPlan, context, { fetchImpl });

    expect(result.message).toContain("fast attacker");
    expect(result.actions[0]).toMatchObject({
      type: "update_team_slot",
      slot: 1,
      pokemon: { id: 25, name: "pikachu", sprite: "pikachu.png" },
      changes: {
        item: "light-ball",
        nature: "Timid",
        ability: "static",
        teraType: "electric",
        moves: ["thunderbolt", "volt-switch", "", ""],
        evs: { specialAttack: 252, speed: 252, specialDefense: 4 },
        ivs: { attack: 0 },
      },
    });
    expect(result.actions[0].changes.evs).toEqual({
      ...emptyStats,
      specialAttack: 252,
      specialDefense: 4,
      speed: 252,
    });
    expect(result.actions[0].changes.ivs).toEqual({ ...perfectIvs, attack: 0 });
  });

  it("omits a move the selected Pokémon cannot learn without blocking the edit", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => pokemonData(),
    });
    const rawPlan = JSON.stringify({
      message: "Changed the move.",
      actions: [{
        type: "update_team_slot",
        slot: 1,
        changes: { moves: ["spacial-rend"] },
      }],
    });

    await expect(resolveTeamEditPlan(rawPlan, context, { fetchImpl }))
      .resolves.toMatchObject({
        actions: [],
        adjustments: [expect.stringMatching(/spacial rend.*omitted/iu)],
      });
  });

  it("omits moves unavailable in the selected generation", async () => {
    const oldGenerationPokemon = pokemonData();
    oldGenerationPokemon.moves = [{
      move: { name: "thunderbolt" },
      version_group_details: [{ version_group: { name: "red-blue" } }],
    }];
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => oldGenerationPokemon,
    });
    const rawPlan = JSON.stringify({
      message: "Changed the move.",
      actions: [{
        type: "update_team_slot",
        slot: 1,
        changes: { moves: ["thunderbolt"] },
      }],
    });

    await expect(resolveTeamEditPlan(rawPlan, context, { fetchImpl }))
      .resolves.toMatchObject({
        actions: [],
        adjustments: [expect.stringMatching(/thunderbolt.*selected format/iu)],
      });
  });

  it("allows an empty plan when no explicit edit was requested", async () => {
    await expect(resolveTeamEditPlan(
      '{"message":"No explicit change was requested.","actions":[]}',
      context,
      { fetchImpl: vi.fn() },
    )).resolves.toEqual({
      message: "No explicit change was requested.",
      actions: [],
      adjustments: [],
    });
  });

  it("allows adding a species obtainable before the campaign milestone", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => pokemonData(285, "shroomish"),
    });
    const rawPlan = JSON.stringify({
      message: "Added a Grass-type counter.",
      actions: [{
        type: "update_team_slot",
        slot: 1,
        pokemon: "shroomish",
        changes: { level: 10 },
      }],
    });

    const result = await resolveTeamEditPlan(rawPlan, campaignContext, { fetchImpl });

    expect(result.actions[0].pokemon).toMatchObject({ id: 285, name: "shroomish" });
    expect(result.actions[0].changes.level).toBe(10);
  });

  it("allows a species obtained by evolving a catchable one", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => pokemonData(262, "mightyena"),
    });
    const rawPlan = JSON.stringify({
      message: "Added the evolved Poochyena.",
      actions: [{
        type: "update_team_slot",
        slot: 1,
        pokemon: "mightyena",
        changes: { level: 20 },
      }],
    });

    await expect(resolveTeamEditPlan(rawPlan, campaignContext, { fetchImpl }))
      .resolves.toMatchObject({
        actions: [{ pokemon: { name: "mightyena" } }],
      });
  });

  it("rejects a species that is not obtainable before the milestone", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => pokemonData(330, "flygon"),
    });
    const rawPlan = JSON.stringify({
      message: "Added a Flygon.",
      actions: [{
        type: "update_team_slot",
        slot: 1,
        pokemon: "flygon",
        changes: { level: 20 },
      }],
    });

    await expect(resolveTeamEditPlan(rawPlan, campaignContext, { fetchImpl }))
      .rejects.toMatchObject({ code: "TEAM_EDIT_POKEMON_UNAVAILABLE" });
  });

  it("does not block editing an existing member in campaign mode", async () => {
    const pikachuSlot = {
      ...campaignContext,
      members: [{ id: 25, evs: emptyStats, ivs: perfectIvs }, null, null, null, null, null],
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => pokemonData(),
    });
    const rawPlan = JSON.stringify({
      message: "Raised the level.",
      actions: [{
        type: "update_team_slot",
        slot: 1,
        changes: { level: 20 },
      }],
    });

    await expect(resolveTeamEditPlan(rawPlan, pikachuSlot, { fetchImpl }))
      .resolves.toMatchObject({
        actions: [{ pokemon: { name: "pikachu" }, changes: { level: 20 } }],
      });
  });

  it("omits level-up moves learned above the effective level", async () => {
    const emeraldPokemon = {
      id: 285,
      name: "shroomish",
      species: { name: "shroomish" },
      sprites: { front_default: "shroomish.png", other: {} },
      types: [{ type: { name: "grass" } }],
      abilities: [{ ability: { name: "effect-spore" }, is_hidden: false }],
      moves: [
        {
          move: { name: "mega-drain" },
          version_group_details: [{
            version_group: { name: "emerald" },
            level_learned_at: 46,
            move_learn_method: { name: "level-up" },
          }],
        },
        {
          move: { name: "toxic" },
          version_group_details: [{
            version_group: { name: "emerald" },
            level_learned_at: 0,
            move_learn_method: { name: "machine" },
          }],
        },
      ],
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => emeraldPokemon,
    });
    const rawPlan = JSON.stringify({
      message: "Added Shroomish with moves.",
      actions: [{
        type: "update_team_slot",
        slot: 1,
        pokemon: "shroomish",
        changes: { level: 10, moves: ["mega-drain", "toxic"] },
      }],
    });

    const result = await resolveTeamEditPlan(rawPlan, campaignContext, { fetchImpl });

    expect(result.adjustments).toEqual([
      expect.stringMatching(/mega drain.*learned above level 10/iu),
    ]);
    expect(result.actions[0].changes.moves).toEqual(["toxic", "", "", ""]);
  });

  it("keeps level-up moves at or below the effective level and TM moves", async () => {
    const emeraldPokemon = {
      id: 285,
      name: "shroomish",
      species: { name: "shroomish" },
      sprites: { front_default: "shroomish.png", other: {} },
      types: [{ type: { name: "grass" } }],
      abilities: [{ ability: { name: "effect-spore" }, is_hidden: false }],
      moves: [
        {
          move: { name: "absorb" },
          version_group_details: [{
            version_group: { name: "emerald" },
            level_learned_at: 1,
            move_learn_method: { name: "level-up" },
          }],
        },
        {
          move: { name: "giga-drain" },
          version_group_details: [{
            version_group: { name: "emerald" },
            level_learned_at: 0,
            move_learn_method: { name: "machine" },
          }],
        },
      ],
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => emeraldPokemon,
    });
    const rawPlan = JSON.stringify({
      message: "Added Shroomish with moves.",
      actions: [{
        type: "update_team_slot",
        slot: 1,
        pokemon: "shroomish",
        changes: { level: 10, moves: ["absorb", "giga-drain"] },
      }],
    });

    const result = await resolveTeamEditPlan(rawPlan, campaignContext, { fetchImpl });

    expect(result.adjustments).toEqual([]);
    expect(result.actions[0].changes.moves).toEqual(["absorb", "giga-drain", "", ""]);
  });

  it("validates moves against the Fire Red version group", async () => {
    const fireredContext = {
      mode: "campaign",
      format: "firered",
      campaign: { gameId: "firered", milestoneId: "before-brock" },
      members: [null, null, null, null, null, null],
    };
    const pikachuFirered = {
      id: 25,
      name: "pikachu",
      species: { name: "pikachu" },
      sprites: { front_default: "pikachu.png", other: {} },
      types: [{ type: { name: "electric" } }],
      abilities: [{ ability: { name: "static" }, is_hidden: false }],
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
          move: { name: "dragon-claw" },
          version_group_details: [{
            version_group: { name: "scarlet-violet" },
            level_learned_at: 0,
            move_learn_method: { name: "machine" },
          }],
        },
      ],
    };
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => pikachuFirered,
    });
    const rawPlan = JSON.stringify({
      message: "Added Pikachu with moves.",
      actions: [{
        type: "update_team_slot",
        slot: 1,
        pokemon: "pikachu",
        changes: { level: 10, moves: ["thunderbolt", "dragon-claw"] },
      }],
    });

    const result = await resolveTeamEditPlan(rawPlan, fireredContext, { fetchImpl });

    expect(result.actions[0].changes.moves).toEqual(["thunderbolt", "", "", ""]);
    expect(result.adjustments).toEqual([
      expect.stringMatching(/dragon claw.*unavailable/iu),
    ]);
  });
});
