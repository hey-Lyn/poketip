import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ validateShowdownTeam: vi.fn() }));
vi.mock("../services/teamValidation", () => mocks);
import TeamValidation from "./TeamValidation";
import { createTeamMember } from "../services/teamStorage";

const pikachu = createTeamMember({ id: 25, name: "pikachu", sprite: "pikachu.png", types: ["electric"] }, {
  ability: "static", nature: "Timid", moves: ["Thunderbolt"],
});
const legal = { valid: true, format: "gen9-singles", showdownFormat: "gen9ou", problems: [] };
afterEach(() => mocks.validateShowdownTeam.mockReset());

describe("TeamValidation", () => {
  it("disables validation for an empty team", () => {
    render(<TeamValidation team={Array(6).fill(null)} format="gen9-singles" />);
    expect(screen.getByRole("button", { name: "Validate team" })).toBeDisabled();
    expect(screen.getByText("Add a Pokémon to validate your team.")).toBeInTheDocument();
  });
  it("validates on demand and shows the format-specific result", async () => {
    mocks.validateShowdownTeam.mockResolvedValue(legal);
    render(<TeamValidation team={[pikachu]} format="gen9-singles" />);
    expect(mocks.validateShowdownTeam).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Validate team" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Your team is valid for Gen 9 Singles (OU).");
    expect(mocks.validateShowdownTeam).toHaveBeenCalledWith(expect.stringContaining("- Thunderbolt"), "gen9-singles", expect.any(AbortSignal));
  });
  it("shows official problems, preserving species names", async () => {
    mocks.validateShowdownTeam.mockResolvedValue({ ...legal, valid: false, problems: ["Pikachu can't have Intimidate.", "Your team must share a type."] });
    render(<TeamValidation team={[pikachu]} format="gen9-monotype" />);
    await userEvent.click(screen.getByRole("button", { name: "Validate team" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Your team needs changes for Gen 9 Monotype.");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Pikachu can't have Intimidate.")).toBeInTheDocument();
  });
  it("allows retry after a network error", async () => {
    mocks.validateShowdownTeam.mockRejectedValueOnce(new Error("Connection failed.")).mockResolvedValueOnce(legal);
    render(<TeamValidation team={[pikachu]} format="gen9-singles" />);
    await userEvent.click(screen.getByRole("button", { name: "Validate team" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection failed.");
    await userEvent.click(screen.getByRole("button", { name: "Validate team" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Your team is valid");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it.each(["format", "moves", "item", "ability", "evs", "ivs", "level", "teraType"])("clears results when %s changes", async (field) => {
    mocks.validateShowdownTeam.mockResolvedValue(legal);
    const { rerender } = render(<TeamValidation team={[pikachu]} format="gen9-singles" />);
    await userEvent.click(screen.getByRole("button", { name: "Validate team" }));
    await screen.findByRole("status");
    const changes = { moves: ["Surf"], item: "Light Ball", ability: "lightning-rod", evs: { ...pikachu.evs, speed: 252 }, ivs: { ...pikachu.ivs, attack: 0 }, level: 50, teraType: "fairy" };
    rerender(<TeamValidation team={[{ ...pikachu, ...(field === "format" ? {} : { [field]: changes[field] }) }]} format={field === "format" ? "gen9-ubers" : "gen9-singles"} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(mocks.validateShowdownTeam).toHaveBeenCalledTimes(1);
  });
  it("cancels pending checks and ignores their late response after an edit", async () => {
    let resolve;
    mocks.validateShowdownTeam.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const { rerender } = render(<TeamValidation team={[pikachu]} format="gen9-singles" />);
    await userEvent.click(screen.getByRole("button", { name: "Validate team" }));
    expect(screen.getByRole("button", { name: "Validating..." })).toBeDisabled();
    const signal = mocks.validateShowdownTeam.mock.calls[0][2];
    rerender(<TeamValidation team={[pikachu]} format="gen9-ubers" />);
    expect(signal.aborted).toBe(true);
    await act(async () => resolve(legal));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validate team" })).toBeEnabled();
  });
  it("cancels pending checks on unmount", async () => {
    mocks.validateShowdownTeam.mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<TeamValidation team={[pikachu]} format="gen9-singles" />);
    await userEvent.click(screen.getByRole("button", { name: "Validate team" }));
    await waitFor(() => expect(mocks.validateShowdownTeam).toHaveBeenCalledTimes(1));
    const signal = mocks.validateShowdownTeam.mock.calls[0][2];
    unmount();
    expect(signal.aborted).toBe(true);
  });
});
