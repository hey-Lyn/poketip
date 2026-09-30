import { beforeEach, describe, expect, it, vi } from "vitest";

const adminMocks = vi.hoisted(() => ({ requireAdmin: vi.fn() }));

vi.mock("../_lib/admin.js", () => adminMocks);

import handler from "./users.js";

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    payload: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

function profilesTable({ rows, updateResult }) {
  const single = vi.fn().mockResolvedValue(updateResult);
  const select = vi.fn(() => {
    const promise = Promise.resolve({ data: rows, error: null });
    promise.single = single;
    return promise;
  });
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));
  return { select, update };
}

function fakeSupabase({ authUsers = [], rows = [], updateResult = {} }) {
  const table = profilesTable({ rows, updateResult });
  return {
    auth: {
      admin: {
        listUsers: vi.fn().mockResolvedValue({ data: { users: authUsers }, error: null }),
      },
    },
    from: vi.fn(() => table),
    table,
  };
}

describe("GET/PATCH /api/admin/users", () => {
  beforeEach(() => {
    adminMocks.requireAdmin.mockReset();
  });

  it("only accepts GET and PATCH", async () => {
    const response = createResponse();
    await handler({ method: "DELETE" }, response);

    expect(response.statusCode).toBe(405);
    expect(response.headers.Allow).toBe("GET, PATCH");
    expect(adminMocks.requireAdmin).not.toHaveBeenCalled();
  });

  it("lists accounts merged with profiles", async () => {
    adminMocks.requireAdmin.mockResolvedValue({
      user: { id: "admin-1" },
      supabase: fakeSupabase({
        authUsers: [
          { id: "u1", email: "ash@example.com", created_at: "2024-01-01" },
          { id: "u2", email: "misty@example.com", created_at: "2024-02-01" },
        ],
        rows: [{ id: "u1", display_name: "Ash", credits: 80, role: "admin" }],
      }),
    });
    const response = createResponse();

    await handler({ method: "GET" }, response);

    expect(response.statusCode).toBe(200);
    expect(response.payload.users).toEqual([
      { id: "u1", email: "ash@example.com", created_at: "2024-01-01", display_name: "Ash", credits: 80, role: "admin" },
      { id: "u2", email: "misty@example.com", created_at: "2024-02-01", display_name: "", credits: 0, role: "user" },
    ]);
  });

  it("updates role and credits", async () => {
    adminMocks.requireAdmin.mockResolvedValue({
      user: { id: "admin-1" },
      supabase: fakeSupabase({
        updateResult: { data: { id: "u2", role: "admin", credits: 10 }, error: null },
      }),
    });
    const response = createResponse();

    await handler(
      { method: "PATCH", body: { userId: "u2", role: "admin", credits: 10 } },
      response,
    );

    expect(response.statusCode).toBe(200);
    expect(response.payload.user).toMatchObject({ id: "u2", role: "admin", credits: 10 });
  });

  it("rejects an unsupported role", async () => {
    adminMocks.requireAdmin.mockResolvedValue({
      user: { id: "admin-1" },
      supabase: fakeSupabase({}),
    });
    const response = createResponse();

    await handler(
      { method: "PATCH", body: { userId: "u2", role: "owner" } },
      response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.payload.error.code).toBe("INVALID_ROLE");
  });

  it("prevents an admin from removing their own role", async () => {
    adminMocks.requireAdmin.mockResolvedValue({
      user: { id: "admin-1" },
      supabase: fakeSupabase({}),
    });
    const response = createResponse();

    await handler(
      { method: "PATCH", body: { userId: "admin-1", role: "user" } },
      response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.payload.error.code).toBe("SELF_DEMOTE_FORBIDDEN");
  });

  it("propagates the admin guard error", async () => {
    adminMocks.requireAdmin.mockRejectedValue(
      Object.assign(new Error("Admin access is required."), {
        code: "ADMIN_REQUIRED",
        status: 403,
      }),
    );
    const response = createResponse();

    await handler({ method: "GET" }, response);

    expect(response.statusCode).toBe(403);
    expect(response.payload.error.code).toBe("ADMIN_REQUIRED");
  });
});
