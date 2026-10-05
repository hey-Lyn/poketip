import { getCompetitiveFormat } from "./competitiveFormats";
export { COMPETITIVE_FORMATS, DEFAULT_COMPETITIVE_FORMAT, getCompetitiveFormat } from "./competitiveFormats";

const SHOWDOWN_FORMAT_DATA_URL =
  "https://play.pokemonshowdown.com/data/formats-data.js";
let formatDataRequest;
const competitiveStatsRequests = new Map();

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

function findTierEntry(
  formatData: string,
  pokemonName: string,
): { tier?: string; doublesTier?: string; natDexTier?: string } | null {
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

  return (species as Record<string, string | undefined>)[format.tierField] || "Unranked";
}

function normalizePokemonName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function topEntries(values: Record<string, number> = {}, limit = 5) {
  return Object.entries(values)
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .sort(([, first], [, second]) => second - first)
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }));
}

function getNatures(spreads: Record<string, number> = {}) {
  const totals: Record<string, number> = {};

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

function getSpreads(spreads: Record<string, number> = {}) {
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

function getCounters(counters: any = {}) {
  return Object.entries(counters as Record<string, number[]>)
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
      ) as Record<string, number>,
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
