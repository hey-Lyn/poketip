export const pikachu = {
  id: 25,
  name: "pikachu",
  artwork: "pikachu-artwork.png",
  sprite: "pikachu-sprite.png",
  types: ["electric"],
  height: 0.4,
  weight: 6,
  baseExperience: 112,
  abilities: [
    { name: "static", isHidden: false },
    { name: "lightning-rod", isHidden: true },
  ],
  cry: "pikachu.ogg",
  stats: [
    { name: "hp", value: 35 },
    { name: "special-attack", value: 50 },
  ],
  moves: [
    {
      name: "thunder-shock",
      versions: [
        { level: 5, method: "level-up", versionGroup: "scarlet-violet" },
      ],
    },
    {
      name: "thunderbolt",
      versions: [
        { level: 0, method: "machine", versionGroup: "scarlet-violet" },
      ],
    },
  ],
};

export const pikachuSpecies = {
  name: "pikachu",
  description: "It stores electricity in its cheeks.",
  category: "Mouse Pokémon",
  generation: "generation-i",
  habitat: "forest",
  captureRate: 190,
  baseHappiness: 50,
  growthRate: "medium",
  eggGroups: ["field", "fairy"],
  isLegendary: false,
  isMythical: false,
};
