import { afterEach, describe, expect, it, vi } from "vitest";

const pokemonResponse = {
  id: 25,
  name: "pikachu",
  sprites: {
    front_default: "sprite.png",
    other: { "official-artwork": { front_default: "artwork.png" } },
  },
  types: [{ type: { name: "electric" } }],
  height: 4,
  weight: 60,
  base_experience: 112,
  abilities: [],
  cries: {},
  moves: [],
  stats: [],
};

function successfulResponse() {
  return { ok: true, json: async () => pokemonResponse };
}

describe("pokeApi cache", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("shares concurrent requests and reuses successful responses", async () => {
    const fetchMock = vi.fn(async () => successfulResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { getPokemonById } = await import("./pokeApi");

    const [first, second] = await Promise.all([
      getPokemonById(25),
      getPokemonById(25),
    ]);
    const third = await getPokemonById(25);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    expect(third).toEqual(first);
  });

  it("does not keep failed requests in the cache", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce(successfulResponse());
    vi.stubGlobal("fetch", fetchMock);
    const { getPokemonById } = await import("./pokeApi");

    await expect(getPokemonById(25)).rejects.toThrow();
    await expect(getPokemonById(25)).resolves.toMatchObject({ name: "pikachu" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
