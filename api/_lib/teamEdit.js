import { Dex } from "@pkmn/dex";
import {
  getCampaignEncounters,
  getCampaignGame,
  getCampaignMilestone,
  getGameVersionGroup,
} from "../../src/services/campaignData.js";

const POKEAPI_URL = "https://pokeapi.co/api/v2";
const MAX_POKEMON_ID = 20_000;
const TEAM_STATS = [
  "hp", "attack", "defense", "specialAttack", "specialDefense", "speed",
];
const NATURES = [
  "Adamant", "Bashful", "Bold", "Brave", "Calm", "Careful", "Docile",
  "Gentle", "Hardy", "Hasty", "Impish", "Jolly", "Lax", "Lonely",
  "Mild", "Modest", "Naive", "Naughty", "Quiet", "Quirky", "Rash",
  "Relaxed", "Sassy", "Serious", "Timid",
];
const NATURE_BY_NAME = new Map(NATURES.map((nature) => [nature.toLowerCase(), nature]));
const POKEMON_TYPES = new Set([
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
]);
const GENDERS = new Set(["", "male", "female", "genderless"]);
const HOENN_STARTERS = ["treecko", "torchic", "mudkip"];

function expandEvolutionNames(names) {
  const available = new Set(names);
  const queue = [...available];

  while (queue.length) {
    const current = queue.shift();
    const species = Dex.species.get(current);
    if (!species?.exists) continue;

    (species.evos ?? []).forEach((evolution) => {
      const slug = toSlug(evolution);
      if (!available.has(slug)) {
        available.add(slug);
        queue.push(slug);
      }
    });
  }

  return available;
}

export function getCampaignObtainableNames(gameId, milestoneId) {
  const encounterNames = getCampaignEncounters(gameId, milestoneId)
    .map(({ pokemon }) => pokemon);

  return expandEvolutionNames([...encounterNames, ...HOENN_STARTERS]);
}

export const TEAM_EDIT_INSTRUCTIONS = `The user has explicitly selected the team-edit action.
Return only one valid JSON object with this exact top-level shape:
{"message":"brief description of what was changed","actions":[]}

Each action must use this shape:
{"type":"update_team_slot","slot":1,"pokemon":"pokemon-name-or-id","changes":{}}

Rules:
- Only create actions that directly implement the latest user's explicit request.
- slot is 1 through 6.
- Omit pokemon when editing the Pokémon already in that slot. Include it when adding or replacing a Pokémon.
- changes may contain only: level, item, ability, nature, teraType, gender, moves, evs, ivs.
- moves is an array of at most four move names.
- evs and ivs use the keys hp, attack, defense, specialAttack, specialDefense, speed.
- Use PokéAPI-style lowercase hyphenated identifiers for Pokémon, items, abilities, and moves.
- Use a correctly capitalized English nature name.
- EVs must be 0-252 each and at most 510 total. IVs must be 0-31. Level must be 1-100.
- For Gen 9 formats, avoid legacy or transfer-only moves. If move legality is uncertain, omit the move instead of inventing a set.
- For campaign teams, only add or replace with a species obtainable before the selected milestone: one of the listed wild encounters, one of its evolutions, or a Hoenn starter. The server rejects anything else.
- When adding or editing a campaign Pokémon, fill its moves with up to four legal moves. Use legalMoves from verifiedPokemon for existing members, and verifiedRecommendationCandidates for newly added Pokémon. Prefer level-up moves already learned at or below the Pokémon's level, plus TM, egg, and tutor moves. Use the milestone's recommendedLevel (and recommendedRange) to set a sensible level for the team.
- If the request is not an explicit instruction to change the team, return an empty actions array.
- Do not include Markdown, code fences, commentary, or properties outside the schema.`;

export class TeamEditError extends Error {
  constructor(message, code = "INVALID_TEAM_EDIT", status = 422) {
    super(message);
    this.name = "TeamEditError";
    this.code = code;
    this.status = status;
  }
}

function toSlug(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function displayName(value) {
  return String(value)
    .split("-")
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function parsePlan(rawPlan) {
  if (typeof rawPlan !== "string") {
    throw new TeamEditError("The AI returned an unreadable team edit.");
  }
  const start = rawPlan.indexOf("{");
  const end = rawPlan.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new TeamEditError("The AI did not return a valid team edit.");
  }

  try {
    return JSON.parse(rawPlan.slice(start, end + 1));
  } catch {
    throw new TeamEditError("The AI returned malformed team edit data.");
  }
}

async function fetchResource(path, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(`${POKEAPI_URL}/${path}`);
  } catch {
    throw new TeamEditError(
      "PokéAPI could not validate the requested team changes.",
      "TEAM_EDIT_VALIDATION_UNAVAILABLE",
      502,
    );
  }
  if (!response.ok) {
    throw new TeamEditError(`The requested ${path.split("/")[0]} does not exist.`);
  }
  return response.json();
}

function normalizePokemonReference(value) {
  if (Number.isInteger(value) && value >= 1 && value <= MAX_POKEMON_ID) return value;
  const slug = toSlug(value);
  if (!slug || slug.length > 80) {
    throw new TeamEditError("A requested Pokémon is invalid.");
  }
  return slug;
}

function normalizeStats(values, field, maximum) {
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    throw new TeamEditError(`${field} must be an object.`);
  }
  const result = {};
  Object.entries(values).forEach(([stat, value]) => {
    if (!TEAM_STATS.includes(stat) || !Number.isInteger(value) || value < 0 || value > maximum) {
      throw new TeamEditError(`${field} contain an invalid value.`);
    }
    result[stat] = value;
  });
  return result;
}

function pokemonSummary(pokemon) {
  const speciesName = pokemon.species?.name ?? pokemon.name;
  return {
    id: pokemon.id,
    name: pokemon.name,
    speciesName,
    sprite:
      pokemon.sprites?.front_default ??
      pokemon.sprites?.other?.["official-artwork"]?.front_default ??
      "",
    types: pokemon.types.map(({ type }) => type.name),
    abilities: pokemon.abilities.map(({ ability, is_hidden: isHidden }) => ({
      name: ability.name,
      isHidden,
    })),
  };
}

function moveIsAvailableInFormat(moveData, format) {
  if (format === "national-dex") return true;
  const requiredVersionGroup = getGameVersionGroup(format) ?? "scarlet-violet";
  const versions = moveData.version_group_details;
  if (!Array.isArray(versions) || !versions.length) return true;
  return versions.some(({ version_group: versionGroup }) =>
    versionGroup?.name === requiredVersionGroup,
  );
}

async function normalizeChanges(
  rawChanges,
  pokemon,
  currentMember,
  replacing,
  format,
  fetchImpl,
) {
  const changes = rawChanges && typeof rawChanges === "object" && !Array.isArray(rawChanges)
    ? rawChanges
    : {};
  const normalized = {};
  const adjustments = [];
  const legalMoves = new Set();
  const levelOnlyMoves = new Map();
  const requiredGroup = format === "national-dex"
    ? null
    : getGameVersionGroup(format) ?? "scarlet-violet";

  pokemon.moves.forEach((moveData) => {
    const moveName = moveData.move.name;
    if (moveIsAvailableInFormat(moveData, format)) legalMoves.add(moveName);

    const details = Array.isArray(moveData.version_group_details)
      ? moveData.version_group_details
      : [];
    const eligible = requiredGroup === null
      ? details
      : details.filter(({ version_group: group }) => group?.name === requiredGroup);
    if (!eligible.length) return;

    const hasNonLevelUp = eligible.some(
      (detail) => detail.move_learn_method?.name !== "level-up",
    );
    const levelUps = eligible
      .filter((detail) => detail.move_learn_method?.name === "level-up")
      .map((detail) => detail.level_learned_at ?? 0);
    if (!hasNonLevelUp && levelUps.length) {
      levelOnlyMoves.set(moveName, Math.min(...levelUps));
    }
  });
  const legalAbilities = new Set(pokemon.abilities.map(({ ability }) => ability.name));

  if (Object.hasOwn(changes, "level")) {
    if (!Number.isInteger(changes.level) || changes.level < 1 || changes.level > 100) {
      throw new TeamEditError("The requested level must be between 1 and 100.");
    }
    normalized.level = changes.level;
  }

  if (Object.hasOwn(changes, "item")) {
    const item = toSlug(changes.item);
    if (item) await fetchResource(`item/${item}`, fetchImpl);
    normalized.item = item;
  }

  if (Object.hasOwn(changes, "ability")) {
    const ability = toSlug(changes.ability);
    if (!legalAbilities.has(ability)) {
      throw new TeamEditError(`${pokemon.name} cannot use the requested ability.`);
    }
    normalized.ability = ability;
  }

  if (Object.hasOwn(changes, "nature")) {
    const nature = NATURE_BY_NAME.get(String(changes.nature).trim().toLowerCase());
    if (!nature) throw new TeamEditError("The requested nature is invalid.");
    normalized.nature = nature;
  }

  if (Object.hasOwn(changes, "teraType")) {
    const teraType = toSlug(changes.teraType);
    if (!POKEMON_TYPES.has(teraType)) {
      throw new TeamEditError("The requested Tera Type is invalid.");
    }
    normalized.teraType = teraType;
  }

  if (Object.hasOwn(changes, "gender")) {
    const gender = toSlug(changes.gender);
    if (!GENDERS.has(gender)) throw new TeamEditError("The requested gender is invalid.");
    normalized.gender = gender;
  }

  const effectiveLevel = Number.isInteger(changes.level)
    ? changes.level
    : currentMember?.level ?? 100;

  if (Object.hasOwn(changes, "moves")) {
    if (!Array.isArray(changes.moves) || changes.moves.length > 4) {
      throw new TeamEditError("A Pokémon may have at most four moves.");
    }
    const moves = changes.moves.filter(Boolean).map(toSlug);
    if (new Set(moves).size !== moves.length) {
      throw new TeamEditError("A Pokémon cannot use the same move twice.");
    }
    const unavailableMoves = moves.filter((move) => !legalMoves.has(move));
    const levelBlockedMoves = moves.filter((move) =>
      legalMoves.has(move) &&
      levelOnlyMoves.has(move) &&
      effectiveLevel < levelOnlyMoves.get(move),
    );
    const availableMoves = moves.filter((move) =>
      legalMoves.has(move) &&
      (!levelOnlyMoves.has(move) || effectiveLevel >= levelOnlyMoves.get(move)),
    );
    if (unavailableMoves.length) {
      adjustments.push(
        `${displayName(pokemon.name)}: ${unavailableMoves.map(displayName).join(", ")} ${unavailableMoves.length === 1 ? "is" : "are"} unavailable in the selected format and ${unavailableMoves.length === 1 ? "was" : "were"} omitted.`,
      );
    }
    if (levelBlockedMoves.length) {
      adjustments.push(
        `${displayName(pokemon.name)}: ${levelBlockedMoves.map(displayName).join(", ")} ${levelBlockedMoves.length === 1 ? "is" : "are"} learned above level ${effectiveLevel} and ${levelBlockedMoves.length === 1 ? "was" : "were"} omitted.`,
      );
    }
    if (availableMoves.length || replacing) {
      normalized.moves = Array.from(
        { length: 4 },
        (_, index) => availableMoves[index] ?? "",
      );
    }
  }

  const baseEvs = replacing
    ? Object.fromEntries(TEAM_STATS.map((stat) => [stat, 0]))
    : currentMember?.evs ?? {};
  if (Object.hasOwn(changes, "evs")) {
    normalized.evs = { ...baseEvs, ...normalizeStats(changes.evs, "EVs", 252) };
    if (Object.values(normalized.evs).reduce((sum, value) => sum + value, 0) > 510) {
      throw new TeamEditError("The requested EV spread exceeds 510 EVs.");
    }
  }

  const baseIvs = replacing
    ? Object.fromEntries(TEAM_STATS.map((stat) => [stat, 31]))
    : currentMember?.ivs ?? {};
  if (Object.hasOwn(changes, "ivs")) {
    normalized.ivs = { ...baseIvs, ...normalizeStats(changes.ivs, "IVs", 31) };
  }

  return { changes: normalized, adjustments };
}

export async function resolveTeamEditPlan(rawPlan, context, { fetchImpl = fetch } = {}) {
  const plan = parsePlan(rawPlan);
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new TeamEditError("The AI returned an invalid team edit plan.");
  }
  if (!Array.isArray(plan.actions) || plan.actions.length > 6) {
    throw new TeamEditError("The AI requested too many team changes.");
  }

  const nextPokemonIds = context.members.map((member) => member?.id ?? null);
  const actions = [];
  const adjustments = [];

  for (const rawAction of plan.actions) {
    if (rawAction?.type !== "update_team_slot") {
      throw new TeamEditError("The AI requested an unsupported team action.");
    }
    if (!Number.isInteger(rawAction.slot) || rawAction.slot < 1 || rawAction.slot > 6) {
      throw new TeamEditError("The AI requested an invalid team slot.");
    }

    const slotIndex = rawAction.slot - 1;
    const currentMember = context.members[slotIndex];
    if (rawAction.pokemon == null && !currentMember) {
      throw new TeamEditError(`Team slot ${rawAction.slot} needs a Pokémon.`);
    }
    const reference = normalizePokemonReference(rawAction.pokemon ?? currentMember.id);
    const pokemon = await fetchResource(`pokemon/${reference}`, fetchImpl);
    const replacing = pokemon.id !== currentMember?.id;

    if (context.mode === "campaign" && replacing) {
      const game = getCampaignGame(context.campaign?.gameId);
      const milestone = getCampaignMilestone(game.id, context.campaign?.milestoneId);
      const obtainable = getCampaignObtainableNames(game.id, milestone.id);
      const requestedSpecies = toSlug(pokemon.species?.name ?? pokemon.name);

      if (!obtainable.has(requestedSpecies) && !obtainable.has(toSlug(pokemon.name))) {
        throw new TeamEditError(
          `${displayName(pokemon.name)} is not obtainable yet in Pokémon ${game.label} (${milestone.label}).`,
          "TEAM_EDIT_POKEMON_UNAVAILABLE",
        );
      }
    }

    const normalizedEdit = await normalizeChanges(
      rawAction.changes,
      pokemon,
      currentMember,
      replacing,
      context.format,
      fetchImpl,
    );
    adjustments.push(...normalizedEdit.adjustments);
    if (!replacing && !Object.keys(normalizedEdit.changes).length) {
      continue;
    }
    const summary = pokemonSummary(pokemon);

    nextPokemonIds[slotIndex] = pokemon.id;
    actions.push({
      type: "update_team_slot",
      slot: rawAction.slot,
      pokemon: summary,
      changes: normalizedEdit.changes,
    });
  }

  const configuredIds = nextPokemonIds.filter(Boolean);
  if (new Set(configuredIds).size !== configuredIds.length) {
    throw new TeamEditError("The requested changes would duplicate a Pokémon in the team.");
  }

  const message = typeof plan.message === "string" && plan.message.trim()
    ? plan.message.trim().slice(0, 1_000)
    : actions.length
      ? "The requested team changes were applied."
      : "No explicit team change was requested.";

  return { message, actions, adjustments };
}
