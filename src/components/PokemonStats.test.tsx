import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { pikachu } from "../test/fixtures";
import PokemonStats from "./PokemonStats";

describe("PokemonStats", () => {
  it("renders formatted stat labels, values, and progress bars", () => {
    const { container } = render(<PokemonStats stats={pikachu.stats} />);

    expect(screen.getByRole("heading", { name: "Base stats", level: 2 }))
      .toBeInTheDocument();
    expect(screen.getByText("special attack")).toBeInTheDocument();
    expect(screen.getByText("35")).toBeInTheDocument();
    expect(container.querySelectorAll(".pokemonStatTrack > span")).toHaveLength(2);
  });
});
