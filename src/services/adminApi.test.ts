import { afterEach, describe, expect, it, vi } from "vitest";

import { listUsers, updateUser } from "./adminApi";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body, ok = true, status = 200) {
  return { ok, status, json: vi.fn().mockResolvedValue(body) };
}

describe("adminApi", () => {
  it("lists accounts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ users: [{ id: "u1" }] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(listUsers("token")).resolves.toEqual([{ id: "u1" }]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/users",
      expect.objectContaining({ headers: { Authorization: "Bearer token" } }),
    );
  });

  it("returns an empty list when users are missing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({})));

    await expect(listUsers("token")).resolves.toEqual([]);
  });

  it("updates an account with a PATCH body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ user: { id: "u1", role: "admin" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(updateUser("token", { userId: "u1", role: "admin" }))
      .resolves.toEqual({ id: "u1", role: "admin" });

    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe("PATCH");
    expect(JSON.parse(options.body)).toEqual({ userId: "u1", role: "admin" });
  });

  it("surfaces the server error message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse({ error: { message: "Admin access is required." } }, false, 403),
    ));

    await expect(listUsers("token")).rejects.toThrow("Admin access is required.");
  });
  it("handles a platform failure that returns plain text instead of JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: vi.fn().mockRejectedValue(new SyntaxError("Unexpected token")) }));
    await expect(listUsers("token")).rejects.toThrow("The admin service is temporarily unavailable.");
  });
});
