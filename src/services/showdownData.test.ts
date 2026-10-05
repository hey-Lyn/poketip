import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearShowdownCache,
  DEFAULT_COMPETITIVE_FORMAT,
  getCompetitiveFormat,
  getCompetitiveStats,
  getShowdownTier,
} from "./showdownData";

describe("showdownData", () => {
  beforeEach(() => {
    clearShowdownCache();
    vi.stubGlobal("fetch", vi.fn().mockImplementation((url) => {
      if (url.includes("formats-data")) {
        return Promise.resolve({
          ok: true,
          text: vi.fn().mockResolvedValue(
            'exports.BattleFormatsData = {pikachu:{tier:"ZU",doublesTier:"(DUU)",natDexTier:"RU"},bulbasaur:{tier:"LC"}};',
          ),
        });
      }

      return Promise.resolve({
        ok: true,
        json: vi.fn().mockResolvedValue({
          battles: 1000,
          pokemon: {
            Pikachu: {
              usage: { weighted: 0.12 },
              abilities: { Static: 0.25, "Lightning Rod": 0.75 },
              items: { "Light Ball": 0.9 },
              teraTypes: { Fairy: 0.6, Electric: 0.4 },
              moves: { Nothing: 0.8, Thunderbolt: 0.7 },
              spreads: {
                "Timid:0/0/0/252/4/252": 0.4,
                "Timid:4/0/0/252/0/252": 0.3,
                "Jolly:4/252/0/0/0/252": 0.2,
              },
              teammates: { Charizard: 0.3 },
              counters: { Dugtrio: [100, 0.4, 0.3] },
            },
          },
        }),
      });
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it("returns the tier for each supported competitive environment", async () => {
    await expect(getShowdownTier("pikachu", "gen9-singles"))
      .resolves.toBe("ZU");
    await expect(getShowdownTier("pikachu", "gen9-doubles"))
      .resolves.toBe("(DUU)");
    await expect(getShowdownTier("pikachu", "national-dex"))
      .resolves.toBe("RU");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("falls back safely for unknown formats and Pokémon", async () => {
    expect(getCompetitiveFormat("unknown").id).toBe(DEFAULT_COMPETITIVE_FORMAT);
    await expect(getShowdownTier("missingno", "gen9-singles"))
      .resolves.toBe("Unranked");
    await expect(getShowdownTier("bulbasaur", "gen9-doubles"))
      .resolves.toBe("LC");
  });

  it("formats the latest usage data for the selected Pokémon", async () => {
    const stats = await getCompetitiveStats(["pikachu", "pika"], "gen9-singles");
    if (!stats) throw new Error("Expected competitive statistics for Pikachu.");

    expect(stats).toMatchObject({
      battles: 1000,
      usage: 0.12,
      abilities: expect.arrayContaining([
        { name: "Lightning Rod", value: 0.75 },
      ]),
      moves: [{ name: "Thunderbolt", value: 0.7 }],
      teraTypes: [
        { name: "Fairy", value: 0.6 },
        { name: "Electric", value: 0.4 },
      ],
      natures: [
        { name: "Timid", value: 0.7 },
        { name: "Jolly", value: 0.2 },
      ],
      counters: [{ name: "Dugtrio", sampleSize: 100, value: 0.7 }],
    });
    expect(stats.spreads[0]).toMatchObject({
      name: "Timid · 252 SpA / 4 SpD / 252 Spe",
      value: 0.4,
      nature: "Timid",
      evs: { specialAttack: 252, specialDefense: 4, speed: 252 },
    });
    expect(stats.moves.some(({ name }) => name === "Nothing")).toBe(false);
  });

  it("maps the additional formats to their statistics files", async () => {
    await getCompetitiveStats("pikachu", "anything-goes");
    await getCompetitiveStats("pikachu", "gen9-ubers");
    await getCompetitiveStats("pikachu", "gen9-monotype");

    expect(fetch).toHaveBeenCalledWith(
      "https://data.pkmn.cc/stats/gen9anythinggoes.json",
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://data.pkmn.cc/stats/gen9ubers.json",
    );
    expect(fetch).toHaveBeenCalledWith(
      "https://data.pkmn.cc/stats/gen9monotype.json",
    );
  });
});
