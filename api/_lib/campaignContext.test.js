import { describe, expect, it } from "vitest";
import { getCampaignGroundingContext } from "./campaignContext.js";

describe("getCampaignGroundingContext", () => {
  it("includes verified wild encounters for the selected milestone", () => {
    const context = getCampaignGroundingContext({
      gameId: "emerald",
      milestoneId: "before-roxanne",
    });

    expect(context.kind).toBe("campaign");
    expect(context.milestone.id).toBe("before-roxanne");
    expect(context.encounters.length).toBeGreaterThan(0);
    expect(context.encounters).toEqual(expect.arrayContaining([
      expect.objectContaining({ pokemon: "poochyena", method: "Tall grass" }),
    ]));
    expect(context.note).toContain("tall grass");
  });

  it("scopes encounters to the milestone availability", () => {
    const beforeRoxanne = getCampaignGroundingContext({
      gameId: "emerald",
      milestoneId: "before-roxanne",
    });
    const beforeBrawly = getCampaignGroundingContext({
      gameId: "emerald",
      milestoneId: "before-brawly",
    });

    const roxanneLocations = new Set(beforeRoxanne.encounters.map(({ location }) => location));
    const brawlyLocations = new Set(beforeBrawly.encounters.map(({ location }) => location));

    expect(roxanneLocations.has("Granite Cave 1F")).toBe(false);
    expect(brawlyLocations.has("Granite Cave 1F")).toBe(true);
    expect(brawlyLocations.has("Granite Cave B2F")).toBe(true);
  });

  it("builds a Fire Red context with encounters and a recommended level", () => {
    const context = getCampaignGroundingContext({
      gameId: "firered",
      milestoneId: "before-brock",
    });

    expect(context.milestone.id).toBe("before-brock");
    expect(context.milestone.recommendedLevel).toBe(10);
    expect(context.encounters.length).toBeGreaterThan(0);
    expect(context.encounters).toEqual(expect.arrayContaining([
      expect.objectContaining({ pokemon: "pidgey", method: "Tall grass" }),
      expect.objectContaining({ pokemon: "pikachu", location: "Viridian Forest" }),
    ]));
  });
});
