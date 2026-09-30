import { describe, expect, it, vi } from "vitest";
import { getPokemonGroundingContext } from "./pokemonContext.js";

function jsonResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(data),
  };
}

describe("getPokemonGroundingContext", () => {
  it("loads a compact verified Pokémon context and calculates matchups", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.endsWith("/pokemon/999")) {
        return jsonResponse({
          id: 999,
          name: "test-pikachu",
          species: { url: "https://pokeapi.co/api/v2/pokemon-species/25/" },
          types: [{ type: { name: "electric" } }],
          height: 4,
          weight: 60,
          base_experience: 112,
          abilities: [
            { ability: { name: "static" }, is_hidden: false },
            { ability: { name: "lightning-rod" }, is_hidden: true },
          ],
          stats: [
            { base_stat: 35, stat: { name: "hp" } },
            { base_stat: 90, stat: { name: "speed" } },
          ],
          moves: [{ move: { name: "thunderbolt" } }],
        });
      }

      if (url.endsWith("/pokemon-species/25")) {
        return jsonResponse({
          id: 25,
          name: "pikachu",
          flavor_text_entries: [{
            flavor_text: "Stores electricity\nin its cheeks.",
            language: { name: "en" },
          }],
          genera: [{ genus: "Mouse Pokémon", language: { name: "en" } }],
          generation: { name: "generation-i" },
          habitat: { name: "forest" },
          capture_rate: 190,
          base_happiness: 50,
          growth_rate: { name: "medium" },
          egg_groups: [{ name: "field" }, { name: "fairy" }],
          is_legendary: false,
          is_mythical: false,
        });
      }

      if (url.endsWith("/type/electric")) {
        return jsonResponse({
          damage_relations: {
            double_damage_from: [{ name: "ground" }],
            half_damage_from: [
              { name: "electric" },
              { name: "flying" },
              { name: "steel" },
            ],
            no_damage_from: [],
          },
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });

    const context = await getPokemonGroundingContext(999, { fetchImpl });

    expect(context).toMatchObject({
      kind: "pokemon",
      source: "PokéAPI",
      pokemon: {
        id: 999,
        name: "test-pikachu",
        species: "pikachu",
        types: ["electric"],
        heightMeters: 0.4,
        weightKilograms: 6,
        baseStats: { hp: 35, speed: 90 },
        defensiveMatchups: {
          weaknesses: [{ type: "ground", multiplier: 2 }],
          resistances: [
            { type: "electric", multiplier: 0.5 },
            { type: "flying", multiplier: 0.5 },
            { type: "steel", multiplier: 0.5 },
          ],
          immunities: [],
        },
      },
    });
    expect(context.sources).toHaveLength(3);
    expect(context.pokemon.description).toBe(
      "Stores electricity in its cheeks.",
    );
  });

  it("returns a safe not-found error", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 404));

    await expect(
      getPokemonGroundingContext(10_001, { fetchImpl }),
    ).rejects.toMatchObject({ code: "POKEMON_NOT_FOUND", status: 404 });
  });
});
