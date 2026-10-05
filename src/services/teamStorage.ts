import type { PokemonLite, Team, TeamMember } from "../types";

const TEAM_STORAGE_KEY = "poketip-team-v1";
const TEAM_FORMAT_STORAGE_KEY = "poketip-team-format-v1";
export const MAX_TEAM_SIZE = 6;
export const EMPTY_EVS = {
  hp: 0,
  attack: 0,
  defense: 0,
  specialAttack: 0,
  specialDefense: 0,
  speed: 0,
};
export const PERFECT_IVS = {
  hp: 31,
  attack: 31,
  defense: 31,
  specialAttack: 31,
  specialDefense: 31,
  speed: 31,
};

function isValidTeamMember(member: any): boolean {
  return Number.isInteger(member?.id) &&
    typeof member.name === "string" &&
    typeof member.sprite === "string" &&
    Array.isArray(member.types);
}

export function createTeamMember(pokemon: PokemonLite, settings: Partial<TeamMember> = {}): TeamMember {
  return {
    id: pokemon.id,
    name: pokemon.name,
    sprite: pokemon.sprite,
    types: pokemon.types,
    speciesName: pokemon.speciesName ?? settings.speciesName ?? pokemon.name,
    item: settings.item ?? "",
    ability: settings.ability ?? pokemon.abilities?.[0]?.name ?? "",
    nature: settings.nature ?? "",
    teraType: settings.teraType ?? pokemon.types[0] ?? "",
    level: Math.min(100, Math.max(1, Number(settings.level) || 100)),
    gender: settings.gender ?? "",
    ivs: { ...PERFECT_IVS, ...settings.ivs },
    evs: { ...EMPTY_EVS, ...settings.evs },
    moves: Array.from({ length: 4 }, (_, index) => settings.moves?.[index] ?? ""),
  };
}

export function loadTeam(): Team {
  try {
    const storedTeam = JSON.parse(localStorage.getItem(TEAM_STORAGE_KEY) ?? "null");

    if (!Array.isArray(storedTeam)) {
      return Array.from({ length: MAX_TEAM_SIZE }, () => null);
    }

    return Array.from({ length: MAX_TEAM_SIZE }, (_, index) => {
      const member = storedTeam[index];
      return isValidTeamMember(member) ? createTeamMember(member as PokemonLite, member) : null;
    });
  } catch {
    return Array.from({ length: MAX_TEAM_SIZE }, () => null);
  }
}

export function saveTeam(team: Team) {
  try {
    const slots = Array.from(
      { length: MAX_TEAM_SIZE },
      (_, index) => team[index] ?? null,
    );
    localStorage.setItem(TEAM_STORAGE_KEY, JSON.stringify(slots));
  } catch {
    // The current team remains usable even if browser storage is unavailable.
  }
}

export function loadTeamFormat(fallbackFormat: string): string {
  try {
    return localStorage.getItem(TEAM_FORMAT_STORAGE_KEY) || fallbackFormat;
  } catch {
    return fallbackFormat;
  }
}

export function saveTeamFormat(format: string) {
  try {
    localStorage.setItem(TEAM_FORMAT_STORAGE_KEY, format);
  } catch {
    // The selected format remains usable even if storage is unavailable.
  }
}
