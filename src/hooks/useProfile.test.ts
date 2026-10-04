import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProfile } from "./useProfile";

const profileMocks = vi.hoisted(() => ({
  getProfile: vi.fn(),
  saveProfile: vi.fn(),
  uploadAvatar: vi.fn(),
}));

vi.mock("../services/profile", () => ({
  getProfile: profileMocks.getProfile,
  saveProfile: profileMocks.saveProfile,
  uploadAvatar: profileMocks.uploadAvatar,
}));

describe("useProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads the profile once a user appears", async () => {
    let resolve;
    profileMocks.getProfile.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );

    const { result, rerender } = renderHook(({ user }) => useProfile(user), {
      initialProps: { user: null },
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.profile).toBeNull();

    rerender({ user: { id: "u1" } });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolve({
        id: "u1",
        favorite_pokemon_id: 133,
        favorite_pokemon_name: "eevee",
      });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile).toMatchObject({
      favorite_pokemon_id: 133,
      favorite_pokemon_name: "eevee",
    });
  });

  it("drops the profile when the user signs out", async () => {
    profileMocks.getProfile.mockResolvedValue({ id: "u1" });

    const { result, rerender } = renderHook(({ user }) => useProfile(user), {
      initialProps: { user: { id: "u1" } },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile).toMatchObject({ id: "u1" });

    rerender({ user: null });
    expect(result.current.profile).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("hides the previous account immediately and ignores its late load", async () => {
    let resolveOld;
    profileMocks.getProfile.mockImplementation((id) => id === "u1"
      ? new Promise((resolve) => { resolveOld = resolve; })
      : Promise.resolve({ id: "u2", username: "misty" }));
    const { result, rerender } = renderHook(({ user }) => useProfile(user), {
      initialProps: { user: { id: "u1" } },
    });
    rerender({ user: { id: "u2" } });
    expect(result.current.profile).toBeNull();
    await waitFor(() => expect(result.current.profile?.id).toBe("u2"));
    await act(async () => { resolveOld({ id: "u1", role: "admin" }); });
    expect(result.current.profile).toEqual({ id: "u2", username: "misty" });
  });

  it("doesn't restore the previous account after its save completes late", async () => {
    let resolveSave;
    profileMocks.getProfile.mockImplementation((id) => Promise.resolve({ id }));
    profileMocks.saveProfile.mockReturnValue(new Promise((resolve) => { resolveSave = resolve; }));
    const { result, rerender } = renderHook(({ user }) => useProfile(user), {
      initialProps: { user: { id: "u1" } },
    });
    await waitFor(() => expect(result.current.profile?.id).toBe("u1"));
    let saving;
    act(() => { saving = result.current.save({ username: "ash" }); });
    rerender({ user: { id: "u2" } });
    expect(result.current.profile).toBeNull();
    await waitFor(() => expect(result.current.profile?.id).toBe("u2"));
    await act(async () => { resolveSave({ id: "u1", username: "ash" }); await saving; });
    expect(result.current.profile?.id).toBe("u2");
  });
});
