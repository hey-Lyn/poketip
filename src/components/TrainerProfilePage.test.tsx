import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { trainerFixture } from "../test/trainerFixtures";

const authMocks = vi.hoisted(() => ({ useAuth: vi.fn() }));
const trainerMocks = vi.hoisted(() => ({ getTrainerProfile: vi.fn() }));
vi.mock("../hooks/useAuth", () => authMocks);
vi.mock("../services/trainers", () => trainerMocks);
import TrainerProfilePage from "./TrainerProfilePage";

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/trainers/ash_25"]}>
      <Link to="/trainers/misty">Open Misty</Link>
      <Routes><Route path="/trainers/:username" element={<TrainerProfilePage />} /></Routes>
    </MemoryRouter>,
  );
}

describe("shared trainer profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.useAuth.mockReturnValue({ user: { id: "viewer" }, loading: false });
    trainerMocks.getTrainerProfile.mockResolvedValue(trainerFixture);
  });

  it("requires sign-in before fetching the profile", () => {
    authMocks.useAuth.mockReturnValue({ user: null, loading: false });
    renderPage();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument();
    expect(trainerMocks.getTrainerProfile).not.toHaveBeenCalled();
  });

  it("shows social fields without email, credits, role or editing controls", async () => {
    trainerMocks.getTrainerProfile.mockResolvedValue({ ...trainerFixture, email: "private@example.com", credits: 42, role: "admin" });
    renderPage();
    await screen.findByRole("heading", { name: "Ash" });
    expect(screen.getByText("@ash_25")).toBeInTheDocument();
    expect(screen.getByText("Kanto champion")).toBeInTheDocument();
    expect(screen.getByText("pikachu")).toBeInTheDocument();
    expect(screen.getByText(/member since march 2024/iu)).toBeInTheDocument();
    expect(screen.queryByText("private@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText("42")).not.toBeInTheDocument();
    expect(screen.queryByText("Admin")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit my profile" })).not.toBeInTheDocument();
  });

  it("falls back to the username when the display name is empty", async () => {
    trainerMocks.getTrainerProfile.mockResolvedValue({ ...trainerFixture, display_name: "" });
    renderPage();
    expect(await screen.findByRole("heading", { name: "ash_25" })).toBeInTheDocument();
  });

  it("links the owner to their private editor", async () => {
    authMocks.useAuth.mockReturnValue({ user: { id: "u1" }, loading: false });
    renderPage();
    expect(await screen.findByRole("link", { name: "Edit my profile" })).toHaveAttribute("href", "/profile");
  });

  it("handles a hidden or missing profile", async () => {
    trainerMocks.getTrainerProfile.mockResolvedValue(null);
    renderPage();
    expect(await screen.findByRole("heading", { name: "Trainer not found" })).toBeInTheDocument();
  });

  it("supports retrying a failed profile lookup", async () => {
    const user = userEvent.setup();
    trainerMocks.getTrainerProfile.mockRejectedValueOnce(new Error("Unable to load this trainer. Please try again."));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to load this trainer");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Ash" })).toBeInTheDocument();
  });

  it("ignores a late response when navigating to another trainer", async () => {
    const user = userEvent.setup();
    let resolveOld;
    trainerMocks.getTrainerProfile.mockImplementation((username) => username === "ash_25"
      ? new Promise((resolve) => { resolveOld = resolve; })
      : Promise.resolve({ ...trainerFixture, id: "u2", display_name: "Misty", username: "misty" }));
    renderPage();
    await user.click(screen.getByRole("link", { name: "Open Misty" }));
    expect(await screen.findByRole("heading", { name: "Misty" })).toBeInTheDocument();
    await act(async () => { resolveOld(trainerFixture); });
    expect(screen.queryByRole("heading", { name: "Ash" })).not.toBeInTheDocument();
  });
});
