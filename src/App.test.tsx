import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authHookMocks = vi.hoisted(() => ({ useAuth: vi.fn() }));
const profileHookMocks = vi.hoisted(() => ({ useProfile: vi.fn() }));

vi.mock("./hooks/useAuth", () => authHookMocks);
vi.mock("./hooks/useProfile", () => profileHookMocks);
vi.mock("./hooks/useBackgroundMotion", () => ({ useBackgroundMotion: vi.fn() }));
vi.mock("./components/PokedexPage", () => ({ default: () => <div>Pokedex view</div> }));
vi.mock("./components/PokemonDetailsPage", () => ({ default: () => <div>Details view</div> }));
vi.mock("./components/TeamBuilderPage", () => ({ default: () => <div>Team builder view</div> }));
vi.mock("./components/ProfilePage", () => ({ default: () => <div>Profile view</div> }));
vi.mock("./components/TrainersPage", () => ({ default: () => <div>Trainers view</div> }));
vi.mock("./components/TrainerProfilePage", () => ({ default: () => <div>Trainer profile view</div> }));
vi.mock("./components/MessagesPage", () => ({ default: () => <div>Messages view</div> }));
vi.mock("./components/AdminPage", () => ({ default: () => <div>Admin view</div> }));
vi.mock("./components/SettingsPage", () => ({ default: () => <div>Settings view</div> }));
vi.mock("./components/NotFoundPage", () => ({ default: () => <div>Not found view</div> }));

import App from "./App";

function renderApp() {
  return render(
    <MemoryRouter>
      <App />
    </MemoryRouter>,
  );
}

function getSidebar() {
  return document.getElementById("primary-sidebar") as HTMLElement;
}

describe("App navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authHookMocks.useAuth.mockReturnValue({ user: null, loading: false });
    profileHookMocks.useProfile.mockReturnValue({ profile: null, loading: false });
  });

  it("exposes the primary navigation as accessible links", () => {
    renderApp();

    const nav = screen.getByRole("navigation", { name: "Primary" });
    expect(nav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Pokédex" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Open Team Builder" })).toHaveAttribute("href", "/team-builder");
    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
    expect(screen.getByRole("link", { name: "Trainers" })).toHaveAttribute("href", "/trainers");
    expect(screen.getByRole("link", { name: "Messages" })).toHaveAttribute("href", "/messages");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("opens the trainer directory from the sidebar", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("link", { name: "Trainers" }));
    expect(screen.getByText("Trainers view")).toBeInTheDocument();
  });

  it("shows the admin link only for admins", () => {
    profileHookMocks.useProfile.mockReturnValue({
      profile: { role: "admin" },
      loading: false,
    });

    renderApp();

    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
  });

  it("toggles the drawer and reports state through aria-expanded", async () => {
    const user = userEvent.setup();
    renderApp();

    const toggle = screen.getByRole("button", { name: "Expand navigation" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(getSidebar()).not.toHaveClass("open");

    await user.click(toggle);

    expect(screen.getByRole("button", { name: "Collapse navigation" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(getSidebar()).toHaveClass("open");
  });

  it("closes the drawer with Escape", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Expand navigation" }));
    expect(getSidebar()).toHaveClass("open");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(getSidebar()).not.toHaveClass("open"));
  });

  it("closes the drawer when the scrim is clicked", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Expand navigation" }));

    await user.click(screen.getByRole("button", { name: "Close navigation" }));

    expect(getSidebar()).not.toHaveClass("open");
  });

  it("closes the drawer when a navigation link is used", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Expand navigation" }));
    await user.click(screen.getByRole("link", { name: "Settings" }));

    expect(getSidebar()).not.toHaveClass("open");
    expect(screen.getByText("Settings view")).toBeInTheDocument();
  });
});
