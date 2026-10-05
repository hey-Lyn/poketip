import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCompetitiveContextCache,
  getCompetitiveTeamContext,
} from "./competitiveContext";

describe("getCompetitiveTeamContext", () => {
  beforeEach(() => clearCompetitiveContextCache());

  it("provides compact selected-format usage context for team members", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        battles: 1200,
        pokemon: {
          Pikachu: {
            usage: { weighted: 0.12 },
            abilities: { Static: 0.2, "Lightning Rod": 0.8 },
            items: { "Light Ball": 0.95 },
            teraTypes: { Fairy: 0.7 },
            moves: { Thunderbolt: 0.9, Nothing: 0.5 },
            spreads: { "Timid:0/0/0/252/4/252": 0.6 },
            teammates: { Pelipper: 0.3 },
          },
        },
      }),
    });

    const result = await getCompetitiveTeamContext(
      "gen9-singles",
      ["pikachu", "raichu"],
      { fetchImpl },
    );
    if (!result) throw new Error("Expected competitive statistics to load.");

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://data.pkmn.cc/stats/gen9ou.json",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result.members[0]).toMatchObject({
      name: "pikachu",
      stats: {
        sampleBattles: 1200,
        usage: 0.12,
        commonAbilities: [{ name: "Lightning Rod", value: 0.8 }, { name: "Static", value: 0.2 }],
        commonItems: [{ name: "Light Ball", value: 0.95 }],
        commonMoves: [{ name: "Thunderbolt", value: 0.9 }],
        commonEvSpreads: [{
          nature: "Timid",
          evs: {
            hp: 0,
            attack: 0,
            defense: 0,
            specialAttack: 252,
            specialDefense: 4,
            speed: 252,
          },
          value: 0.6,
        }],
      },
    });
    expect(result.members[1]).toEqual({ name: "raichu", stats: null });
  });

  it("fails open when competitive statistics are unavailable", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false });
    await expect(getCompetitiveTeamContext(
      "gen9-singles",
      ["pikachu"],
      { fetchImpl },
    )).resolves.toBeNull();
  });

  it("identifies common type-based threats against the verified team types", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        battles: 1200,
        pokemon: {
          GreatTusk: { usage: { weighted: 0.3 }, moves: { HeadlongRush: 0.8 } },
        },
      }),
    });

    const result = await getCompetitiveTeamContext(
      "gen9-singles",
      ["pikachu"],
      { fetchImpl, teamTypes: [["electric"]] },
    );

    if (!result) throw new Error("Expected competitive statistics to load.");
    expect(result.threats).toContainEqual(expect.objectContaining({
      name: "greattusk",
      types: expect.arrayContaining(["ground"]),
      risk: expect.any(String),
    }));
  });
});
