import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import TeamSetSelector from "./TeamSetSelector";
import type { PokemonMove } from "../services/pokeApi";

const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function () { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function () { this.removeAttribute("open"); } });
});
afterAll(() => {
  if (originalShow) Object.defineProperty(HTMLDialogElement.prototype, "showModal", originalShow);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "showModal");
  if (originalClose) Object.defineProperty(HTMLDialogElement.prototype, "close", originalClose);
  else Reflect.deleteProperty(HTMLDialogElement.prototype, "close");
});

const learnedMoves: PokemonMove[] = ["thunderbolt", "volt-switch", "surf", "protect", "agility"].map((name) => ({
  name, versions: [{ level: 10, method: "level-up", versionGroup: "scarlet-violet" }],
}));

describe("TeamSetSelector", () => {
  it("searches item effects and equips the chosen item", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const onClose = vi.fn();
    render(<TeamSetSelector kind="item" item="" moves={[]} learnedMoves={[]} preferredItems={[]}
      onUpdate={onUpdate} onClose={onClose} />);
    await user.type(screen.getByRole("searchbox", { name: "Search items" }), "Leftovers");
    expect(screen.getByText(/holder restores 1\/16/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: /Leftovers/ }));
    expect(onUpdate).toHaveBeenCalledWith({ item: "Leftovers" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("limits the draft to four unique moves and commits only on Apply", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<TeamSetSelector kind="moves" item="" moves={["Thunderbolt", "Volt Switch", "", ""]}
      slot={2} learnedMoves={learnedMoves} preferredItems={[]} onUpdate={onUpdate} onClose={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Surf/ }));
    await user.click(screen.getByRole("button", { name: /Protect/ }));
    expect(screen.getByRole("button", { name: /Agility/ })).toBeDisabled();
    expect(onUpdate).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Remove Thunderbolt" }));
    await user.click(screen.getByRole("button", { name: /Agility/ }));
    await user.click(screen.getByRole("button", { name: "Apply moves" }));
    expect(onUpdate).toHaveBeenCalledWith({ moves: ["Agility", "Volt Switch", "Surf", "Protect"] });
  });

  it("browses all moves and discards changes on cancel", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const onClose = vi.fn();
    render(<TeamSetSelector kind="moves" item="" moves={[]} learnedMoves={[]} preferredItems={[]}
      onUpdate={onUpdate} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Show all moves" }));
    await user.type(screen.getByRole("searchbox", { name: "Search moves" }), "Thunderbolt");
    await user.click(screen.getByRole("button", { name: /Thunderbolt/ }));
    expect(screen.getByRole("button", { name: "Remove Thunderbolt" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
