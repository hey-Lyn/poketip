import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { pikachu } from "../test/fixtures";
import PokemonCard from "./PokemonCard";

describe("PokemonCard", () => {
  it("shows the Pokémon data and selects it when clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    const { container } = render(<PokemonCard pokemon={pikachu} onSelect={onSelect} />);

    expect(screen.getByText("#025")).toBeInTheDocument();
    expect(screen.getByText("pikachu")).toBeInTheDocument();
    expect(screen.getByText("electric")).toBeInTheDocument();
    expect(container.querySelector(".pokemonImage"))
      .toHaveAttribute("src", "pikachu-sprite.png");

    await user.click(screen.getByRole("button", { name: /view details for pikachu/i }));
    expect(onSelect).toHaveBeenCalledWith(pikachu);
  });
});
