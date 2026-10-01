import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pikachu } from "../test/fixtures";

const apiMocks = vi.hoisted(() => ({
  getPokemonDescription: vi.fn(),
  getPokemonPage: vi.fn(),
  searchPokemon: vi.fn(),
}));

vi.mock("../services/pokeApi", () => apiMocks);

import PokedexPage from "./PokedexPage";

describe("PokedexPage", () => {
  beforeEach(() => {
    apiMocks.getPokemonPage.mockResolvedValue({ pokemon: [pikachu], count: 1 });
    apiMocks.getPokemonDescription.mockResolvedValue("Pikachu description.");
  });

  it("loads cards and opens the quick details panel", async () => {
    const user = userEvent.setup();
    const onAddToTeam = vi.fn();
    render(
      <MemoryRouter>
        <PokedexPage team={[]} onAddToTeam={onAddToTeam} />
      </MemoryRouter>,
    );

    const card = await screen.findByRole("button", {
      name: /view details for pikachu/i,
    });
    await user.click(card);

    expect(await screen.findByText("Pikachu description.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View full page" }))
      .toHaveAttribute("href", "/pokemon/25");
    expect(screen.getByRole("combobox", { name: "Region" })).toHaveValue("all");
    await user.click(screen.getByRole("button", { name: "Add to team" }));
    expect(onAddToTeam).toHaveBeenCalledWith(pikachu);
  });
});
