import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getPokemonById: vi.fn(),
  getPokemonSpeciesDetails: vi.fn(),
}));
const statsMocks = vi.hoisted(() => ({ getCompetitiveStats: vi.fn() }));

vi.mock("../services/pokeApi", () => apiMocks);
vi.mock("../services/showdownData", () => statsMocks);

import TeamPokemonEditor from "./TeamPokemonEditor";

const pokemon = {
  id: 25,
  name: "pikachu",
  item: "",
  ability: "static",
  nature: "",
  teraType: "electric",
  evs: {},
  moves: ["", "", "", ""],
};

describe("TeamPokemonEditor", () => {
  beforeEach(() => {
    apiMocks.getPokemonById.mockResolvedValue({
      id: 25,
      name: "pikachu",
      sprite: "pikachu.png",
      types: ["electric"],
      speciesName: "pikachu",
      abilities: [{ name: "static" }, { name: "lightning-rod" }],
      moves: [{ name: "thunderbolt" }, { name: "volt-switch" }],
      stats: [
        { name: "hp", value: 35 },
        { name: "attack", value: 55 },
        { name: "defense", value: 40 },
        { name: "special-attack", value: 50 },
        { name: "special-defense", value: 50 },
        { name: "speed", value: 90 },
      ],
    });
    apiMocks.getPokemonSpeciesDetails.mockResolvedValue({
      genderRate: 4,
      varieties: [
        { id: 25, name: "pikachu", isDefault: true },
        { id: 10080, name: "pikachu-rock-star", isDefault: false },
      ],
    });
    statsMocks.getCompetitiveStats.mockResolvedValue({
      items: [{ name: "Light Ball" }],
      abilities: [{ name: "Lightning Rod" }],
      natures: [{ name: "Timid" }],
      teraTypes: [{ name: "Fairy" }],
      moves: [{ name: "Thunderbolt" }, { name: "Volt Switch" }],
      spreads: [{
        nature: "Timid",
        evs: { hp: 4, specialAttack: 252, speed: 252 },
      }],
    });
  });

  it("applies the most popular competitive setup explicitly", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <TeamPokemonEditor
        pokemon={pokemon}
        slotIndex={4}
        format="gen9-singles"
        onClose={vi.fn()}
        onUpdate={onUpdate}
      />,
    );

    await user.click(await screen.findByRole("button", {
      name: "Apply popular setup",
    }));

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      item: "Light Ball",
      ability: "lightning-rod",
      nature: "Timid",
      teraType: "fairy",
      evs: { hp: 4, specialAttack: 252, speed: 252 },
      moves: ["Thunderbolt", "Volt Switch", "", ""],
    }));
  });

  it("organizes set fields, moves, EVs, and recommendations into tabs", async () => {
    const user = userEvent.setup();
    render(
      <TeamPokemonEditor
        pokemon={pokemon}
        slotIndex={2}
        format="gen9-singles"
        onClose={vi.fn()}
        onUpdate={vi.fn()}
      />,
    );

    expect(await screen.findByRole("tab", { name: "Set" }))
      .toHaveAttribute("aria-selected", "true");
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    for (const tab of tabs) {
      expect(tab.querySelector(".teamEditorTabIconAccent")).toBeInTheDocument();
    }
    expect(tabs[0].querySelector(".teamEditorTabIcon")).toHaveClass("teamEditorTabIcon");
    expect(screen.queryByLabelText("Move 1")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Moves & EVs" }));
    expect(screen.getByRole("tab", { name: "Moves & EVs" })).toHaveClass("isActive");
    expect(screen.getByLabelText("Move 1")).toBeInTheDocument();
    expect(screen.getByText(/Total: 0\/510/)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Final stats" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Final stats" }))
      .toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Analysis" }));
    expect(screen.getByRole("heading", { name: "Popular setup" }))
      .toBeInTheDocument();
    expect(screen.getByText("Light Ball")).toBeInTheDocument();
    expect(screen.getByText("Volt Switch")).toBeInTheDocument();
  });

  it("edits form, level, gender, and IVs", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    apiMocks.getPokemonById.mockImplementation((id) => Promise.resolve({
      id: Number(id),
      name: Number(id) === 10080 ? "pikachu-rock-star" : "pikachu",
      sprite: "pikachu.png",
      types: ["electric"],
      speciesName: "pikachu",
      abilities: [{ name: "static" }],
      moves: [{ name: "thunderbolt" }],
    }));

    render(
      <TeamPokemonEditor
        pokemon={{ ...pokemon, level: 100, gender: "", ivs: {} }}
        slotIndex={1}
        format="gen9-singles"
        onClose={vi.fn()}
        onUpdate={onUpdate}
      />,
    );

    await screen.findByRole("option", { name: "pikachu rock star" });
    await user.selectOptions(screen.getByLabelText("Form"), "10080");
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: 10080,
      name: "pikachu-rock-star",
    }));

    await user.selectOptions(screen.getByLabelText("Gender"), "female");
    expect(onUpdate).toHaveBeenCalledWith({ gender: "female" });

    await user.click(screen.getByRole("tab", { name: "Moves & EVs" }));
    const hpIv = screen.getByLabelText("HP IVs");
    await user.clear(hpIv);
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      ivs: expect.objectContaining({ hp: 0 }),
    }));
  });

  it("edits IVs with the slider and preserves the other stats", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<TeamPokemonEditor pokemon={{ ...pokemon, ivs: { hp: 31, attack: 0 } }}
      slotIndex={0} format="gen9-singles" onClose={vi.fn()} onUpdate={onUpdate} />);
    await user.click(await screen.findByRole("tab", { name: "Moves & EVs" }));
    expect(screen.getByRole("slider", { name: "HP IV slider" })).toHaveValue("31");
    expect(screen.getByRole("slider", { name: "Atk IV slider" })).toHaveValue("0");
    fireEvent.change(screen.getByRole("slider", { name: "HP IV slider" }), { target: { value: "12" } });
    expect(onUpdate).toHaveBeenCalledWith({ ivs: { hp: 12, attack: 0 } });
    expect(screen.getByRole("img", { name: /Final stats radar/ })).toBeInTheDocument();
  });
});
