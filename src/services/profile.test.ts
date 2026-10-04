import { afterEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ getSupabase: vi.fn() }));

vi.mock("./auth", () => authMocks);

import {
  MAX_AVATAR_BYTES,
  getProfile,
  saveProfile,
  uploadAvatar,
  uploadCover,
} from "./profile";

afterEach(() => {
  vi.clearAllMocks();
});

function queryBuilder(result) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    update: vi.fn(() => builder),
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

    await expect(getProfile("u1")).resolves.toEqual({ ...profile, social_ready: true, customization_ready: true, card_colors_ready: true });
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
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ display_name: "Misty" }));
    expect(builder.eq).toHaveBeenCalledWith("id", "u1");
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

    const payload = (builder.update as any).mock.calls[0][0];
    expect(builder.eq).toHaveBeenCalledWith("id", "u1");
    expect(payload).not.toHaveProperty("id");
    expect(payload.display_name).toBe("Misty");
    expect(payload).not.toHaveProperty("credits");
    expect(payload).not.toHaveProperty("role");
  });

  it("keeps the private profile usable when the social migration is absent", async () => {
    const builder = queryBuilder({ data: { display_name: "Ash" }, error: null });
    builder.maybeSingle
      .mockResolvedValueOnce({ data: null, error: { code: "42703" } })
      .mockResolvedValueOnce({ data: null, error: { code: "42703" } })
      .mockResolvedValueOnce({ data: null, error: { code: "42703" } })
      .mockResolvedValueOnce({ data: { display_name: "Ash" }, error: null });
    authMocks.getSupabase.mockReturnValue(clientWith(builder));

    await expect(getProfile("u1")).resolves.toEqual({ display_name: "Ash", social_ready: false, customization_ready: false });
    expect(builder.select).toHaveBeenCalledTimes(4);
  });

  it("normalizes usernames and permits the social opt-in fields", async () => {
    const builder = queryBuilder({ data: { username: "ash_25", social_enabled: true }, error: null });
    authMocks.getSupabase.mockReturnValue(clientWith(builder));
    await saveProfile("u1", { username: " ASH_25 ", social_enabled: true });
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ username: "ash_25", social_enabled: true }));
  });

  it("loads an existing social profile before customization is configured", async () => {
    const builder = queryBuilder({ data: { username: "ash" }, error: null });
    builder.maybeSingle.mockResolvedValueOnce({ data: null, error: { code: "42703" } }).mockResolvedValueOnce({ data: null, error: { code: "42703" } });
    authMocks.getSupabase.mockReturnValue(clientWith(builder));
    await expect(getProfile("u1")).resolves.toMatchObject({ social_ready: true, customization_ready: false });
  });

  it("saves old profile fields without selecting missing customization columns", async () => {
    const builder = queryBuilder({ data: { bio: "Updated" }, error: null });
    authMocks.getSupabase.mockReturnValue(clientWith(builder));
    await saveProfile("u1", { bio: "Updated", social_ready: false, customization_ready: false });
    expect((builder.select as any).mock.calls[0][0]).not.toContain("username");
    expect((builder.select as any).mock.calls[0][0]).not.toContain("trainer_title");
    expect((builder.update as any).mock.calls[0][0]).not.toHaveProperty("social_ready");
  });
  it("keeps existing customization usable before the card color migration", async () => {
    const builder = queryBuilder({ data: { trainer_title: "Champion" }, error: null });
    builder.maybeSingle.mockResolvedValueOnce({ data: null, error: { code: "42703" } });
    authMocks.getSupabase.mockReturnValue(clientWith(builder));
    await expect(getProfile("u1")).resolves.toMatchObject({ customization_ready: true, card_colors_ready: false });
    await saveProfile("u1", { trainer_title: "Champion", card_frame_color: "#123456", card_colors_ready: false });
    expect((builder.update as any).mock.calls[0][0]).not.toHaveProperty("card_frame_color");
    expect((builder.select as any).mock.calls.at(-1)[0]).not.toContain("card_frame_color");
  });
  it("validates and saves all three RGB colors", async () => {
    const builder = queryBuilder({ data: {}, error: null });
    authMocks.getSupabase.mockReturnValue(clientWith(builder));
    await expect(saveProfile("u1", { card_frame_color: "red" })).rejects.toThrow(/RGB/u);
    await expect(saveProfile("u1", { card_background_start: "url(image)" })).rejects.toThrow(/RGB/u);
    await expect(saveProfile("u1", { card_background_end: "#12345" })).rejects.toThrow(/RGB/u);
    expect(builder.update).not.toHaveBeenCalled();
    const colors = { card_frame_color: "#AaBbCc", card_background_start: "#112233", card_background_end: "#445566" };
    await saveProfile("u1", colors);
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining(colors));
  });

  it("validates customization and only stores public Pokémon identity fields", async () => {
    const builder = queryBuilder({ data: {}, error: null });
    authMocks.getSupabase.mockReturnValue(clientWith(builder));
    await expect(saveProfile("u1", { trainer_title: "x".repeat(61) })).rejects.toThrow(/60/u);
    await expect(saveProfile("u1", { card_palette: "invalid" })).rejects.toThrow(/color/u);
    await expect(saveProfile("u1", { featured_team: Array.from({ length: 7 }, () => ({ id: 25, name: "pikachu" })) })).rejects.toThrow(/six/u);
    await expect(saveProfile("u1", { cover_url: "javascript:alert(1)" })).rejects.toThrow(/cover/u);
    expect(builder.update).not.toHaveBeenCalled();
    await saveProfile("u1", { trainer_title: "Champion", card_palette: "water", cover_style: "forest", favorite_game: "Pokémon Emerald", featured_team: [{ id: 25, name: "pikachu", moves: ["private battle strategy"] }] });
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ trainer_title: "Champion", favorite_game: "Pokémon Emerald", featured_team: [{ id: 25, name: "pikachu" }] }));
  });

  it("validates covers and uploads within the owner's storage folder", async () => {
    await expect(uploadCover("u1", { type: "image/svg+xml", size: 100 })).rejects.toThrow(/PNG/u);
    await expect(uploadCover("u1", { type: "image/png", size: MAX_AVATAR_BYTES + 1 })).rejects.toThrow(/2 MB/u);
    const storage = storageWith({ error: null }, { data: { publicUrl: "https://cdn.example/cover" } });
    authMocks.getSupabase.mockReturnValue(clientWith(null, storage));
    const file = { type: "image/png", size: 100 };
    await expect(uploadCover("u1", file)).resolves.toBe("https://cdn.example/cover");
    expect(storage.upload).toHaveBeenCalledWith(expect.stringMatching(/^u1\/cover-/u), file, expect.objectContaining({ contentType: "image/png" }));
  });

  it("rejects invalid usernames and opt-in without a username before writing", async () => {
    const builder = queryBuilder({ data: null, error: null });
    authMocks.getSupabase.mockReturnValue(clientWith(builder));
    await expect(saveProfile("u1", { username: "a" })).rejects.toThrow(/3–24/u);
    await expect(saveProfile("u1", { username: "ash.ketchum" })).rejects.toThrow(/3–24/u);
    await expect(saveProfile("u1", { username: "", social_enabled: true })).rejects.toThrow(/before enabling/u);
    expect(builder.update).not.toHaveBeenCalled();
  });

  it("lets a private profile have no username", async () => {
    const builder = queryBuilder({ data: {}, error: null });
    authMocks.getSupabase.mockReturnValue(clientWith(builder));
    await saveProfile("u1", { username: " ", social_enabled: false });
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ username: null, social_enabled: false }));
  });

  it("explains a username conflict returned by the database", async () => {
    authMocks.getSupabase.mockReturnValue(clientWith(queryBuilder({ data: null, error: { code: "23505" } })));
    await expect(saveProfile("u1", { username: "ash_25" })).rejects.toThrow(/already taken/u);
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
