import { describe, expect, it } from "vitest";
import { verifyPokemonFormat } from "./formatLegality.js";

describe("verifyPokemonFormat", () => {
  it("excludes an AG Pokémon from Gen 9 OU", () => {
    const result = verifyPokemonFormat({ name: "miraidon", types: ["electric", "dragon"] }, "gen9-singles");
    expect(result.eligible).toBe(false);
    expect(result.tier).toBe("AG");
  });

  it("allows an Uber Pokémon in Ubers", () => {
    const result = verifyPokemonFormat({ name: "rayquaza", types: ["dragon", "flying"] }, "gen9-ubers");
    expect(result.eligible).toBe(true);
  });

  it("rejects a Monotype candidate that cannot share the team type", () => {
    const result = verifyPokemonFormat(
      { name: "pikachu", types: ["electric"] },
      "gen9-monotype",
      [["water"], ["water", "flying"]],
    );
    expect(result.eligible).toBe(false);
    expect(result.reasons.join(" ")).toContain("Monotype");
  });
});
