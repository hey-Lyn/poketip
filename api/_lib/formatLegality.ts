import { Dex } from "@pkmn/dex";

const ILLEGAL_TIERS = new Set(["Illegal", "Unreleased"]);

function sharedMonotype(typesByMember) {
  if (!typesByMember.length) return [];
  return typesByMember.reduce(
    (shared, types) => shared.filter((type) => types.includes(type)),
    [...typesByMember[0]],
  );
}

function tierForFormat(species, format) {
  if (format === "gen9-doubles") return species.doublesTier;
  if (format === "national-dex") return species.natDexTier;
  return species.tier;
}

function isTierAllowed(tier, format) {
  if (ILLEGAL_TIERS.has(tier)) return false;
  if (format === "anything-goes" || format === "gen9-monotype") return true;
  if (format === "gen9-ubers") return tier !== "AG";
  if (format === "gen9-doubles") return tier !== "DUber";
  return tier !== "Uber" && tier !== "AG";
}

export function verifyPokemonFormat(pokemon, format, teamTypes = []) {
  const species = Dex.species.get(pokemon.name);
  const tier = tierForFormat(species, format) || "Unreleased";
  const reasons = [];
  let eligible = species.exists && isTierAllowed(tier, format);

  if (!species.exists || ILLEGAL_TIERS.has(tier)) {
    reasons.push("This Pokémon is unavailable in the selected generation.");
  } else if (!eligible) {
    reasons.push(`Its ${tier} classification is not allowed in this format.`);
  }

  if (format === "gen9-monotype") {
    const teamType = sharedMonotype(teamTypes);
    if (teamType.length && !pokemon.types.some((type) => teamType.includes(type))) {
      eligible = false;
      reasons.push(`It does not share the team's Monotype type: ${teamType.join(" / ")}.`);
    } else if (teamType.length) {
      reasons.push(`It is compatible with the team's Monotype type: ${teamType.join(" / ")}.`);
    } else {
      reasons.push("The team has no established Monotype identity yet.");
    }
  }

  return {
    eligible,
    tier,
    format,
    reasons,
  };
}
