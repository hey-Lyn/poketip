import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  getPokemonById: vi.fn(),
  getMoveType: vi.fn(),
  searchPokemon: vi.fn(),
}));

vi.mock("../services/pokeApi", () => apiMocks);

import TeamBuilderPage from "./TeamBuilderPage";

const pikachu = {
  id: 25,
  name: "pikachu",
  sprite: "pikachu.png",
  types: ["electric"],
};

describe("TeamBuilderPage", () => {
  beforeEach(() => {
    apiMocks.searchPokemon.mockResolvedValue({ pokemon: [pikachu], count: 1 });
    apiMocks.getMoveType.mockImplementation((move) => Promise.resolve({
      "ice-beam": "ice",
      thunderbolt: "electric",
    }[move.toLowerCase().replaceAll(" ", "-")]));
  });

  it("renders six slots and exposes move and remove actions", async () => {
    const user = userEvent.setup();
    const onMovePokemon = vi.fn();
    const onRemovePokemon = vi.fn();

    render(
      <MemoryRouter>
        <TeamBuilderPage
          team={[pikachu]}
          format="gen9-singles"
          onFormatChange={vi.fn()}
          onImportTeam={vi.fn()}
          onMovePokemon={onMovePokemon}
          onRemovePokemon={onRemovePokemon}
          onSetPokemon={vi.fn()}
          onUpdatePokemon={vi.fn()}
        />
      </MemoryRouter>,
    );

    expect(screen.getAllByText(/Slot [1-6]/)).toHaveLength(6);
    expect(screen.getByRole("heading", { name: "pikachu" }))
      .toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Empty slot" }))
      .toHaveLength(5);

    await user.click(screen.getByRole("button", { name: "Remove pikachu" }));
    expect(onRemovePokemon).toHaveBeenCalledWith(0);
    expect(screen.getByRole("button", { name: "Move pikachu left" }))
      .toBeDisabled();
  });

  it("searches inside a chosen empty slot and adds the result there", async () => {
    const user = userEvent.setup();
    const onSetPokemon = vi.fn();

    render(
      <MemoryRouter>
        <TeamBuilderPage
          team={Array(6).fill(null)}
          format="gen9-singles"
          onFormatChange={vi.fn()}
          onImportTeam={vi.fn()}
          onMovePokemon={vi.fn()}
          onRemovePokemon={vi.fn()}
          onSetPokemon={onSetPokemon}
          onUpdatePokemon={vi.fn()}
        />
      </MemoryRouter>,
    );

    await user.click(
      screen.getAllByRole("button", { name: "Add Pokémon" })[4],
    );
    expect(screen.getByRole("heading", { name: "Choose a Pokémon" }))
      .toBeInTheDocument();
    expect(screen.getAllByText("Slot 5")).toHaveLength(2);

    await user.type(
      screen.getByRole("searchbox", { name: "Search Pokémon" }),
      "pika",
    );
    await user.click(await screen.findByRole("button", {
      name: "Add pikachu to slot 5",
    }));

    expect(onSetPokemon).toHaveBeenCalledWith(4, pikachu);
    expect(screen.queryByRole("heading", { name: "Choose a Pokémon" }))
      .not.toBeInTheDocument();
  });

  it("switches from competitive formats to the Emerald campaign controls", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <TeamBuilderPage
          team={Array(6).fill(null)}
          format="gen9-singles"
          onFormatChange={vi.fn()}
          onImportTeam={vi.fn()}
          onMovePokemon={vi.fn()}
          onRemovePokemon={vi.fn()}
          onSetPokemon={vi.fn()}
          onUpdatePokemon={vi.fn()}
        />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Main games" }));
    expect(screen.queryByRole("button", { name: "Validate team" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Game")).toHaveValue("emerald");
    expect(screen.getByLabelText("Progress")).toHaveValue("before-roxanne");
    await user.click(screen.getByRole("button", { name: "Competitive" }));
    expect(screen.getByRole("button", { name: "Validate team" })).toBeDisabled();
  });

  it("calculates shared weaknesses and offensive move coverage", async () => {
    render(
      <MemoryRouter>
        <TeamBuilderPage
          team={[
            { id: 7, name: "squirtle", sprite: "squirtle.png", types: ["water"], moves: ["Ice Beam"] },
            { id: 130, name: "gyarados", sprite: "gyarados.png", types: ["water", "flying"], moves: ["Thunderbolt"] },
          ]}
          format="gen9-singles"
          onFormatChange={vi.fn()}
          onImportTeam={vi.fn()}
          onMovePokemon={vi.fn()}
          onRemovePokemon={vi.fn()}
          onSetPokemon={vi.fn()}
          onUpdatePokemon={vi.fn()}
        />
      </MemoryRouter>,
    );

    const weaknesses = screen.getByRole("heading", { name: "Shared weaknesses" })
      .closest("section");
    if (!weaknesses) throw new Error("Expected the shared weaknesses section.");
    expect(within(weaknesses).getByText("electric")).toBeInTheDocument();
    expect(within(weaknesses).getByText("2 weak · up to ×4")).toBeInTheDocument();
    expect(await screen.findByText("5/18")).toBeInTheDocument();
    expect(screen.getByText(/super-effective coverage from 2 selected move types/i))
      .toBeInTheDocument();
  });
});
