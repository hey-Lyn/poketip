import {
  createTeamMember,
  MAX_TEAM_SIZE,
} from "./teamStorage";

const STATS = [
  "hp", "attack", "defense", "specialAttack", "specialDefense", "speed",
];

function validStats(values, maximum) {
  return values && typeof values === "object" && STATS.every((stat) =>
    Number.isInteger(values[stat]) && values[stat] >= 0 && values[stat] <= maximum,
  );
}

function normalizeChanges(changes = {}) {
  const normalized = { ...changes };
  if (changes.moves) {
    if (!Array.isArray(changes.moves) || changes.moves.length > 4) {
      throw new Error("The AI returned invalid moves.");
    }
    normalized.moves = Array.from(
      { length: 4 },
      (_, index) => changes.moves[index] ?? "",
    );
  }
  if (changes.evs) {
    if (!validStats(changes.evs, 252)) throw new Error("The AI returned invalid EVs.");
    const total = Object.values(changes.evs).reduce((sum, value) => sum + value, 0);
    if (total > 510) throw new Error("The AI returned more than 510 EVs.");
    normalized.evs = { ...changes.evs };
  }
  if (changes.ivs) {
    if (!validStats(changes.ivs, 31)) throw new Error("The AI returned invalid IVs.");
    normalized.ivs = { ...changes.ivs };
  }
  return normalized;
}

export function applyTeamAiActions(team, actions) {
  if (!Array.isArray(actions) || actions.length > MAX_TEAM_SIZE) {
    throw new Error("The AI returned an invalid team edit.");
  }

  const nextTeam = Array.from(
    { length: MAX_TEAM_SIZE },
    (_, index) => team[index] ? { ...team[index] } : null,
  );

  actions.forEach((action) => {
    const slotIndex = action?.slot - 1;
    if (
      action?.type !== "update_team_slot" ||
      !Number.isInteger(slotIndex) ||
      slotIndex < 0 ||
      slotIndex >= MAX_TEAM_SIZE ||
      !Number.isInteger(action.pokemon?.id) ||
      typeof action.pokemon?.name !== "string" ||
      typeof action.pokemon?.sprite !== "string" ||
      !Array.isArray(action.pokemon?.types)
    ) {
      throw new Error("The AI returned an invalid team action.");
    }

    const changes = normalizeChanges(action.changes);
    const current = nextTeam[slotIndex];
    nextTeam[slotIndex] = current?.id === action.pokemon.id
      ? {
          ...current,
          ...changes,
          evs: changes.evs ?? current.evs,
          ivs: changes.ivs ?? current.ivs,
          moves: changes.moves ?? current.moves,
        }
      : createTeamMember(action.pokemon, changes);
  });

  const ids = nextTeam.filter(Boolean).map(({ id }) => id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("The AI edit would duplicate a Pokémon in the team.");
  }

  return nextTeam;
}
