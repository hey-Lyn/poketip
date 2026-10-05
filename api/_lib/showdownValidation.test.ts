import { describe, expect, it } from "vitest";
import { COMPETITIVE_FORMATS } from "../../src/services/competitiveFormats";
import { validateTeamRequest } from "./showdownValidation";

const legalTeam = `Pikachu @ Light Ball
Ability: Static
EVs: 4 HP / 252 SpA / 252 Spe
Timid Nature
- Thunderbolt
- Volt Switch
- Surf
- Grass Knot`;

describe("official Showdown team validation", () => {
  it.each(COMPETITIVE_FORMATS)("validates a legal set in $label", ({ id, statsId }) => {
    const team = id === "gen9-doubles"
      ? `${legalTeam}\n\n${legalTeam.replace("Pikachu @ Light Ball", "Raichu @ Life Orb")}`
      : legalTeam;
    expect(validateTeamRequest({ format: id, team })).toEqual({
      valid: true, format: id, showdownFormat: statsId, problems: [],
    });
  });

  it.each([
    ["incompatible ability", "Static", "Intimidate", "can't have Intimidate"],
    ["illegal move", "Surf", "Spore", "can't learn Spore"],
    ["EV total", "4 HP", "252 HP", "limit of 510"],
    ["unknown move", "Surf", "Invented Move", "invalid move"],
  ])("rejects %s", (_name, from, to, message) => {
    const result = validateTeamRequest({ format: "gen9-singles", team: legalTeam.replace(from, to) });
    expect(result.valid).toBe(false);
    expect(result.problems.join("\n")).toContain(message);
  });

  it("applies format bans rather than relying on PokéAPI move availability", () => {
    const miraidon = legalTeam.replace("Pikachu @ Light Ball", "Miraidon @ Leftovers")
      .replace("Static", "Hadron Engine").replace("Surf", "Draco Meteor").replace("Grass Knot", "Dazzling Gleam");
    expect(validateTeamRequest({ format: "gen9-singles", team: miraidon }).problems.join("\n"))
      .toContain("banned");
    expect(validateTeamRequest({ format: "anything-goes", team: miraidon }).valid).toBe(true);
  });

  it("checks rules across the entire team", () => {
    const bulbasaur = `Bulbasaur\nAbility: Overgrow\nEVs: 4 HP / 252 SpA / 252 Spe\nModest Nature\n- Tackle`;
    const result = validateTeamRequest({ format: "gen9-monotype", team: `${legalTeam}\n\n${bulbasaur}` });
    expect(result.problems).toContain("Your team must share a type.");
  });

  it("checks Species Clause even when each set is individually legal", () => {
    const result = validateTeamRequest({ format: "gen9-singles", team: `${legalTeam}\n\n${legalTeam}` });
    expect(result.problems.join("\n")).toContain("Species Clause");
  });

  it("reports incomplete sets rather than treating them as valid", () => {
    const result = validateTeamRequest({ format: "gen9-singles", team: "Pikachu\nAbility: Static" });
    expect(result.valid).toBe(false);
    expect(result.problems.join("\n")).toContain("has no moves");
  });

  it("accepts JSON request bodies without changing the request", () => {
    const request = { format: "gen9-singles", team: legalTeam };
    const snapshot = JSON.stringify(request);
    expect(validateTeamRequest(snapshot).valid).toBe(true);
    expect(JSON.stringify(request)).toBe(snapshot);
  });

  it.each([
    undefined, null, [], "{", { format: "customgame", team: legalTeam },
    { format: "gen9-singles", team: [] }, { format: "gen9-singles", team: "" },
    { format: "gen9-singles", team: Array(7).fill(legalTeam).join("\n\n") },
    { format: "gen9-singles", team: JSON.stringify([{ species: "Pikachu", moves: [null] }]) },
  ])("rejects malformed, empty, or unsupported requests: %j", (body) => {
    expect(() => validateTeamRequest(body)).toThrow();
  });

  it("bounds request size before parsing or validating", () => {
    expect(() => validateTeamRequest({ format: "gen9-singles", team: "a".repeat(12_001) }))
      .toThrow(expect.objectContaining({ status: 413 }));
    expect(() => validateTeamRequest("a".repeat(13_001)))
      .toThrow(expect.objectContaining({ status: 413 }));
  });
});
