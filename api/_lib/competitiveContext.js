const FORMAT_STATS_IDS = {
  "gen9-singles": "gen9ou",
  "gen9-doubles": "gen9doublesou",
  "national-dex": "gen9nationaldex",
  "anything-goes": "gen9anythinggoes",
  "gen9-ubers": "gen9ubers",
  "gen9-monotype": "gen9monotype",
};
const CACHE_TTL = 6 * 60 * 60 * 1_000;
const datasetCache = new Map();

function normalizeName(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function topEntries(values = {}, limit = 4) {
  return Object.entries(values)
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .sort(([, first], [, second]) => second - first)
    .slice(0, limit)
    .map(([name, value]) => ({ name, value }));
}

function topNatures(spreads = {}) {
  const totals = {};
  Object.entries(spreads).forEach(([spread, value]) => {
    const nature = spread.split(":", 1)[0];
    totals[nature] = (totals[nature] ?? 0) + value;
  });
  return topEntries(totals, 3);
}

function topSpreads(spreads = {}) {
  return topEntries(spreads, 3).map(({ name, value }) => {
    const [nature, rawValues = ""] = name.split(":");
    const values = rawValues.split("/").map((entry) => Number(entry) || 0);
    return {
      nature,
      evs: Object.fromEntries(
        ["hp", "attack", "defense", "specialAttack", "specialDefense", "speed"]
          .map((stat, index) => [stat, values[index] ?? 0]),
      ),
      value,
    };
  });
}

function summarize(stats, battles) {
  if (!stats) return null;
  return {
    sampleBattles: battles ?? null,
    usage: stats.usage?.weighted ?? stats.usage?.raw ?? null,
    commonAbilities: topEntries(stats.abilities, 3),
    commonItems: topEntries(stats.items, 3),
    commonTeraTypes: topEntries(stats.teraTypes, 3),
    commonMoves: topEntries(
      Object.fromEntries(
        Object.entries(stats.moves ?? {}).filter(([name]) => name !== "Nothing"),
      ),
      6,
    ),
    commonNatures: topNatures(stats.spreads),
    commonEvSpreads: topSpreads(stats.spreads),
    commonTeammates: topEntries(stats.teammates, 4),
  };
}

function formatUsage(usage) {
  return Number.isFinite(usage) ? Math.round(usage * 1000) / 10 : null;
}

function summarizeThreat(name, stats, teamTypes) {
  const species = Dex.species.get(name);
  if (!species.exists || !teamTypes.length) return null;

  const types = species.types.map((type) => type.toLowerCase());
  const typePressure = types.map((type) => {
    const multipliers = teamTypes.map((memberTypes) =>
      getDefensiveMultiplier(type, memberTypes),
    );
    const weakMembers = multipliers.filter((value) => value > 1).length;
    const answers = multipliers.filter((value) => value === 0 || value < 1).length;
    return { type, weakMembers, answers, highestMultiplier: Math.max(...multipliers) };
  });
  const pressure = typePressure.reduce(
    (total, entry) => total + entry.weakMembers * 2 + (entry.answers === 0 ? 2 : 0),
    0,
  );
  if (!pressure) return null;

  const usage = stats.usage?.weighted ?? stats.usage?.raw ?? null;
  return {
    name,
    types,
    usagePercent: formatUsage(usage),
    commonMoves: topEntries(
      Object.fromEntries(
        Object.entries(stats.moves ?? {}).filter(([move]) => move !== "Nothing"),
      ),
      4,
    ),
    typePressure,
    risk: pressure >= 8 ? "high" : "moderate",
    score: pressure + (usage ?? 0) * 10,
  };
}

function getThreats(dataset, teamTypes) {
  if (!teamTypes.length) return [];

  return [...dataset.pokemon.entries()]
    .map(([name, stats]) => summarizeThreat(name, stats, teamTypes))
    .filter(Boolean)
    .sort((first, second) => second.score - first.score)
    .slice(0, 6)
    .map((threat) => {
      delete threat.score;
      return threat;
    });
}

async function loadDataset(format, fetchImpl, timeoutMs) {
  const statsId = FORMAT_STATS_IDS[format];
  if (!statsId) return null;
  const cached = datasetCache.get(statsId);
  if (cached?.expiresAt > Date.now()) return cached.value;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const source = `https://data.pkmn.cc/stats/${statsId}.json`;
  try {
    const response = await fetchImpl(source, { signal: controller.signal });
    if (!response.ok) return null;
    const raw = await response.json();
    const value = {
      source,
      battles: raw.battles,
      pokemon: new Map(
        Object.entries(raw.pokemon ?? {}).map(([name, stats]) => [
          normalizeName(name),
          stats,
        ]),
      ),
    };
    datasetCache.set(statsId, { value, expiresAt: Date.now() + CACHE_TTL });
    return value;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getCompetitiveTeamContext(
  format,
  pokemonNames,
  { fetchImpl = fetch, timeoutMs = 5_000, teamTypes = [] } = {},
) {
  const dataset = await loadDataset(format, fetchImpl, timeoutMs);
  if (!dataset) return null;

  return {
    source: dataset.source,
    format,
    members: pokemonNames.map((name) => ({
      name,
      stats: summarize(dataset.pokemon.get(normalizeName(name)), dataset.battles),
    })),
    threats: getThreats(dataset, teamTypes),
    threatMethod: "Ranks common format Pokémon by their native STAB types against the team's verified type chart. It does not calculate damage, items, abilities, Tera, or full movesets.",
  };
}

export function clearCompetitiveContextCache() {
  datasetCache.clear();
}
import { Dex } from "@pkmn/dex";
import { getDefensiveMultiplier } from "../../src/services/teamAnalysis.js";
