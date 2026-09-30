const API_URL = "https://pokeapi.co/api/v2";
let pokemonSpeciesIndexPromise;
const pokemonCache = new Map();
const speciesCache = new Map();
const pageCache = new Map();
const typeCache = new Map();
const moveCache = new Map();
const encounterCache = new Map();

const DEFENSIVE_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

function createAbortError() {
  return new DOMException("The request was aborted.", "AbortError");
}

function readCache(cache, key, loader) {
  if (!cache.has(key)) {
    const request = loader().catch((error) => {
      cache.delete(key);
      throw error;
    });
    cache.set(key, request);
  }

  return cache.get(key);
}

function waitForRequest(request, signal) {
  if (!signal) return request;
  if (signal.aborted) return Promise.reject(createAbortError());

  return new Promise((resolve, reject) => {
    const handleAbort = () => reject(createAbortError());
    signal.addEventListener("abort", handleAbort, { once: true });

    request.then(
      (value) => {
        signal.removeEventListener("abort", handleAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", handleAbort);
        reject(error);
      },
    );
  });
}

function formatPokemon(detail) {
  const speciesId = Number(detail.species?.url.split("/").filter(Boolean).at(-1));

  return {
    id: detail.id,
    name: detail.name,
    speciesId: Number.isFinite(speciesId) ? speciesId : detail.id,
    speciesName: detail.species?.name ?? detail.name,
    artwork:
      detail.sprites.other["official-artwork"].front_default ??
      detail.sprites.front_default,
    sprite:
      detail.sprites.front_default ??
      detail.sprites.other["official-artwork"].front_default,
    types: detail.types.map(({ type }) => type.name),
    height: detail.height / 10,
    weight: detail.weight / 10,
    baseExperience: detail.base_experience,
    abilities: detail.abilities.map(({ ability, is_hidden: isHidden }) => ({
      name: ability.name,
      isHidden,
    })),
    cry: detail.cries?.latest ?? detail.cries?.legacy ?? null,
    moves: detail.moves.map(({ move, version_group_details: versionDetails }) => ({
      name: move.name,
      versions: versionDetails.map((version) => ({
        level: version.level_learned_at,
        method: version.move_learn_method.name,
        versionGroup: version.version_group.name,
      })),
    })),
    stats: detail.stats.map(({ base_stat: value, stat }) => ({
      name: stat.name,
      value,
    })),
  };
}

function fetchPokemon(url, signal) {
  const request = readCache(pokemonCache, url, async () => {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("Unable to load Pokémon details.");
    }

    return formatPokemon(await response.json());
  });

  return waitForRequest(request, signal);
}

export function getPokemonById(id, signal) {
  return fetchPokemon(`${API_URL}/pokemon/${id}`, signal);
}

export async function getPokemonPage(limit = 20, offset = 0, signal) {
  const pageUrl = `${API_URL}/pokemon-species?limit=${limit}&offset=${offset}`;
  const pageRequest = readCache(pageCache, pageUrl, async () => {
    const response = await fetch(pageUrl);

    if (!response.ok) {
      throw new Error("Unable to load Pokémon.");
    }

    return response.json();
  });
  const data = await waitForRequest(pageRequest, signal);
  const pokemon = await Promise.all(
    data.results.map(({ url }) => {
      const id = url.split("/").filter(Boolean).at(-1);
      return fetchPokemon(`${API_URL}/pokemon/${id}`, signal);
    }),
  );

  return {
    pokemon,
    count: data.count,
  };
}

async function getPokemonIndex() {
  if (!pokemonSpeciesIndexPromise) {
    pokemonSpeciesIndexPromise = fetch(`${API_URL}/pokemon-species?limit=100000`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to load the Pokémon index.");
        }

        return response.json();
      })
      .then((data) => data.results)
      .catch((error) => {
        pokemonSpeciesIndexPromise = undefined;
        throw error;
      });
  }

  return pokemonSpeciesIndexPromise;
}

export async function searchPokemon(
  query,
  limit = 20,
  signal,
  firstId = 1,
  lastId = Infinity,
) {
  const index = await getPokemonIndex();

  if (signal?.aborted) {
    throw new DOMException("The request was aborted.", "AbortError");
  }

  const matches = index
    .filter(({ name, url }) => {
      const id = Number(url.split("/").filter(Boolean).at(-1));
      const isInRegion = id >= firstId && id <= lastId;
      return isInRegion && (name.includes(query) || String(id) === query);
    })
    .sort((first, second) => {
      const firstStartsWith = first.name.startsWith(query);
      const secondStartsWith = second.name.startsWith(query);
      return Number(secondStartsWith) - Number(firstStartsWith);
    });

  const pokemon = await Promise.all(
    matches
      .slice(0, limit)
      .map(({ url }) => {
        const id = url.split("/").filter(Boolean).at(-1);
        return fetchPokemon(`${API_URL}/pokemon/${id}`, signal);
      }),
  );

  return {
    pokemon,
    count: matches.length,
  };
}

export async function getPokemonSpeciesDetails(id, signal) {
  const request = readCache(speciesCache, String(id), async () => {
    const response = await fetch(`${API_URL}/pokemon-species/${id}`);

    if (!response.ok) {
      throw new Error("Unable to load the Pokémon description.");
    }

    const data = await response.json();
    const englishEntry = data.flavor_text_entries.find(
      ({ language }) => language.name === "en",
    );
    const englishGenus = data.genera.find(
      ({ language }) => language.name === "en",
    );

    return {
      name: data.name,
      description: englishEntry?.flavor_text.replace(/[\n\f]/g, " ") ??
        "No description is available.",
      category: englishGenus?.genus ?? "Unknown Pokémon",
      generation: data.generation.name,
      habitat: data.habitat?.name ?? "unknown",
      captureRate: data.capture_rate,
      baseHappiness: data.base_happiness,
      growthRate: data.growth_rate.name,
      eggGroups: data.egg_groups.map(({ name }) => name),
      isLegendary: data.is_legendary,
      isMythical: data.is_mythical,
      genderRate: data.gender_rate,
      varieties: data.varieties.map(({ is_default: isDefault, pokemon }) => ({
        id: Number(pokemon.url.split("/").filter(Boolean).at(-1)),
        name: pokemon.name,
        isDefault,
      })),
    };
  });

  return waitForRequest(request, signal);
}

export async function getPokemonDescription(id, signal) {
  const species = await getPokemonSpeciesDetails(id, signal);
  return species.description;
}

async function getTypeDamageRelations(type, signal) {
  const request = readCache(typeCache, type, async () => {
    const response = await fetch(`${API_URL}/type/${type}`);

    if (!response.ok) {
      throw new Error("Unable to load type effectiveness.");
    }

    const data = await response.json();
    return data.damage_relations;
  });

  return waitForRequest(request, signal);
}

export async function getPokemonTypeEffectiveness(types, signal) {
  const relations = await Promise.all(
    types.map((type) => getTypeDamageRelations(type, signal)),
  );
  const multipliers = Object.fromEntries(
    DEFENSIVE_TYPES.map((type) => [type, 1]),
  );

  relations.forEach((relation) => {
    relation.double_damage_from.forEach(({ name }) => {
      if (name in multipliers) multipliers[name] *= 2;
    });
    relation.half_damage_from.forEach(({ name }) => {
      if (name in multipliers) multipliers[name] *= 0.5;
    });
    relation.no_damage_from.forEach(({ name }) => {
      if (name in multipliers) multipliers[name] = 0;
    });
  });

  return DEFENSIVE_TYPES.map((type) => ({
    type,
    multiplier: multipliers[type],
  }));
}

export function getMoveType(name, signal) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const request = readCache(moveCache, slug, async () => {
    const response = await fetch(`${API_URL}/move/${slug}`);

    if (!response.ok) {
      throw new Error("Unable to load move details.");
    }

    const data = await response.json();
    return data.type.name;
  });

  return waitForRequest(request, signal);
}

export function getPokemonEncounters(id, signal) {
  const request = readCache(encounterCache, String(id), async () => {
    const response = await fetch(`${API_URL}/pokemon/${id}/encounters`);

    if (!response.ok) {
      throw new Error("Unable to load Pokémon locations.");
    }

    const data = await response.json();
    return data.flatMap(({ location_area: locationArea, version_details: versions }) =>
      versions.flatMap(({ version, encounter_details: details }) =>
        details.map((detail) => ({
          location: locationArea.name,
          version: version.name,
          method: detail.method.name,
          minLevel: detail.min_level,
          maxLevel: detail.max_level,
          chance: detail.chance,
          conditions: detail.condition_values.map(({ name }) => name),
        })),
      ),
    );
  });

  return waitForRequest(request, signal);
}
