import { afterEach, describe, expect, it, vi } from "vitest";
import { validateShowdownTeam } from "./teamValidation";

afterEach(() => vi.unstubAllGlobals());
const result = { valid: false, format: "gen9-singles", showdownFormat: "gen9ou", problems: ["Pikachu can't have Intimidate."] };

describe("validateShowdownTeam", () => {
  it("sends the selected format and exact export with cancellation support", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => result });
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    expect(await validateShowdownTeam("Pikachu", "gen9-singles", signal)).toEqual(result);
    expect(fetchMock).toHaveBeenCalledWith("/api/teams/validate", expect.objectContaining({
      method: "POST", body: JSON.stringify({ team: "Pikachu", format: "gen9-singles" }), signal,
    }));
  });
  it("propagates service errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: { message: "Temporarily unavailable." } }) }));
    await expect(validateShowdownTeam("Pikachu", "gen9-singles")).rejects.toThrow("Temporarily unavailable.");
  });
  it.each([
    { ...result, valid: true }, { ...result, problems: [null] },
    { ...result, format: "gen9-ubers" }, { valid: true }, null,
  ])("rejects malformed or mismatched results: %j", async (data) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => data }));
    await expect(validateShowdownTeam("Pikachu", "gen9-singles")).rejects.toThrow("invalid response");
  });
  it("handles unreadable responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => { throw new Error("HTML response"); } }));
    await expect(validateShowdownTeam("Pikachu", "gen9-singles")).rejects.toThrow("unreadable response");
  });
});
