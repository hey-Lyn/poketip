const SHOWDOWN_FORMAT_DATA_URL =
  "https://play.pokemonshowdown.com/data/formats-data.js";
let formatDataRequest;
const competitiveStatsRequests = new Map();

export const COMPETITIVE_FORMATS = [
  {
    id: "gen9-singles",
    label: "Gen 9 Singles (OU)",
    tierField: "tier",
    statsId: "gen9ou",
  },
  {
    id: "gen9-doubles",
    label: "Gen 9 Doubles (OU)",
    tierField: "doublesTier",
    statsId: "gen9doublesou",
  },
  {
    id: "national-dex",
    label: "National Dex Singles (OU)",
    tierField: "natDexTier",
    statsId: "gen9nationaldex",
  },
  {
    id: "anything-goes",
    label: "Gen 9 Anything Goes",
    tierField: "tier",
    statsId: "gen9anythinggoes",
  },
  {
    id: "gen9-ubers",
    label: "Gen 9 Ubers",
    tierField: "tier",
    statsId: "gen9ubers",
  },
  {
    id: "gen9-monotype",
    label: "Gen 9 Monotype",
    tierField: "tier",
    statsId: "gen9monotype",
  },
];

export const DEFAULT_COMPETITIVE_FORMAT = COMPETITIVE_FORMATS[0].id;

export function getCompetitiveFormat(formatId) {
  return COMPETITIVE_FORMATS.find(({ id }) => id === formatId) ??
    COMPETITIVE_FORMATS[0];
}

function loadFormatData() {
  if (!formatDataRequest) {
    formatDataRequest = fetch(SHOWDOWN_FORMAT_DATA_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to load Pokémon Showdown tiers.");
        }

        return response.text();
      })
      .catch((error) => {
        formatDataRequest = undefined;
        throw error;
      });
  }

  return formatDataRequest;
}

function findTierEntry(formatData, pokemonName) {
  const showdownId = pokemonName.toLowerCase().replace(/[^a-z0-9]/g, "");
  const entry = formatData.match(
    new RegExp(`(?:^|[,{])${showdownId}:\\{([^}]*)\\}`),
  )?.[1];

  if (!entry) return null;

  return {
    tier: entry.match(/(?:^|,)tier:"([^"]+)"/)?.[1],
    doublesTier: entry.match(/(?:^|,)doublesTier:"([^"]+)"/)?.[1],
    natDexTier: entry.match(/(?:^|,)natDexTier:"([^"]+)"/)?.[1],
  };
}

export async function getShowdownTier(pokemonName, formatId) {
  const format = getCompetitiveFormat(formatId);
  const formatData = await loadFormatData();
  const species = findTierEntry(formatData, pokemonName);

  if (!species) return "Unranked";

  if (format.tierField === "doublesTier") {
    return species.doublesTier || species.tier || "Unranked";
  }

  return species[format.tierField] || "Unranked";
}

function normalizePokemonName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function topEntries(values = {}, limit = 5) {
  return Object.entries(values)
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .sort(([, first], [, second]) => second - first)
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }));
}

function getNatures(spreads = {}) {
  const totals = {};

  Object.entries(spreads).forEach(([spread, value]) => {
    const nature = spread.split(":", 1)[0];
    totals[nature] = (totals[nature] ?? 0) + value;
  });

  return topEntries(totals);
}

const STAT_LABELS = ["HP", "Atk", "Def", "SpA", "SpD", "Spe"];

function formatSpread(spread) {
  const [nature, values] = spread.split(":");

  if (!values) return spread;

  const evs = values
    .split("/")
    .map((value, index) => ({ label: STAT_LABELS[index], value: Number(value) }))
    .filter(({ value }) => value > 0)
    .map(({ label, value }) => `${value} ${label}`)
    .join(" / ");

  return evs ? `${nature} · ${evs}` : nature;
}

function getSpreads(spreads = {}) {
  return topEntries(spreads).map(({ name, value }) => {
    const [nature, values = ""] = name.split(":");
    const evs = Object.fromEntries(
      values.split("/").map((ev, index) => [
        ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"][index],
        Number(ev) || 0,
      ]),
    );

    return {
      name: formatSpread(name),
      value,
      nature,
      evs,
    };
  });
}

function getCounters(counters = {}) {
  return Object.entries(counters)
    .map(([name, values]) => ({
      name,
      sampleSize: values[0],
      value: values[1] + values[2],
    }))
    .filter(({ value }) => Number.isFinite(value) && value > 0)
    .sort((first, second) => second.value - first.value)
    .slice(0, 5);
}

function loadCompetitiveStats(format) {
  if (!competitiveStatsRequests.has(format.statsId)) {
    const request = fetch(
      `https://data.pkmn.cc/stats/${format.statsId}.json`,
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error("Unable to load competitive statistics.");
        }

        return response.json();
      })
      .then((data) => ({
        battles: data.battles,
        pokemon: new Map(
          Object.entries(data.pokemon).map(([name, stats]) => [
            normalizePokemonName(name),
            stats,
          ]),
        ),
      }))
      .catch((error) => {
        competitiveStatsRequests.delete(format.statsId);
        throw error;
      });

    competitiveStatsRequests.set(format.statsId, request);
  }

  return competitiveStatsRequests.get(format.statsId);
}

export async function getCompetitiveStats(pokemonNames, formatId) {
  const format = getCompetitiveFormat(formatId);
  const data = await loadCompetitiveStats(format);
  const candidates = Array.isArray(pokemonNames) ? pokemonNames : [pokemonNames];
  const stats = candidates
    .map((name) => data.pokemon.get(normalizePokemonName(name)))
    .find(Boolean);

  if (!stats) return null;

  return {
    battles: data.battles,
    usage: stats.usage?.weighted ?? stats.usage?.raw ?? 0,
    abilities: topEntries(stats.abilities),
    items: topEntries(stats.items),
    teraTypes: topEntries(stats.teraTypes),
    moves: topEntries(
      Object.fromEntries(
        Object.entries(stats.moves ?? {}).filter(([name]) => name !== "Nothing"),
      ),
      6,
    ),
    natures: getNatures(stats.spreads),
    spreads: getSpreads(stats.spreads),
    teammates: topEntries(stats.teammates),
    counters: getCounters(stats.counters),
  };
}

export function clearShowdownCache() {
  formatDataRequest = undefined;
  competitiveStatsRequests.clear();
}
