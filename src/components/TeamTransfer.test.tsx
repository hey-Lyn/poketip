import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ getPokemonById: vi.fn() }));
vi.mock("../services/pokeApi", () => apiMocks);

import TeamTransfer from "./TeamTransfer";

describe("TeamTransfer", () => {
  it("exports the current team and imports pasted Showdown text", async () => {
    const user = userEvent.setup();
    const onImportTeam = vi.fn();
    apiMocks.getPokemonById.mockResolvedValue({
      id: 25,
      name: "pikachu",
      sprite: "pikachu.png",
      types: ["electric"],
      abilities: [{ name: "static" }],
    });
    const team = [{
      id: 25,
      name: "pikachu",
      sprite: "pikachu.png",
      types: ["electric"],
      item: "Light Ball",
      ability: "static",
      nature: "Timid",
      teraType: "electric",
      evs: { specialAttack: 252, speed: 252 },
      moves: ["Thunderbolt", "Volt Switch", "", ""],
    }];

    render(<TeamTransfer team={team} onImportTeam={onImportTeam} />);
    await user.click(screen.getByText("Import / export"));

    expect((screen.getByRole("textbox", {
      name: "Export to Pokémon Showdown",
    }) as HTMLTextAreaElement).value).toContain("Pikachu @ Light Ball");
    await user.type(
      screen.getByRole("textbox", { name: "Import from Pokémon Showdown" }),
      "Pikachu @ Light Ball{enter}Ability: Static{enter}- Thunderbolt",
    );
    await user.click(screen.getByRole("button", { name: "Import team" }));

    expect(await screen.findByRole("status"))
      .toHaveTextContent("Imported 1 Pokémon.");
    expect(onImportTeam).toHaveBeenCalledWith([
      expect.objectContaining({ id: 25, item: "Light Ball" }),
    ]);
  });
});
