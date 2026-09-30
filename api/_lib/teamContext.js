import {
  analyzeTeamDefense,
  analyzeOffensiveCoverage,
  getDefensiveMultiplier,
  POKEMON_TYPES,
} from "../../src/services/teamAnalysis.js";
import { getCompetitiveTeamContext } from "./competitiveContext.js";
import { getCampaignGroundingContext } from "./campaignContext.js";
import { getGameVersionGroup } from "../../src/services/campaignData.js";

const POKEAPI_URL = "https://pokeapi.co/api/v2";
const CACHE_TTL = 60 * 60 * 1_000;
const pokemonCache = new Map();

export class TeamContextError extends Error {
  constructor(message, code = "TEAM_CONTEXT_UNAVAILABLE", status = 502) {
    super(message);
    this.name = "TeamContextError";
    this.code = code;
    this.status = status;
  }
}

function readCache(cache, key) {
  const entry = cache.get(key);
  return entry?.expiresAt > Date.now() ? entry.value : null;
}

function writeCache(cache, key, value) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL });
  return value;
}

async function fetchPokemon(id, fetchImpl, signal) {
  const cached = readCache(pokemonCache, id);
  if (cached) return cached;

  const response = await fetchImpl(`${POKEAPI_URL}/pokemon/${id}`, { signal });
  if (!response.ok) {
    throw new TeamContextError(
      response.status === 404
        ? `The Pokémon in team slot ${id} could not be found.`
        : "PokéAPI team data is temporarily unavailable.",
      response.status === 404 ? "TEAM_POKEMON_NOT_FOUND" : "TEAM_CONTEXT_UNAVAILABLE",
      response.status === 404 ? 404 : 502,
    );
  }
  return writeCache(pokemonCache, id, await response.json());
}

function normalizeName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function requiredVersionGroup(format) {
  if (format === "national-dex") return null;
  return getGameVersionGroup(format) ?? "scarlet-violet";
}

export function buildLegalMoves(pokemon, format, level) {
  const requiredGroup = requiredVersionGroup(format);
  const moves = [];
  const seen = new Set();

  pokemon.moves.forEach(({ move, version_group_details: versionDetails }) => {
    const name = move.name;
    if (seen.has(name)) return;
    seen.add(name);

    const details = Array.isArray(versionDetails) ? versionDetails : [];
    if (!details.length) {
      moves.push({ name, method: "level-up", level: 0 });
      return;
    }

    const eligible = requiredGroup === null
      ? details
      : details.filter(({ version_group: group }) => group?.name === requiredGroup);
    const levelUps = eligible
      .filter((detail) => detail.move_learn_method?.name === "level-up")
      .map((detail) => ({ level: detail.level_learned_at ?? 0 }))
      .sort((first, second) => first.level - second.level);
    const learnedAtLevel = levelUps.find(({ level: required }) => required <= level);
    const otherMethod = eligible.find((detail) => detail.move_learn_method?.name !== "level-up");

    if (learnedAtLevel) {
      moves.push({ name, method: "level-up", level: learnedAtLevel.level });
    } else if (otherMethod) {
      moves.push({
        name,
        method: otherMethod.move_learn_method?.name ?? "other",
        level: 0,
      });
    }
  });

  return moves;
}

function formatMember(member, pokemon, mode, format) {
  const legalMoves = new Set(pokemon.moves.map(({ move }) => move.name));
  const abilities = pokemon.abilities.map(({ ability }) => ability.name);
  const types = pokemon.types.map(({ type }) => type.name);
  const verifiedPokemon = {
    id: pokemon.id,
    name: pokemon.name,
    types,
    baseStats: Object.fromEntries(
      pokemon.stats.map(({ base_stat: value, stat }) => [stat.name, value]),
    ),
    availableAbilities: abilities,
    defensiveDamageMultipliers: Object.fromEntries(
      POKEMON_TYPES.map((type) => [
        type,
        getDefensiveMultiplier(type, types),
      ]),
    ),
  };

  if (mode === "campaign") {
    verifiedPokemon.legalMoves = buildLegalMoves(pokemon, format, member.level);
  }

  return {
    slot: member.slot,
    verifiedPokemon,
    userConfiguration: {
      level: member.level,
      item: member.item || null,
      ability: member.ability || null,
      abilityExistsForSpecies: member.ability
        ? abilities.includes(normalizeName(member.ability))
        : null,
      nature: member.nature || null,
      teraType: member.teraType || null,
      gender: member.gender || null,
      evs: member.evs,
      ivs: member.ivs,
      moves: member.moves.filter(Boolean).map((name) => ({
        name,
        existsForSpecies: legalMoves.has(normalizeName(name)),
      })),
    },
  };
}

export async function getTeamGroundingContext(
  context,
  {
    fetchImpl = fetch,
    competitiveFetchImpl = null,
    timeoutMs = 8_000,
  } = {},
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const configuredMembers = context.members.filter(Boolean);
    const pokemonDetails = await Promise.all(
      configuredMembers.map((member) =>
        fetchPokemon(member.id, fetchImpl, controller.signal),
      ),
    );
    const members = configuredMembers.map((member, index) =>
      formatMember(member, pokemonDetails[index], context.mode, context.format),
    );
    const verifiedTypes = members.map(({ verifiedPokemon }) => ({
      types: verifiedPokemon.types,
    }));
    const defensiveAnalysis = analyzeTeamDefense(verifiedTypes);
    const offensiveAnalysis = analyzeOffensiveCoverage(context.moveTypes);
    const competitive = context.mode !== "campaign" && competitiveFetchImpl
      ? await getCompetitiveTeamContext(
          context.format,
          pokemonDetails.map(({ name }) => name),
          {
            fetchImpl: competitiveFetchImpl,
            teamTypes: verifiedTypes.map(({ types }) => types),
          },
        )
      : null;
    const campaign = context.mode === "campaign"
      ? getCampaignGroundingContext(context.campaign)
      : null;
    const sources = [...new Set([
      ...pokemonDetails.map(({ id }) => `${POKEAPI_URL}/pokemon/${id}`),
      ...(competitive?.source ? [competitive.source] : []),
    ])];

    return {
      kind: "team",
      mode: context.mode,
      source: competitive
        ? "PokéAPI, Pokémon Showdown usage statistics, and user team configuration"
        : "PokéAPI and user team configuration",
      sources,
      format: context.format,
      filledSlots: members.length,
      emptySlots: context.members.flatMap(
        (member, index) => member ? [] : [index + 1],
      ),
      members,
      competitive,
      campaign,
      analysis: {
        sharedWeaknesses: defensiveAnalysis.sharedWeaknesses,
        defensiveAnswers: defensiveAnalysis.resistances,
        offensiveCoverage: {
          ...offensiveAnalysis,
          moveTypesSource: "Calculated by the Pokétip client from PokéAPI move data",
        },
      },
    };
  } catch (error) {
    if (error instanceof TeamContextError) throw error;
    if (error?.name === "AbortError") {
      throw new TeamContextError(
        "PokéAPI took too long to prepare the team analysis.",
        "TEAM_CONTEXT_TIMEOUT",
        504,
      );
    }
    throw new TeamContextError("PokéAPI team data is temporarily unavailable.");
  } finally {
    clearTimeout(timeout);
  }
}
