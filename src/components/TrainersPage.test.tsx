import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { trainerFixture } from "../test/trainerFixtures";

const authMocks = vi.hoisted(() => ({ useAuth: vi.fn() }));
const trainerMocks = vi.hoisted(() => ({ searchTrainers: vi.fn() }));
vi.mock("../hooks/useAuth", () => authMocks);
vi.mock("../services/trainers", () => trainerMocks);
import TrainersPage from "./TrainersPage";

function renderPage(path = "/trainers") {
  return render(<MemoryRouter initialEntries={[path]}><TrainersPage /></MemoryRouter>);
}

describe("trainer directory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.useAuth.mockReturnValue({ user: { id: "viewer" }, loading: false });
    trainerMocks.searchTrainers.mockResolvedValue({ trainers: [trainerFixture], hasNextPage: false });
  });

  it("requires sign-in without requesting any profiles", () => {
    authMocks.useAuth.mockReturnValue({ user: null, loading: false });
    renderPage();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/profile");
    expect(trainerMocks.searchTrainers).not.toHaveBeenCalled();
  });

  it("shows read-only trainer cards linking to the shared profile", async () => {
    renderPage();
    expect(await screen.findByRole("heading", { name: "Ash" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Ash's profile" })).toHaveAttribute("href", "/trainers/ash_25");
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
  });

  it("retains the search when paging and resets the page when typing", async () => {
    const user = userEvent.setup();
    trainerMocks.searchTrainers.mockResolvedValue({ trainers: [trainerFixture], hasNextPage: true });
    renderPage("/trainers?q=ash&page=1");
    await screen.findByRole("heading", { name: "Ash" });
    expect(trainerMocks.searchTrainers).toHaveBeenLastCalledWith("ash", 1);
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(trainerMocks.searchTrainers).toHaveBeenLastCalledWith("ash", 2));
    await user.clear(screen.getByRole("searchbox", { name: "Search trainers" }));
    await user.type(screen.getByRole("searchbox", { name: "Search trainers" }), "misty");
    await waitFor(() => expect(trainerMocks.searchTrainers).toHaveBeenLastCalledWith("misty", 0));
  });

  it("ignores a late search result for a previous query", async () => {
    const user = userEvent.setup();
    let resolveOld;
    trainerMocks.searchTrainers.mockImplementation((query) => query === "ash"
      ? new Promise((resolve) => { resolveOld = resolve; })
      : Promise.resolve({ trainers: [{ ...trainerFixture, id: "u2", display_name: "Misty", username: "misty" }], hasNextPage: false }));
    renderPage("/trainers?q=ash");
    await waitFor(() => expect(trainerMocks.searchTrainers).toHaveBeenCalledWith("ash", 0));
    const search = screen.getByRole("searchbox", { name: "Search trainers" });
    await user.clear(search);
    await user.type(search, "misty");
    await screen.findByRole("heading", { name: "Misty" });
    await act(async () => { resolveOld({ trainers: [trainerFixture], hasNextPage: false }); });
    expect(screen.queryByRole("heading", { name: "Ash" })).not.toBeInTheDocument();
  });

  it("clears a search from a later page and marks the viewer's own profile", async () => {
    const user = userEvent.setup();
    authMocks.useAuth.mockReturnValue({ user: { id: trainerFixture.id }, loading: false });
    renderPage("/trainers?q=ash&page=2");
    await screen.findByRole("heading", { name: "Ash" });
    expect(screen.getByText("You")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    await waitFor(() => expect(trainerMocks.searchTrainers).toHaveBeenLastCalledWith("", 0));
    expect(screen.getByRole("searchbox", { name: "Search trainers" })).toHaveValue("");
    expect(screen.getByText("Page 1")).toBeInTheDocument();
  });

  it("shows an empty community and recovers from a request failure", async () => {
    const user = userEvent.setup();
    trainerMocks.searchTrainers.mockRejectedValueOnce(new Error("Unable to load trainers. Please try again."));
    trainerMocks.searchTrainers.mockResolvedValue({ trainers: [], hasNextPage: false });
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load trainers");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "The community starts with you" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up my profile" })).toHaveAttribute("href", "/profile");
  });

  it("removes loaded profiles immediately when the user signs out", async () => {
    const { rerender } = renderPage();
    await screen.findByRole("heading", { name: "Ash" });
    authMocks.useAuth.mockReturnValue({ user: null, loading: false });
    rerender(<MemoryRouter><TrainersPage /></MemoryRouter>);
    expect(screen.queryByRole("heading", { name: "Ash" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
  });
});
