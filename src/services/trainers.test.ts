import { beforeEach, describe, expect, it, vi } from "vitest";
const authMocks = vi.hoisted(() => ({ getSupabase: vi.fn() }));
vi.mock("./auth", () => authMocks);
import { getTrainerProfile, isValidUsername, normalizeUsername, searchTrainers } from "./trainers";

describe("trainer service", () => {
  const rpc = vi.fn();
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.getSupabase.mockReturnValue({ rpc });
  });

  it("uses a normalized standalone username", () => {
    expect(normalizeUsername(" ASH_25 ")).toBe("ash_25");
    expect(isValidUsername("ash_25")).toBe(true);
    for (const value of ["a", "_ash", "ash@email.com", "ash.ketchum", "ASH", "a".repeat(25)]) {
      expect(isValidUsername(value)).toBe(false);
    }
  });

  it("loads a trainer through the restricted RPC", async () => {
    rpc.mockResolvedValue({ data: [{ id: "u1", username: "ash_25" }], error: null });
    await expect(getTrainerProfile(" ASH_25 ")).resolves.toMatchObject({ username: "ash_25" });
    expect(rpc).toHaveBeenCalledWith("get_trainer_profile", { p_username: "ash_25" });
  });

  it("returns missing for an invalid or hidden username", async () => {
    await expect(getTrainerProfile("ash@email.com")).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(getTrainerProfile("ash")).resolves.toBeNull();
  });

  it("fetches one extra result to detect the next page", async () => {
    const trainers = Array.from({ length: 21 }, (_, id) => ({ id: String(id), username: `trainer${id}` }));
    rpc.mockResolvedValue({ data: trainers, error: null });
    const result = await searchTrainers(" @ASH ", 2);
    expect(rpc).toHaveBeenCalledWith("search_trainers", { p_query: "ash", p_offset: 40, p_limit: 21 });
    expect(result.trainers).toHaveLength(20);
    expect(result.hasNextPage).toBe(true);
  });

  it("handles the last page and an empty directory", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(searchTrainers()).resolves.toEqual({ trainers: [], hasNextPage: false });
  });

  it("rejects invalid search inputs before querying", async () => {
    await expect(searchTrainers("a".repeat(101))).rejects.toThrow(/100/u);
    await expect(searchTrainers("", -1)).rejects.toThrow(/page/u);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("explains authentication failures and doesn't expose database details", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "internal detail" } });
    await expect(searchTrainers()).rejects.toThrow("Sign in to explore trainer profiles.");
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST500", message: "internal detail" } });
    await expect(getTrainerProfile("ash")).rejects.toThrow("Unable to load this trainer. Please try again.");
  });

  it("explains when the connected database is missing the social migration", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    await expect(searchTrainers()).rejects.toThrow(/database migration first/iu);
  });
});
