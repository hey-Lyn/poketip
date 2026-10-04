import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCustomization } from "../services/trainerCustomization";
const mocks = vi.hoisted(() => ({ searchPokemon: vi.fn() }));
vi.mock("../services/pokeApi", () => ({ searchPokemon: mocks.searchPokemon }));
import ProfileCustomization from "./ProfileCustomization";

function Editor({ fullTeam = false }) {
  const [value, setValue] = useState(() => getCustomization({ featured_team: fullTeam
    ? Array.from({ length: 6 }, (_, index) => ({ id: index + 1, name: `member${index}` })) : [] }));
  return <ProfileCustomization value={value} onChange={setValue} />;
}

describe("profile customization controls", () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("synchronizes RGB channels with each color picker without changing other colors", () => {
    render(<Editor />);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Card frame R" }), { target: { value: "25" } });
    expect(screen.getByLabelText("Card frame", { exact: true })).toHaveValue("#198caa");
    fireEvent.change(screen.getByLabelText("Background color 1", { exact: true }), { target: { value: "#abcdef" } });
    expect(screen.getByRole("spinbutton", { name: "Background color 1 G" })).toHaveValue(205);
    expect(screen.getByLabelText("Background color 2", { exact: true })).toHaveValue("#0d2630");
    expect(screen.queryByRole("button", { name: "Fairy" })).not.toBeInTheDocument();
  });
  it("stops at six team members and allows replacing one through search", async () => {
    const user = userEvent.setup();
    mocks.searchPokemon.mockResolvedValue({ pokemon: [{ id: 25, name: "pikachu", sprite: "pikachu.png" }] });
    render(<Editor fullTeam />);
    expect(screen.queryByRole("textbox", { name: "Add a Pokémon" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove member0 from featured team" }));
    await user.type(screen.getByRole("textbox", { name: "Add a Pokémon" }), "pika");
    await user.click(await screen.findByRole("button", { name: "Add pikachu to featured team" }));
    expect(screen.getByRole("button", { name: "Remove pikachu from featured team" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Add a Pokémon" })).not.toBeInTheDocument();
  });
});
