import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ getSupabase: vi.fn() }));

vi.mock("./auth", () => authMocks);

import {
  MAX_AVATAR_BYTES,
  getProfile,
  saveProfile,
  uploadAvatar,
} from "./profile";

afterEach(() => {
  vi.clearAllMocks();
});

function queryBuilder(result) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    upsert: vi.fn(() => builder),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
  };
  return builder;
}

function clientWith(builder: any, storageResult?: any) {
  return {
    from: vi.fn(() => builder),
    storage: {
      from: vi.fn(() => storageResult),
    },
  };
}

function storageWith(upload, getPublicUrl) {
  return {
    upload: vi.fn().mockResolvedValue(upload),
    getPublicUrl: vi.fn(() => getPublicUrl),
  };
}

describe("profile service", () => {
  it("returns null for a missing user id", async () => {
    await expect(getProfile(null)).resolves.toBeNull();
    expect(authMocks.getSupabase).not.toHaveBeenCalled();
  });

  it("loads the current user profile", async () => {
    const profile = { display_name: "Ash", credits: 100 };
    authMocks.getSupabase.mockReturnValue(clientWith(
      queryBuilder({ data: profile, error: null }),
    ));

    await expect(getProfile("u1")).resolves.toEqual(profile);
  });

  it("throws when loading fails", async () => {
    authMocks.getSupabase.mockReturnValue(clientWith(
      queryBuilder({ data: null, error: { message: "boom" } }),
    ));

    await expect(getProfile("u1")).rejects.toThrow("Unable to load your profile.");
  });

  it("saves profile updates", async () => {
    const saved = { display_name: "Misty", credits: 90 };
    const builder = queryBuilder({ data: saved, error: null });
    authMocks.getSupabase.mockReturnValue(clientWith(builder));

    await expect(saveProfile("u1", { display_name: "Misty" })).resolves.toEqual(saved);
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ id: "u1", display_name: "Misty" }),
    );
  });

  it("strips protected fields from profile updates", async () => {
    const builder = queryBuilder({ data: { display_name: "Misty" }, error: null });
    authMocks.getSupabase.mockReturnValue(clientWith(builder));

    await saveProfile("u1", {
      display_name: "Misty",
      credits: 999999,
      role: "admin",
      id: "someone-else",
    });

    const payload = (builder.upsert as any).mock.calls[0][0];
    expect(payload.id).toBe("u1");
    expect(payload.display_name).toBe("Misty");
    expect(payload).not.toHaveProperty("credits");
    expect(payload).not.toHaveProperty("role");
  });

  it("rejects non-image avatars before uploading", async () => {
    const file = { type: "text/plain", size: 10, name: "note.txt" };
    await expect(uploadAvatar("u1", file)).rejects.toThrow(/image/u);
    expect(authMocks.getSupabase).not.toHaveBeenCalled();
  });

  it("rejects oversized avatars", async () => {
    const file = { type: "image/png", size: MAX_AVATAR_BYTES + 1, name: "big.png" };
    await expect(uploadAvatar("u1", file)).rejects.toThrow(/2 MB/u);
  });

  it("uploads the avatar and returns a cache-busted public URL", async () => {
    const storage = storageWith(
      { error: null },
      { data: { publicUrl: "https://cdn.example/avatars/u1/avatar" } },
    );
    authMocks.getSupabase.mockReturnValue(clientWith(null, storage));
    const file = { type: "image/png", size: 1024, name: "me.png" };

    const url = await uploadAvatar("u1", file);

    expect(storage.upload).toHaveBeenCalledWith(
      "u1/avatar",
      file,
      expect.objectContaining({ upsert: true, contentType: "image/png" }),
    );
    expect(url).toMatch(/^https:\/\/cdn\.example\/avatars\/u1\/avatar\?v=\d+$/u);
  });
});
