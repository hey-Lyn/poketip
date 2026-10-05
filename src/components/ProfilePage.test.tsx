import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authHookMocks = vi.hoisted(() => ({ useAuth: vi.fn() }));
const profileHookMocks = vi.hoisted(() => ({ useProfile: vi.fn() }));
const pokeMocks = vi.hoisted(() => ({ searchPokemon: vi.fn() }));

vi.mock("../hooks/useAuth", () => authHookMocks);
vi.mock("../hooks/useProfile", () => profileHookMocks);
vi.mock("../services/pokeApi", () => pokeMocks);
vi.mock("../services/auth", () => ({
  getSupabase: () => ({}),
  signIn: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
}));

import ProfilePage from "./ProfilePage";

function renderPage() {
  return render(
    <MemoryRouter>
      <ProfilePage />
    </MemoryRouter>,
  );
}

const baseProfile = {
  username: null,
  social_enabled: false,
  display_name: "Ash",
  bio: "Kanto champion",
  favorite_pokemon_id: 25,
  favorite_pokemon_name: "pikachu",
  avatar_url: null,
  credits: 42,
  created_at: "2024-03-15T00:00:00.000Z",
};

function mockProfileHook(overrides = {}) {
  profileHookMocks.useProfile.mockReturnValue({
    profile: baseProfile,
    loading: false,
    error: "",
    refresh: vi.fn(),
    save: vi.fn().mockResolvedValue(baseProfile),
    changeAvatar: vi.fn(),
    ...overrides,
  });
}

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem("poketip-team-v1");
    authHookMocks.useAuth.mockReturnValue({ user: null, loading: false });
    mockProfileHook();
  });

  it("shows the auth form when signed out", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("shows a loading state while the session resolves", () => {
    authHookMocks.useAuth.mockReturnValue({ user: null, loading: true });

    renderPage();

    expect(screen.getByText("Loading account...")).toBeInTheDocument();
  });

  it("shows the saved username instead of deriving it from email", () => {
    authHookMocks.useAuth.mockReturnValue({
      user: { id: "u1", email: "ash.ketchum@example.com" },
      loading: false,
    });
    mockProfileHook({ profile: { ...baseProfile, username: "ash_trainer" } });

    renderPage();

    expect(screen.getByText("@ash_trainer")).toBeInTheDocument();
    expect(screen.queryByText("@ash.ketchum")).not.toBeInTheDocument();
    expect(screen.getByText(/member since march 2024/iu)).toBeInTheDocument();
  });

  it("starts private and lets the owner choose a username and opt in", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(baseProfile);
    authHookMocks.useAuth.mockReturnValue({ user: { id: "u1", email: "ash@example.com" }, loading: false });
    mockProfileHook({ save });
    renderPage();

    const toggle = screen.getByRole("checkbox", { name: "Show my profile to other trainers" });
    expect(toggle).not.toBeChecked();
    expect(screen.queryByRole("link", { name: "View my trainer profile" })).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Username" }), "ASH_25");
    await user.click(toggle);
    await user.click(screen.getByRole("button", { name: /save profile/iu }));

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ username: "ash_25", social_enabled: true }));
  });

  it("keeps editing available and explains the missing setup when social columns are unavailable", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(baseProfile);
    authHookMocks.useAuth.mockReturnValue({ user: { id: "u1", email: "ash@example.com" }, loading: false });
    mockProfileHook({ profile: { ...baseProfile, social_ready: false }, save });
    renderPage();

    expect(screen.getByText(/waiting for their database setup/iu)).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Username" })).not.toBeInTheDocument();
    const bio = screen.getByPlaceholderText(/playstyle/iu);
    await user.clear(bio);
    await user.type(bio, "Still private");
    await user.click(screen.getByRole("button", { name: /save profile/iu }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ bio: "Still private" }));
    expect(save).not.toHaveBeenCalledWith(expect.objectContaining({ username: expect.anything() }));
  });

  it("lets the owner disable sharing and retains their username", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(baseProfile);
    authHookMocks.useAuth.mockReturnValue({ user: { id: "u1", email: "ash@example.com" }, loading: false });
    mockProfileHook({ profile: { ...baseProfile, username: "ash_25", social_enabled: true }, save });
    renderPage();

    expect(screen.getByRole("link", { name: "View my trainer profile" })).toHaveAttribute("href", "/trainers/ash_25");
    await user.click(screen.getByRole("checkbox", { name: "Show my profile to other trainers" }));
    await user.click(screen.getByRole("button", { name: /save profile/iu }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ username: "ash_25", social_enabled: false }));
  });

  it("shows username conflicts without claiming the save succeeded", async () => {
    const user = userEvent.setup();
    authHookMocks.useAuth.mockReturnValue({ user: { id: "u1", email: "ash@example.com" }, loading: false });
    mockProfileHook({ save: vi.fn().mockRejectedValue(new Error("This username is already taken. Choose another one.")) });
    renderPage();

    await user.type(screen.getByRole("textbox", { name: "Username" }), "ash_25");
    await user.click(screen.getByRole("button", { name: /save profile/iu }));
    expect(await screen.findByText(/username is already taken/iu)).toBeInTheDocument();
    expect(screen.queryByText("Profile saved.")).not.toBeInTheDocument();
  });

  it("previews customization and saves a featured team without changing Team Builder", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(baseProfile);
    authHookMocks.useAuth.mockReturnValue({ user: { id: "u1", email: "ash@example.com" }, loading: false });
    mockProfileHook({ profile: { ...baseProfile, customization_ready: true }, save });
    const team = [{ id: 25, name: "pikachu", sprite: "p.png", types: ["electric"] }];
    localStorage.setItem("poketip-team-v1", JSON.stringify(team));
    renderPage();
    await user.click(screen.getByRole("textbox", { name: "Trainer title" }));
    await user.paste("Water-type specialist");
    await user.click(screen.getByRole("combobox", { name: "Favorite game" }));
    await user.paste("Pokémon Emerald");
    fireEvent.change(screen.getByLabelText("Card frame"), { target: { value: "#76dbf1" } });
    fireEvent.change(screen.getByLabelText("Background color 1"), { target: { value: "#112233" } });
    fireEvent.change(screen.getByLabelText("Background color 2"), { target: { value: "#445566" } });
    await user.click(screen.getByRole("button", { name: "Copy from Team Builder" }));
    const preview = within(screen.getByRole("region", { name: "Trainer card preview" }));
    expect(preview.getByText("Water-type specialist")).toBeInTheDocument();
    expect(preview.getByText("Pokémon Emerald")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save profile/iu }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ trainer_title: "Water-type specialist", card_frame_color: "#76dbf1", card_background_start: "#112233", card_background_end: "#445566", favorite_game: "Pokémon Emerald", featured_team: [{ id: 25, name: "pikachu" }] }));
    expect(preview.getByRole("article")).toHaveStyle({ "--trainer-frame": "#76dbf1", "--trainer-background-start": "#112233", "--trainer-background-end": "#445566" });
    expect(JSON.parse(localStorage.getItem("poketip-team-v1") ?? "null")).toEqual(team);
    localStorage.removeItem("poketip-team-v1");
  });

  it("shows an Admin badge for admin accounts", () => {
    authHookMocks.useAuth.mockReturnValue({
      user: { id: "u1", email: "arroz@example.com" },
      loading: false,
    });
    mockProfileHook({ profile: { ...baseProfile, role: "admin" } });

    renderPage();

    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("edits the display name inline when clicked", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(baseProfile);
    authHookMocks.useAuth.mockReturnValue({
      user: { id: "u1", email: "ash@example.com" },
      loading: false,
    });
    mockProfileHook({ save });

    renderPage();

    await user.click(screen.getByRole("button", { name: "Ash" }));
    const input = screen.getByDisplayValue("Ash");
    await user.clear(input);
    await user.type(input, "Misty{Enter}");

    expect(save).toHaveBeenCalledWith({ display_name: "Misty" });
  });

  it("renders the profile and saves bio/favorite edits", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(baseProfile);
    authHookMocks.useAuth.mockReturnValue({
      user: { id: "u1", email: "ash@example.com" },
      loading: false,
    });
    mockProfileHook({ save });

    renderPage();

    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("pikachu")).toBeInTheDocument();

    const bio = screen.getByPlaceholderText(/playstyle/iu);
    await user.clear(bio);
    await user.type(bio, "Fire trainer");
    await user.click(screen.getByRole("button", { name: /save profile/iu }));

    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      bio: "Fire trainer",
      favorite_pokemon_id: 25,
      favorite_pokemon_name: "pikachu",
    }));
    expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
  });

  it("selects a favorite Pokémon from the search results", async () => {
    const user = userEvent.setup();
    const save = vi.fn().mockResolvedValue(baseProfile);
    authHookMocks.useAuth.mockReturnValue({
      user: { id: "u1", email: "ash@example.com" },
      loading: false,
    });
    mockProfileHook({ save });
    pokeMocks.searchPokemon.mockResolvedValue({
      pokemon: [{ id: 4, name: "charmander", sprite: "charmander.png" }],
      count: 1,
    });

    renderPage();

    await user.click(
      screen.getByRole("button", { name: /currently pikachu/iu }),
    );
    await user.type(
      screen.getByPlaceholderText("Search by name or number"),
      "char",
    );
    await user.click(await screen.findByRole("button", { name: /charmander/iu }));

    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      favorite_pokemon_id: 4,
      favorite_pokemon_name: "charmander",
    }));
    expect(screen.getByText("charmander")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save profile/iu }));

    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      favorite_pokemon_id: 4,
      favorite_pokemon_name: "charmander",
    }));
  });
});
