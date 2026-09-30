export const POKEMON_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice",
  "fighting", "poison", "ground", "flying", "psychic", "bug",
  "rock", "ghost", "dragon", "dark", "steel", "fairy",
];

const TYPE_MATCHUPS = {
  normal: { strong: [], resisted: ["rock", "steel"], immune: ["ghost"] },
  fire: { strong: ["grass", "ice", "bug", "steel"], resisted: ["fire", "water", "rock", "dragon"] },
  water: { strong: ["fire", "ground", "rock"], resisted: ["water", "grass", "dragon"] },
  electric: { strong: ["water", "flying"], resisted: ["electric", "grass", "dragon"], immune: ["ground"] },
  grass: { strong: ["water", "ground", "rock"], resisted: ["fire", "grass", "poison", "flying", "bug", "dragon", "steel"] },
  ice: { strong: ["grass", "ground", "flying", "dragon"], resisted: ["fire", "water", "ice", "steel"] },
  fighting: { strong: ["normal", "ice", "rock", "dark", "steel"], resisted: ["poison", "flying", "psychic", "bug", "fairy"], immune: ["ghost"] },
  poison: { strong: ["grass", "fairy"], resisted: ["poison", "ground", "rock", "ghost"], immune: ["steel"] },
  ground: { strong: ["fire", "electric", "poison", "rock", "steel"], resisted: ["grass", "bug"], immune: ["flying"] },
  flying: { strong: ["grass", "fighting", "bug"], resisted: ["electric", "rock", "steel"] },
  psychic: { strong: ["fighting", "poison"], resisted: ["psychic", "steel"], immune: ["dark"] },
  bug: { strong: ["grass", "psychic", "dark"], resisted: ["fire", "fighting", "poison", "flying", "ghost", "steel", "fairy"] },
  rock: { strong: ["fire", "ice", "flying", "bug"], resisted: ["fighting", "ground", "steel"] },
  ghost: { strong: ["psychic", "ghost"], resisted: ["dark"], immune: ["normal"] },
  dragon: { strong: ["dragon"], resisted: ["steel"], immune: ["fairy"] },
  dark: { strong: ["psychic", "ghost"], resisted: ["fighting", "dark", "fairy"] },
  steel: { strong: ["ice", "rock", "fairy"], resisted: ["fire", "water", "electric", "steel"] },
  fairy: { strong: ["fighting", "dragon", "dark"], resisted: ["fire", "poison", "steel"] },
};

export function getDefensiveMultiplier(attackingType, defendingTypes) {
  const matchup = TYPE_MATCHUPS[attackingType];
  if (!matchup) return 1;

  return defendingTypes.reduce((multiplier, defendingType) => {
    if (matchup.immune?.includes(defendingType)) return 0;
    if (matchup.strong.includes(defendingType)) return multiplier * 2;
    if (matchup.resisted.includes(defendingType)) return multiplier * 0.5;
    return multiplier;
  }, 1);
}

export function analyzeTeamDefense(team) {
  const matchups = POKEMON_TYPES.map((type) => {
    const multipliers = team.map((member) =>
      getDefensiveMultiplier(type, member.types ?? []),
    );

    return {
      type,
      weakCount: multipliers.filter((value) => value > 1).length,
      resistCount: multipliers.filter((value) => value > 0 && value < 1).length,
      immuneCount: multipliers.filter((value) => value === 0).length,
      highestMultiplier: Math.max(1, ...multipliers),
    };
  });

  return {
    sharedWeaknesses: matchups
      .filter(({ weakCount }) => weakCount >= 2)
      .sort((first, second) =>
        second.weakCount - first.weakCount ||
        second.highestMultiplier - first.highestMultiplier,
      ),
    resistances: matchups
      .filter(({ resistCount, immuneCount }) => resistCount + immuneCount >= 2)
      .sort((first, second) =>
        (second.resistCount + second.immuneCount) -
        (first.resistCount + first.immuneCount),
      ),
  };
}

export function analyzeOffensiveCoverage(moveTypes) {
  const selectedTypes = [...new Set(moveTypes.filter((type) => TYPE_MATCHUPS[type]))];
  const coveredTypes = POKEMON_TYPES.filter((defendingType) =>
    selectedTypes.some((attackingType) =>
      TYPE_MATCHUPS[attackingType].strong.includes(defendingType),
    ),
  );

  return {
    moveTypes: selectedTypes,
    coveredTypes,
    missingTypes: POKEMON_TYPES.filter((type) => !coveredTypes.includes(type)),
  };
}
