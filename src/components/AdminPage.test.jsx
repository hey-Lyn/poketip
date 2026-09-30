import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authHookMocks = vi.hoisted(() => ({ useAuth: vi.fn() }));
const profileHookMocks = vi.hoisted(() => ({ useProfile: vi.fn() }));
const adminApiMocks = vi.hoisted(() => ({ listUsers: vi.fn(), updateUser: vi.fn() }));
const authServiceMocks = vi.hoisted(() => ({ getAccessToken: vi.fn() }));

vi.mock("../hooks/useAuth", () => authHookMocks);
vi.mock("../hooks/useProfile", () => profileHookMocks);
vi.mock("../services/adminApi", () => adminApiMocks);
vi.mock("../services/auth", () => authServiceMocks);

import AdminPage from "./AdminPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>,
  );
}

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authHookMocks.useAuth.mockReturnValue({ user: null, loading: false });
    profileHookMocks.useProfile.mockReturnValue({ profile: null, loading: false });
    authServiceMocks.getAccessToken.mockResolvedValue("token");
    adminApiMocks.listUsers.mockResolvedValue([]);
  });

  it("prompts signed-out visitors to sign in", () => {
    renderPage();

    expect(screen.getByText(/sign in with an admin account/iu)).toBeInTheDocument();
  });

  it("blocks signed-in non-admins", () => {
    authHookMocks.useAuth.mockReturnValue({
      user: { id: "u1", email: "ash@example.com" },
      loading: false,
    });
    profileHookMocks.useProfile.mockReturnValue({
      profile: { role: "user" },
      loading: false,
    });

    renderPage();

    expect(screen.getByText("Admins only")).toBeInTheDocument();
    expect(adminApiMocks.listUsers).not.toHaveBeenCalled();
  });

  it("lists accounts and saves role/credit changes for admins", async () => {
    const user = userEvent.setup();
    authHookMocks.useAuth.mockReturnValue({
      user: { id: "admin-1", email: "admin@example.com" },
      loading: false,
    });
    profileHookMocks.useProfile.mockReturnValue({
      profile: { role: "admin" },
      loading: false,
    });
    adminApiMocks.listUsers.mockResolvedValue([
      { id: "u1", email: "ash@example.com", display_name: "Ash", credits: 80, role: "user" },
    ]);
    adminApiMocks.updateUser.mockResolvedValue({ id: "u1", role: "admin", credits: 5 });

    renderPage();

    expect(await screen.findByText("ash@example.com")).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox"), "admin");
    const credits = screen.getByRole("spinbutton");
    await user.clear(credits);
    await user.type(credits, "5");
    await user.click(screen.getByRole("button", { name: /save/iu }));

    expect(adminApiMocks.updateUser).toHaveBeenCalledWith("token", {
      userId: "u1",
      role: "admin",
      credits: 5,
    });
    expect(await screen.findByText("Account updated.")).toBeInTheDocument();
  });
});
