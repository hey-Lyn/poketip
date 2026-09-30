import { afterEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@supabase/supabase-js", () => supabaseMocks);

import { requireUser } from "./auth.js";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.clearAllMocks();
});

function clientWith(getUser) {
  return { auth: { getUser } };
}

describe("requireUser", () => {
  it("rejects requests without a bearer token", async () => {
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    supabaseMocks.createClient.mockReturnValue(clientWith(vi.fn()));

    await expect(requireUser({ headers: {} }))
      .rejects.toMatchObject({ code: "AUTH_REQUIRED", status: 401 });
    expect(supabaseMocks.createClient).not.toHaveBeenCalled();
  });

  it("returns the user for a valid token", async () => {
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    supabaseMocks.createClient.mockReturnValue(clientWith(
      vi.fn().mockResolvedValue({
        data: { user: { id: "u1", email: "trainer@example.com" } },
        error: null,
      }),
    ));

    const user = await requireUser({
      headers: { authorization: "Bearer aaa.bbb.ccc" },
    });

    expect(user.id).toBe("u1");
  });

  it("rejects an invalid or expired token", async () => {
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
    supabaseMocks.createClient.mockReturnValue(clientWith(
      vi.fn().mockResolvedValue({
        data: { user: null },
        error: { message: "JWT expired" },
      }),
    ));

    await expect(requireUser({
      headers: { authorization: "Bearer aaa.bbb.ccc" },
    })).rejects.toMatchObject({ code: "AUTH_INVALID", status: 401 });
  });

  it("fails closed when authentication is not configured", async () => {
    delete process.env.SUPABASE_URL;

    await expect(requireUser({
      headers: { authorization: "Bearer aaa.bbb.ccc" },
    })).rejects.toMatchObject({ code: "AUTH_NOT_CONFIGURED", status: 503 });
  });
});
