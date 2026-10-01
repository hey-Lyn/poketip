import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pikachu, pikachuSpecies } from "../test/fixtures";

const apiMocks = vi.hoisted(() => ({
  getPokemonById: vi.fn(),
  getPokemonEncounters: vi.fn(),
  getPokemonSpeciesDetails: vi.fn(),
  getPokemonTypeEffectiveness: vi.fn(),
}));
const showdownMocks = vi.hoisted(() => ({
  getCompetitiveStats: vi.fn(),
  getShowdownTier: vi.fn(),
}));

vi.mock("../services/pokeApi", () => apiMocks);
vi.mock("../services/showdownData", async (importOriginal) => ({
  ...await importOriginal(),
  getCompetitiveStats: showdownMocks.getCompetitiveStats,
  getShowdownTier: showdownMocks.getShowdownTier,
}));

import PokemonDetailsPage from "./PokemonDetailsPage";

describe("PokemonDetailsPage", () => {
  beforeEach(() => {
    apiMocks.getPokemonById.mockResolvedValue(pikachu);
    apiMocks.getPokemonSpeciesDetails.mockResolvedValue(pikachuSpecies);
    apiMocks.getPokemonTypeEffectiveness.mockResolvedValue([
      { type: "ground", multiplier: 2 },
      { type: "electric", multiplier: 0.5 },
      { type: "normal", multiplier: 1 },
    ]);
    apiMocks.getPokemonEncounters.mockResolvedValue([
      {
        location: "kanto-route-2",
        version: "yellow",
        method: "walk",
        minLevel: 3,
        maxLevel: 5,
        chance: 10,
        conditions: [],
      },
      {
        location: "kanto-route-2",
        version: "yellow",
        method: "surf",
        minLevel: 5,
        maxLevel: 10,
        chance: 30,
        conditions: ["time-day"],
      },
      {
        location: "seafoam-islands-1f",
        version: "yellow",
        method: "walk",
        minLevel: 22,
        maxLevel: 26,
        chance: 10,
        conditions: [],
      },
      {
        location: "seafoam-islands-b1f",
        version: "yellow",
        method: "walk",
        minLevel: 22,
        maxLevel: 26,
        chance: 10,
        conditions: [],
      },
      {
        location: "lost-cave-room-1",
        version: "yellow",
        method: "walk",
        minLevel: 37,
        maxLevel: 37,
        chance: 20,
        conditions: [],
      },
      {
        location: "lost-cave-room-2",
        version: "yellow",
        method: "walk",
        minLevel: 37,
        maxLevel: 37,
        chance: 20,
        conditions: [],
      },
    ]);
    showdownMocks.getShowdownTier.mockImplementation((name, format) =>
      Promise.resolve(format === "national-dex" ? "RU" : "ZU"),
    );
    showdownMocks.getCompetitiveStats.mockResolvedValue({
      battles: 730502,
      usage: 0.0001,
      abilities: [{ name: "Lightning Rod", value: 0.7919 }],
      items: [{ name: "Light Ball", value: 0.9391 }],
      teraTypes: [{ name: "Fairy", value: 0.6837 }],
      moves: [{ name: "Thunderbolt", value: 0.6573 }],
      natures: [{ name: "Timid", value: 0.55 }],
      spreads: [
        { name: "Timid · 4 HP / 252 SpA / 252 Spe", value: 0.2901 },
      ],
      teammates: [{ name: "Great Tusk", value: 0.3084 }],
      counters: [],
    });
  });

  it("shows species data, abilities, stats, and versioned moves", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/pokemon/25"]}>
        <Routes>
          <Route path="/pokemon/:pokemonId" element={<PokemonDetailsPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("heading", { name: "pikachu", level: 1 }))
      .toBeInTheDocument();
    expect(screen.getByText("Mouse Pokémon")).toBeInTheDocument();
    expect(screen.getByText("lightning rod")).toBeInTheDocument();
    expect(screen.getByText("thunder shock")).toBeInTheDocument();
    expect(screen.getByText("thunderbolt")).toBeInTheDocument();
    expect(screen.getByText("TM / HM")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Type defenses" }))
      .toBeInTheDocument();
    expect(screen.getByText("ground ×2")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Move game version" }))
      .toHaveValue("scarlet-violet");
    expect(screen.getByRole("combobox", { name: "Encounter game version" }))
      .toHaveValue("yellow");
    expect(screen.getByRole("heading", { name: "Locations" }))
      .toBeInTheDocument();
    expect(screen.getByText("kanto route 2")).toBeInTheDocument();
    expect(screen.getByText("walk, surf")).toBeInTheDocument();
    expect(screen.getByText("3–10")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
    expect(screen.getByText("seafoam islands")).toBeInTheDocument();
    expect(screen.getByText("1F, B1F")).toBeInTheDocument();
    expect(screen.getByText("lost cave")).toBeInTheDocument();
    expect(screen.getByText("Room 1, Room 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Preview level 100 stats" }));
    expect(screen.getByRole("heading", { name: "Final stats" }))
      .toBeInTheDocument();
    expect(screen.getByText("211")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hide level 100 preview" }));
    expect(screen.queryByRole("heading", { name: "Final stats" }))
      .not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /view competitive side/i }));
    expect(screen.getByText("Competitive data")).toBeInTheDocument();
    expect(await screen.findByText("ZU")).toBeInTheDocument();
    expect(await screen.findByText("Light Ball")).toBeInTheDocument();
    expect(screen.getByText("Timid · 4 HP / 252 SpA / 252 Spe"))
      .toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tera Types" }))
      .toBeInTheDocument();
    expect(screen.getByText("79.2%")).toBeInTheDocument();
    expect(screen.getByText(/730,502 battles/)).toBeInTheDocument();
    expect(screen.getByText("Flexible special attacker")).toBeInTheDocument();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Format" }),
      "national-dex",
    );
    expect(await screen.findByText("RU")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Gen 9 Anything Goes" }))
      .toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Gen 9 Ubers" }))
      .toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Gen 9 Monotype" }))
      .toBeInTheDocument();
    expect(screen.getByRole("button", { name: /view overview/i }))
      .toBeInTheDocument();
  });
});
