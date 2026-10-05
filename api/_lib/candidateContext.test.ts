import { describe, expect, it, vi } from "vitest";
import { getCandidateGroundingContext, readCandidateNames } from "./candidateContext";

describe("readCandidateNames", () => {
  it("keeps at most three safe, unique candidate names", () => {
    expect(readCandidateNames('{"candidates":["Corviknight","Garchomp","corviknight","Rotom-Wash","bad name!"]}'))
      .toEqual(["corviknight", "garchomp", "rotom-wash"]);
  });

  it("rejects malformed model output", () => {
    expect(readCandidateNames("I recommend Corviknight.")).toEqual([]);
  });
});

function json(data) {
  return { ok: true, status: 200, json: vi.fn().mockResolvedValue(data) };
}

function speciesData(name, id) {
  return {
    name,
    flavor_text_entries: [],
    genera: [],
    generation: { name: "generation-iii" },
    habitat: { name: "forest" },
    capture_rate: 255,
    base_happiness: 70,
    growth_rate: { name: "medium-fast" },
    egg_groups: [],
    is_legendary: false,
    is_mythical: false,
    gender_rate: 4,
    varieties: [{
      is_default: true,
      pokemon: { url: `https://pokeapi.co/api/v2/pokemon/${id}/` },
    }],
  };
}

function typeData() {
  return {
    damage_relations: {
      double_damage_from: [],
      half_damage_from: [],
      no_damage_from: [],
    },
  };
}

function pokemonData(id, name, moves) {
  return {
    id,
    name,
    species: { url: `https://pokeapi.co/api/v2/pokemon-species/${id}/` },
    sprites: {
      front_default: `${name}.png`,
      other: { "official-artwork": { front_default: `${name}.png` } },
    },
    types: [{ type: { name: "grass" } }],
    height: 4,
    weight: 45,
    base_experience: 59,
    abilities: [{ ability: { name: "effect-spore" }, is_hidden: false }],
    cries: {},
    moves,
    stats: [{ base_stat: 60, stat: { name: "hp" } }],
  };
}

function emeraldMove(name, level, method = "level-up") {
  return {
    move: { name },
    version_group_details: [{
      version_group: { name: "emerald" },
      level_learned_at: level,
      move_learn_method: { name: method },
    }],
  };
}

function emeraldFetch(pokemonResponse) {
  return vi.fn(async (url) => {
    if (/\/pokemon\/(shroomish|garchomp)\/?$/.test(url)) return json(pokemonResponse);
    const idMatch = url.match(/\/pokemon-species\/(\d+)\/?$/);
    if (idMatch) return json(speciesData(pokemonResponse.name, Number(idMatch[1])));
    if (/\/type\/grass\/?$/.test(url)) return json(typeData());
    throw new Error(`Unexpected URL: ${url}`);
  });
}

describe("getCandidateGroundingContext", () => {
  it("marks an obtainable campaign candidate with legal moves for the level", async () => {
    const fetchImpl = emeraldFetch(pokemonData(285, "shroomish", [
      emeraldMove("absorb", 1),
      emeraldMove("mega-drain", 46),
    ]));

    const result = await getCandidateGroundingContext(["shroomish"], "emerald", {
      fetchImpl,
      campaign: { gameId: "emerald", milestoneId: "before-roxanne" },
      level: 12,
    });

    if (!result) throw new Error("Expected the candidate to resolve.");
    expect(result.candidates[0].formatEligibility).toMatchObject({
      eligible: true,
      campaign: true,
    });
    expect(result.candidates[0].legalMoves).toEqual([
      { name: "absorb", method: "level-up", level: 1 },
    ]);
  });

  it("rejects a campaign candidate that is not obtainable at the milestone", async () => {
    const fetchImpl = emeraldFetch(pokemonData(445, "garchomp", [
      emeraldMove("dragon-claw", 0, "machine"),
    ]));

    const result = await getCandidateGroundingContext(["garchomp"], "emerald", {
      fetchImpl,
      campaign: { gameId: "emerald", milestoneId: "before-roxanne" },
      level: 12,
    });

    if (!result) throw new Error("Expected the candidate to resolve.");
    expect(result.candidates[0].formatEligibility.eligible).toBe(false);
    expect(result.candidates[0].formatEligibility.reasons.join(" "))
      .toContain("not obtainable");
  });
});
