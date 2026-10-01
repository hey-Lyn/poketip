import { describe, expect, it } from "vitest";
import {
  EMERALD_ENCOUNTERS,
  getCampaignEncounters,
  getCampaignMilestone,
} from "./campaignData";

describe("campaign encounter data", () => {
  it("only lists walking and Rock Smash encounter methods", () => {
    const methods = new Set(EMERALD_ENCOUNTERS.map(({ method }) => method));
    expect([...methods].sort()).toEqual(["rock-smash", "walk"]);
  });

  it("exposes the earliest Hoenn catches before Roxanne", () => {
    const encounters = getCampaignEncounters("emerald", "before-roxanne");

    expect(encounters).toEqual(expect.arrayContaining([
      expect.objectContaining({ pokemon: "poochyena", location: "Route 101", minLevel: 2, maxLevel: 3 }),
      expect.objectContaining({ pokemon: "ralts", location: "Route 102" }),
      expect.objectContaining({ pokemon: "slakoth", location: "Petalburg Woods" }),
    ]));
  });

  it("does not include areas locked behind later milestones", () => {
    const beforeRoxanne = getCampaignEncounters("emerald", "before-roxanne")
      .map(({ location }) => location);

    expect(beforeRoxanne).not.toContain("Granite Cave 1F");
    expect(beforeRoxanne).not.toContain("Route 110");

    const beforeBrawly = getCampaignEncounters("emerald", "before-brawly")
      .map(({ location }) => location);
    expect(beforeBrawly).toContain("Granite Cave 1F");
    expect(beforeBrawly).toContain("Granite Cave B2F");
  });

  it("adds Mauville-era and Lavaridge-era locations at the right milestones", () => {
    const beforeWattson = getCampaignEncounters("emerald", "before-wattson");
    const beforeFlannery = getCampaignEncounters("emerald", "before-flannery");

    expect(beforeWattson).toEqual(expect.arrayContaining([
      expect.objectContaining({ pokemon: "electrike", location: "Route 110" }),
      expect.objectContaining({ pokemon: "trapinch", location: "Route 111" }),
    ]));
    expect(beforeWattson.map(({ location }) => location)).not.toContain("Jagged Pass");

    expect(beforeFlannery).toEqual(expect.arrayContaining([
      expect.objectContaining({ pokemon: "machop", location: "Jagged Pass" }),
      expect.objectContaining({ pokemon: "zubat", location: "Meteor Falls" }),
    ]));
  });

  it("returns an empty list for unsupported games", () => {
    expect(getCampaignEncounters("ruby", "before-roxanne")).toEqual([]);
  });

  it("exposes a recommended level and range for each milestone", () => {
    expect(getCampaignMilestone("emerald", "before-roxanne")).toMatchObject({
      recommendedLevel: 12,
      recommendedRange: [10, 15],
    });
    expect(getCampaignMilestone("emerald", "before-brawly")).toMatchObject({
      recommendedLevel: 16,
      recommendedRange: [14, 19],
    });
    expect(getCampaignMilestone("emerald", "before-wattson")).toMatchObject({
      recommendedLevel: 22,
      recommendedRange: [20, 24],
    });
    expect(getCampaignMilestone("emerald", "before-flannery")).toMatchObject({
      recommendedLevel: 26,
      recommendedRange: [24, 29],
    });
  });

  it("exposes Fire Red milestones with recommended levels", () => {
    expect(getCampaignMilestone("firered", "before-brock")).toMatchObject({
      recommendedLevel: 10,
      recommendedRange: [8, 12],
    });
    expect(getCampaignMilestone("firered", "before-misty")).toMatchObject({
      recommendedLevel: 18,
      recommendedRange: [16, 21],
    });
    expect(getCampaignMilestone("firered", "before-lt-surge")).toMatchObject({
      recommendedLevel: 22,
      recommendedRange: [20, 24],
    });
    expect(getCampaignMilestone("firered", "before-erika")).toMatchObject({
      recommendedLevel: 28,
      recommendedRange: [26, 30],
    });
  });

  it("exposes Fire Red encounters scoped to the milestone", () => {
    const beforeBrock = getCampaignEncounters("firered", "before-brock");

    expect(beforeBrock).toEqual(expect.arrayContaining([
      expect.objectContaining({ pokemon: "pidgey", location: "Route 1", minLevel: 2, maxLevel: 5 }),
      expect.objectContaining({ pokemon: "mankey", location: "Route 22" }),
      expect.objectContaining({ pokemon: "pikachu", location: "Viridian Forest" }),
    ]));
    expect(beforeBrock.map(({ location }) => location)).not.toContain("Mt. Moon 1F");

    const beforeMisty = getCampaignEncounters("firered", "before-misty");
    expect(beforeMisty).toEqual(expect.arrayContaining([
      expect.objectContaining({ pokemon: "zubat", location: "Mt. Moon 1F" }),
      expect.objectContaining({ pokemon: "oddish", location: "Route 24" }),
    ]));

    const beforeErika = getCampaignEncounters("firered", "before-erika");
    expect(beforeErika).toEqual(expect.arrayContaining([
      expect.objectContaining({ pokemon: "growlithe", location: "Route 8" }),
      expect.objectContaining({ pokemon: "venonat", location: "Route 13" }),
    ]));
    expect(beforeErika).toEqual(expect.arrayContaining([
      expect.objectContaining({ pokemon: "machop", location: "Rock Tunnel 1F" }),
    ]));
  });
});
