import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authServiceMocks = vi.hoisted(() => ({
  signOut: vi.fn(),
  updatePassword: vi.fn(),
}));

vi.mock("../services/auth", () => authServiceMocks);

import SettingsPage from "./SettingsPage";

const team = [
  { id: 25, name: "pikachu" },
  null,
  null,
  null,
  null,
  null,
];

function renderPage(overrides = {}) {
  const props = {
    settings: { theme: "sylveon", shiny: false, reduceMotion: false },
    team,
    user: { id: "u1", email: "ash@example.com" },
    onUpdate: vi.fn(),
    onClearTeam: vi.fn(),
    ...overrides,
  };

  render(
    <MemoryRouter>
      <SettingsPage {...props} />
    </MemoryRouter>,
  );

  return props;
}

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    authServiceMocks.updatePassword.mockResolvedValue(undefined);
    authServiceMocks.signOut.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders every settings section", () => {
    renderPage();

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Appearance" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /team & data/iu })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Account" })).toBeInTheDocument();
    expect(screen.getByText("1 Pokémon saved in your team.")).toBeInTheDocument();
  });

  it("updates a preference when a toggle changes", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderPage();

    await user.click(screen.getByRole("checkbox", { name: /reduce motion/iu }));

    expect(onUpdate).toHaveBeenCalledWith({ reduceMotion: true });
  });

  it("switches the appearance theme", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderPage();

    await user.click(screen.getByRole("button", { name: "Umbreon" }));

    expect(onUpdate).toHaveBeenCalledWith({ theme: "umbreon" });
  });

  it("toggles the shiny variant", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderPage();

    await user.click(screen.getByRole("checkbox", { name: /shiny/iu }));

    expect(onUpdate).toHaveBeenCalledWith({ shiny: true });
  });

  it("clears the saved team after confirmation", async () => {
    const user = userEvent.setup();
    const { onClearTeam } = renderPage();

    await user.click(screen.getByRole("button", { name: /clear saved team/iu }));

    expect(onClearTeam).toHaveBeenCalled();
    expect(await screen.findByText("Saved team cleared.")).toBeInTheDocument();
  });

  it("exports data to a downloaded file", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /export my data/iu }));

    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(await screen.findByText("Data exported.")).toBeInTheDocument();
  });

  it("changes the password for signed-in accounts", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(
      screen.getByPlaceholderText("At least 6 characters"),
      "newsecret",
    );
    await user.click(screen.getByRole("button", { name: /change password/iu }));

    expect(authServiceMocks.updatePassword).toHaveBeenCalledWith("newsecret");
    expect(await screen.findByText("Password updated.")).toBeInTheDocument();
  });

  it("signs out from the account section", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: /sign out/iu }));

    expect(authServiceMocks.signOut).toHaveBeenCalled();
  });

  it("invites signed-out visitors to the profile page", () => {
    renderPage({ user: null });

    expect(screen.getByRole("link", { name: /go to profile/iu })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(screen.queryByRole("button", { name: /change password/iu })).toBeNull();
  });
});
