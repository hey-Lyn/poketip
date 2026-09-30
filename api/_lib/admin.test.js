import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ requireUser: vi.fn() }));
const supabaseMocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("./auth.js", () => authMocks);
vi.mock("@supabase/supabase-js", () => supabaseMocks);

import { requireAdmin } from "./admin.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.clearAllMocks();
});

function setSupabaseEnv() {
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
}

function profileClient(result) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  return { from: vi.fn(() => builder) };
}

describe("requireAdmin", () => {
  it("returns the user and client for an admin", async () => {
    setSupabaseEnv();
    authMocks.requireUser.mockResolvedValue({ id: "admin-1" });
    supabaseMocks.createClient.mockReturnValue(
      profileClient({ data: { role: "admin" }, error: null }),
    );

    const { user } = await requireAdmin({ headers: {} });

    expect(user.id).toBe("admin-1");
  });

  it("rejects a signed-in non-admin", async () => {
    setSupabaseEnv();
    authMocks.requireUser.mockResolvedValue({ id: "user-1" });
    supabaseMocks.createClient.mockReturnValue(
      profileClient({ data: { role: "user" }, error: null }),
    );

    await expect(requireAdmin({ headers: {} }))
      .rejects.toMatchObject({ code: "ADMIN_REQUIRED", status: 403 });
  });

  it("rejects when no profile exists", async () => {
    setSupabaseEnv();
    authMocks.requireUser.mockResolvedValue({ id: "user-1" });
    supabaseMocks.createClient.mockReturnValue(
      profileClient({ data: null, error: null }),
    );

    await expect(requireAdmin({ headers: {} }))
      .rejects.toMatchObject({ code: "ADMIN_REQUIRED", status: 403 });
  });

  it("fails closed when the role lookup errors", async () => {
    setSupabaseEnv();
    authMocks.requireUser.mockResolvedValue({ id: "user-1" });
    supabaseMocks.createClient.mockReturnValue(
      profileClient({ data: null, error: { message: "boom" } }),
    );

    await expect(requireAdmin({ headers: {} }))
      .rejects.toMatchObject({ code: "ADMIN_CHECK_FAILED", status: 503 });
  });

  it("fails closed when admin tools are not configured", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    authMocks.requireUser.mockResolvedValue({ id: "user-1" });

    await expect(requireAdmin({ headers: {} }))
      .rejects.toMatchObject({ code: "ADMIN_NOT_CONFIGURED", status: 503 });
  });
});
