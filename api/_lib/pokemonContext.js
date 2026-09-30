import { buildLegalMoves } from "./teamContext.js";

const POKEAPI_URL = "https://pokeapi.co/api/v2";
const CACHE_TTL = 60 * 60 * 1_000;
const pokemonContextCache = new Map();
const DEFENSIVE_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

export class PokemonContextError extends Error {
  constructor(message, code = "POKEMON_CONTEXT_UNAVAILABLE", status = 502) {
    super(message);
    this.name = "PokemonContextError";
    this.code = code;
    this.status = status;
  }
}

async function fetchJson(url, fetchImpl, signal) {
  const response = await fetchImpl(url, { signal });

  if (!response.ok) {
    if (response.status === 404) {
      throw new PokemonContextError(
        "The selected Pokémon could not be found.",
        "POKEMON_NOT_FOUND",
        404,
      );
    }
    throw new PokemonContextError("PokéAPI data is temporarily unavailable.");
  }

  return response.json();
}

function getSpeciesId(pokemon) {
  const id = Number(pokemon.species?.url.split("/").filter(Boolean).at(-1));
  return Number.isInteger(id) ? id : pokemon.id;
}

function getEnglishValue(items, field) {
  return items?.find(({ language }) => language.name === "en")?.[field] ?? null;
}

function calculateDefensiveMatchups(relations) {
  const multipliers = Object.fromEntries(
    DEFENSIVE_TYPES.map((type) => [type, 1]),
  );

  relations.forEach((relation) => {
    relation.double_damage_from.forEach(({ name }) => {
      multipliers[name] *= 2;
    });
    relation.half_damage_from.forEach(({ name }) => {
      multipliers[name] *= 0.5;
    });
    relation.no_damage_from.forEach(({ name }) => {
      multipliers[name] = 0;
    });
  });

  return {
    weaknesses: DEFENSIVE_TYPES
      .filter((type) => multipliers[type] > 1)
      .map((type) => ({ type, multiplier: multipliers[type] })),
    resistances: DEFENSIVE_TYPES
      .filter((type) => multipliers[type] > 0 && multipliers[type] < 1)
      .map((type) => ({ type, multiplier: multipliers[type] })),
    immunities: DEFENSIVE_TYPES.filter((type) => multipliers[type] === 0),
  };
}

function formatContext(pokemon, species, typeRelations) {
  const description = getEnglishValue(species.flavor_text_entries, "flavor_text")
    ?.replace(/[\n\f]/g, " ") ?? null;

  return {
    kind: "pokemon",
    source: "PokéAPI",
    sources: [
      `${POKEAPI_URL}/pokemon/${pokemon.id}`,
      `${POKEAPI_URL}/pokemon-species/${species.id}`,
      ...pokemon.types.map(({ type }) => `${POKEAPI_URL}/type/${type.name}`),
    ],
    pokemon: {
      id: pokemon.id,
      name: pokemon.name,
      species: species.name,
      category: getEnglishValue(species.genera, "genus"),
      description,
      types: pokemon.types.map(({ type }) => type.name),
      heightMeters: pokemon.height / 10,
      weightKilograms: pokemon.weight / 10,
      baseExperience: pokemon.base_experience,
      abilities: pokemon.abilities.map(({ ability, is_hidden: isHidden }) => ({
        name: ability.name,
        isHidden,
      })),
      baseStats: Object.fromEntries(
        pokemon.stats.map(({ base_stat: value, stat }) => [stat.name, value]),
      ),
      learnableMoveCount: pokemon.moves.length,
      generation: species.generation.name,
      habitat: species.habitat?.name ?? null,
      captureRate: species.capture_rate,
      baseHappiness: species.base_happiness,
      growthRate: species.growth_rate.name,
      eggGroups: species.egg_groups.map(({ name }) => name),
      isLegendary: species.is_legendary,
      isMythical: species.is_mythical,
      defensiveMatchups: calculateDefensiveMatchups(typeRelations),
    },
  };
}

export async function getPokemonGroundingContext(
  pokemonId,
  { fetchImpl = fetch, timeoutMs = 8_000, format = null, level = null } = {},
) {
  const cached = pokemonContextCache.get(pokemonId);
  if (cached?.expiresAt > Date.now()) return cached.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const pokemon = await fetchJson(
      `${POKEAPI_URL}/pokemon/${pokemonId}`,
      fetchImpl,
      controller.signal,
    );
    const speciesId = getSpeciesId(pokemon);
    const [species, ...typeData] = await Promise.all([
      fetchJson(
        `${POKEAPI_URL}/pokemon-species/${speciesId}`,
        fetchImpl,
        controller.signal,
      ),
      ...pokemon.types.map(({ type }) =>
        fetchJson(`${POKEAPI_URL}/type/${type.name}`, fetchImpl, controller.signal),
      ),
    ]);
    const value = formatContext(
      pokemon,
      species,
      typeData.map(({ damage_relations: relations }) => relations),
    );
    if (format && Number.isInteger(level)) {
      value.pokemon.legalMoves = buildLegalMoves(pokemon, format, level);
    }

    pokemonContextCache.set(pokemonId, {
      value,
      expiresAt: Date.now() + CACHE_TTL,
    });
    return value;
  } catch (error) {
    if (error instanceof PokemonContextError) throw error;
    if (error?.name === "AbortError") {
      throw new PokemonContextError(
        "PokéAPI took too long to respond.",
        "POKEMON_CONTEXT_TIMEOUT",
        504,
      );
    }
    throw new PokemonContextError("PokéAPI data is temporarily unavailable.");
  } finally {
    clearTimeout(timeout);
  }
}
