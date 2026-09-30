import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TypeDefenses from "./TypeDefenses";

describe("TypeDefenses", () => {
  it("groups weaknesses, resistances, immunities, and neutral damage", () => {
    render(
      <TypeDefenses
        pokemonName="testmon"
        defenses={[
          { type: "fire", multiplier: 2 },
          { type: "water", multiplier: 0.5 },
          { type: "ground", multiplier: 0 },
          { type: "normal", multiplier: 1 },
        ]}
      />,
    );

    expect(screen.getByText("fire ×2")).toBeInTheDocument();
    expect(screen.getByText("water ×0.5")).toBeInTheDocument();
    expect(screen.getByText("ground ×0")).toBeInTheDocument();
    expect(screen.getByText("×1")).toBeInTheDocument();
  });
});
