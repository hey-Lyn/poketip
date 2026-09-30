import { render, screen } from "@testing-library/react";
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

  it("shows the derived handle and member since", () => {
    authHookMocks.useAuth.mockReturnValue({
      user: { id: "u1", email: "ash.ketchum@example.com" },
      loading: false,
    });

    renderPage();

    expect(screen.getByText("@ash.ketchum")).toBeInTheDocument();
    expect(screen.getByText(/member since march 2024/iu)).toBeInTheDocument();
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
