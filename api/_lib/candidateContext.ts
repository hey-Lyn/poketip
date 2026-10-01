import { getPokemonGroundingContext } from "./pokemonContext";
import { getCompetitiveTeamContext } from "./competitiveContext";
import { getCampaignObtainableNames } from "./teamEdit";
import { verifyPokemonFormat } from "./formatLegality";

const MAX_CANDIDATES = 3;

function uniqueNames(names) {
  if (!Array.isArray(names)) return [];

  return [...new Set(names
    .filter((name) => typeof name === "string")
    .map((name) => name.trim().toLowerCase())
    .filter((name) => /^[a-z0-9-]{1,80}$/.test(name)))].slice(0, MAX_CANDIDATES);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function campaignEligibility(pokemon, campaign) {
  const obtainable = getCampaignObtainableNames(campaign.gameId, campaign.milestoneId);
  const speciesName = slug(pokemon.species ?? pokemon.name);
  const eligible = obtainable.has(speciesName);

  return {
    eligible,
    campaign: true,
    reasons: eligible
      ? []
      : ["This Pokémon is not obtainable before the selected campaign milestone."],
  };
}

export function readCandidateNames(answer) {
  const json = String(answer ?? "").match(/\{[\s\S]*\}/)?.[0];
  if (!json) return [];

  try {
    return uniqueNames(JSON.parse(json).candidates);
  } catch {
    return [];
  }
}

export async function getCandidateGroundingContext(
  candidates,
  format,
  {
    fetchImpl = fetch as any,
    competitiveFetchImpl = fetch as any,
    teamTypes = [],
    campaign = null,
    level = 100,
  } = {},
) {
  const names = uniqueNames(candidates);
  if (!names.length) return null;

  const resolved = await Promise.allSettled(
    names.map((name) => getPokemonGroundingContext(name, {
      fetchImpl,
      ...(campaign ? { format, level } : {}),
    })),
  );
  const pokemon = resolved.flatMap((result) => {
    if (result.status !== "fulfilled") return [];
    const value = result.value;
    return [{
      ...value.pokemon,
      formatEligibility: campaign
        ? campaignEligibility(value.pokemon, campaign)
        : verifyPokemonFormat(value.pokemon, format, teamTypes),
    }];
  });
  if (!pokemon.length) return null;

  const competitive = await getCompetitiveTeamContext(
    format,
    pokemon.map(({ name }) => name),
    { fetchImpl: competitiveFetchImpl },
  );

  return {
    kind: "verified-recommendation-candidates",
    source: competitive
      ? "PokéAPI and Pokémon Showdown usage statistics"
      : "PokéAPI",
    candidates: pokemon,
    competitive,
    sources: [...new Set([
      ...pokemon.flatMap((entry) => [
        `${"https://pokeapi.co/api/v2"}/pokemon/${entry.id}`,
        `${"https://pokeapi.co/api/v2"}/pokemon-species/${entry.id}`,
      ]),
      ...(competitive?.source ? [competitive.source] : []),
    ])],
  };
}
