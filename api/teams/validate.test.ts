import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ validateTeamRequest: vi.fn() }));
vi.mock("../_lib/showdownValidation", async (importOriginal) => ({
  ...await importOriginal<typeof import("../_lib/showdownValidation")>(),
  validateTeamRequest: mocks.validateTeamRequest,
}));
import handler from "./validate";
import { TeamValidationRequestError } from "../_lib/showdownValidation";

function response() {
  return {
    headers: {} as Record<string, string>,
    statusCode: 200,
    payload: undefined as any,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}
afterEach(() => { vi.restoreAllMocks(); mocks.validateTeamRequest.mockReset(); });

describe("POST /api/teams/validate", () => {
  it("restricts methods and prevents response caching", async () => {
    const res = response();
    await handler({ method: "GET" }, res);
    expect(res.statusCode).toBe(405);
    expect(res.headers).toEqual({ "Cache-Control": "no-store", Allow: "POST" });
    expect(mocks.validateTeamRequest).not.toHaveBeenCalled();
  });
  it("returns rule violations as a successful validation result", async () => {
    const result = { valid: false, format: "gen9-singles", showdownFormat: "gen9ou", problems: ["Pikachu can't have Intimidate."] };
    mocks.validateTeamRequest.mockReturnValue(result);
    const res = response();
    await handler({ method: "POST", body: { team: "Pikachu", format: "gen9-singles" } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual(result);
  });
  it("returns a readable client error for invalid input", async () => {
    mocks.validateTeamRequest.mockImplementation(() => { throw new TeamValidationRequestError("The team export is too large.", 413); });
    const res = response();
    await handler({ method: "POST", body: {} }, res);
    expect(res.statusCode).toBe(413);
    expect(res.payload.error.code).toBe("INVALID_TEAM_REQUEST");
  });
  it("reports engine failure without claiming that the team is legal or leaking internals", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.validateTeamRequest.mockImplementation(() => { throw new Error("internal engine path"); });
    const res = response();
    await handler({ method: "POST", body: {} }, res);
    expect(res.statusCode).toBe(503);
    expect(res.payload.error.code).toBe("TEAM_VALIDATION_UNAVAILABLE");
    expect(JSON.stringify(res.payload)).not.toContain("internal engine path");
  });
});
