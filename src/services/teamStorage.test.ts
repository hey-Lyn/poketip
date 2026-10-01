import { beforeEach, describe, expect, it } from "vitest";
import {
  createTeamMember,
  loadTeam,
  MAX_TEAM_SIZE,
  saveTeam,
} from "./teamStorage";

describe("teamStorage", () => {
  beforeEach(() => localStorage.clear());

  it("stores only the Pokémon data needed by the team builder", () => {
    const member = createTeamMember({
      id: 25,
      name: "pikachu",
      sprite: "pikachu.png",
      types: ["electric"],
      artwork: "large-pikachu.png",
    } as any);

    saveTeam([member]);

    expect(loadTeam()[0]).toEqual(member);
    expect(loadTeam()).toHaveLength(MAX_TEAM_SIZE);
    expect(loadTeam().slice(1)).toEqual(Array(5).fill(null));
    expect(loadTeam()[0]).not.toHaveProperty("artwork");
    expect(loadTeam()[0]).toMatchObject({
      level: 100,
      gender: "",
      ivs: {
        hp: 31,
        attack: 31,
        defense: 31,
        specialAttack: 31,
        specialDefense: 31,
        speed: 31,
      },
    });
  });

  it("ignores invalid data and limits restored teams to six members", () => {
    const members = Array.from({ length: MAX_TEAM_SIZE + 2 }, (_, index) => ({
      id: index + 1,
      name: `pokemon-${index + 1}`,
      sprite: `${index + 1}.png`,
      types: ["normal"],
    }));
    localStorage.setItem("poketip-team-v1", JSON.stringify([...members, null]));

    expect(loadTeam().filter(Boolean)).toHaveLength(MAX_TEAM_SIZE);
  });

  it("preserves empty slots between team members", () => {
    const team = Array(6).fill(null);
    team[4] = {
      id: 25,
      name: "pikachu",
      sprite: "pikachu.png",
      types: ["electric"],
    };

    saveTeam(team);

    expect(loadTeam()[3]).toBeNull();
    expect(loadTeam()[4]).toMatchObject(team[4]);
    expect(loadTeam()[4].moves).toEqual(["", "", "", ""]);
  });
});
