export const CAMPAIGN_GAMES = [
  { id: "emerald", label: "Pokémon Emerald", versionGroup: "emerald" },
  { id: "firered", label: "Pokémon Fire Red", versionGroup: "firered-leafgreen" },
];

const EARLY_HOENN_LOCATIONS = [
  "route-101", "route-102", "route-103", "route-104", "petalburg-woods",
  "route-116", "rusturf-tunnel",
];
const DEWFORD_LOCATIONS = [
  "route-105", "route-106", "route-107", "route-108", "route-109",
  "dewford-town", "granite-cave-1f", "granite-cave-b1f", "granite-cave-b2f",
];
const MAUVILLE_LOCATIONS = [
  "route-110", "route-111", "route-112", "route-113", "route-114",
  "route-117", "mauville-city", "verdanturf-town", "fiery-path",
  "route-118", "route-119",
];
const LAVARIDGE_LOCATIONS = ["jagged-pass", "meteor-falls-area", "lavaridge-town"];

export const EMERALD_MILESTONES = [
  {
    id: "before-roxanne",
    label: "Before Roxanne · Rustboro Gym",
    objective: "Gym Leader Roxanne",
    location: "Rustboro City",
    recommendedLevel: 12,
    recommendedRange: [10, 15],
    availableLocations: EARLY_HOENN_LOCATIONS,
    trainers: [{
      name: "Roxanne",
      specialty: "Rock",
      pokemon: [
        { name: "geodude", level: 12 },
        { name: "geodude", level: 12 },
        { name: "nosepass", level: 15 },
      ],
    }],
  },
  {
    id: "before-brawly",
    label: "Before Brawly · Dewford Gym",
    objective: "Gym Leader Brawly",
    location: "Dewford Town",
    recommendedLevel: 16,
    recommendedRange: [14, 19],
    availableLocations: [...EARLY_HOENN_LOCATIONS, ...DEWFORD_LOCATIONS],
    trainers: [{
      name: "Brawly",
      specialty: "Fighting",
      pokemon: [
        { name: "machop", level: 16 },
        { name: "meditite", level: 16 },
        { name: "makuhita", level: 19 },
      ],
    }],
  },
  {
    id: "before-wattson",
    label: "Before Wattson · Mauville Gym",
    objective: "Gym Leader Wattson",
    location: "Mauville City",
    recommendedLevel: 22,
    recommendedRange: [20, 24],
    availableLocations: [
      ...EARLY_HOENN_LOCATIONS, ...DEWFORD_LOCATIONS, ...MAUVILLE_LOCATIONS,
    ],
    trainers: [{
      name: "Wattson",
      specialty: "Electric",
      pokemon: [
        { name: "magnemite", level: 20 },
        { name: "voltorb", level: 20 },
        { name: "magneton", level: 22 },
        { name: "manectric", level: 24 },
      ],
    }],
  },
  {
    id: "before-flannery",
    label: "Before Flannery · Lavaridge Gym",
    objective: "Gym Leader Flannery",
    location: "Lavaridge Town",
    recommendedLevel: 26,
    recommendedRange: [24, 29],
    availableLocations: [
      ...EARLY_HOENN_LOCATIONS, ...DEWFORD_LOCATIONS, ...MAUVILLE_LOCATIONS,
      ...LAVARIDGE_LOCATIONS,
    ],
    trainers: [{
      name: "Flannery",
      specialty: "Fire",
      pokemon: [
        { name: "numel", level: 24 },
        { name: "slugma", level: 24 },
        { name: "camerupt", level: 26 },
        { name: "torkoal", level: 29 },
      ],
    }],
  },
];

const BROCK_LOCATIONS = [
  "kanto-route-1-area", "kanto-route-2-south-towards-viridian-city",
  "kanto-route-22-area", "viridian-forest-area",
];
const MISTY_LOCATIONS = [
  "kanto-route-3-area", "kanto-route-4-area", "mt-moon-1f", "mt-moon-b1f",
  "mt-moon-b2f", "kanto-route-24-area", "kanto-route-25-area",
];
const LT_SURGE_LOCATIONS = [
  "kanto-route-5-area", "kanto-route-6-area", "kanto-route-11-area",
  "digletts-cave-area", "kanto-route-9-area", "kanto-route-10-area",
  "rock-tunnel-1f", "rock-tunnel-b1f",
];
const ERIKA_LOCATIONS = [
  "kanto-route-7-area", "kanto-route-8-area", "kanto-route-12-area",
  "kanto-route-13-area",
];

export const FIRERED_MILESTONES = [
  {
    id: "before-brock",
    label: "Before Brock · Pewter Gym",
    objective: "Gym Leader Brock",
    location: "Pewter City",
    recommendedLevel: 10,
    recommendedRange: [8, 12],
    availableLocations: BROCK_LOCATIONS,
    trainers: [{
      name: "Brock",
      specialty: "Rock",
      pokemon: [
        { name: "geodude", level: 10 },
        { name: "onix", level: 12 },
      ],
    }],
  },
  {
    id: "before-misty",
    label: "Before Misty · Cerulean Gym",
    objective: "Gym Leader Misty",
    location: "Cerulean City",
    recommendedLevel: 18,
    recommendedRange: [16, 21],
    availableLocations: [...BROCK_LOCATIONS, ...MISTY_LOCATIONS],
    trainers: [{
      name: "Misty",
      specialty: "Water",
      pokemon: [
        { name: "staryu", level: 18 },
        { name: "starmie", level: 21 },
      ],
    }],
  },
  {
    id: "before-lt-surge",
    label: "Before Lt. Surge · Vermilion Gym",
    objective: "Gym Leader Lt. Surge",
    location: "Vermilion City",
    recommendedLevel: 22,
    recommendedRange: [20, 24],
    availableLocations: [...BROCK_LOCATIONS, ...MISTY_LOCATIONS, ...LT_SURGE_LOCATIONS],
    trainers: [{
      name: "Lt. Surge",
      specialty: "Electric",
      pokemon: [
        { name: "voltorb", level: 21 },
        { name: "pikachu", level: 18 },
        { name: "raichu", level: 24 },
      ],
    }],
  },
  {
    id: "before-erika",
    label: "Before Erika · Celadon Gym",
    objective: "Gym Leader Erika",
    location: "Celadon City",
    recommendedLevel: 28,
    recommendedRange: [26, 30],
    availableLocations: [
      ...BROCK_LOCATIONS, ...MISTY_LOCATIONS, ...LT_SURGE_LOCATIONS, ...ERIKA_LOCATIONS,
    ],
    trainers: [{
      name: "Erika",
      specialty: "Grass",
      pokemon: [
        { name: "victreebel", level: 29 },
        { name: "tangela", level: 24 },
        { name: "vileplume", level: 29 },
      ],
    }],
  },
];

export const EMERALD_LOCATION_LABELS = {
  "route-101": "Route 101",
  "route-102": "Route 102",
  "route-103": "Route 103",
  "route-104": "Route 104",
  "petalburg-woods": "Petalburg Woods",
  "route-116": "Route 116",
  "rusturf-tunnel": "Rusturf Tunnel",
  "route-105": "Route 105",
  "route-106": "Route 106",
  "route-107": "Route 107",
  "route-108": "Route 108",
  "route-109": "Route 109",
  "dewford-town": "Dewford Town",
  "granite-cave-1f": "Granite Cave 1F",
  "granite-cave-b1f": "Granite Cave B1F",
  "granite-cave-b2f": "Granite Cave B2F",
  "route-110": "Route 110",
  "route-111": "Route 111",
  "route-112": "Route 112",
  "route-113": "Route 113",
  "route-114": "Route 114",
  "route-117": "Route 117",
  "mauville-city": "Mauville City",
  "verdanturf-town": "Verdanturf Town",
  "fiery-path": "Fiery Path",
  "route-118": "Route 118",
  "route-119": "Route 119",
  "jagged-pass": "Jagged Pass",
  "meteor-falls-area": "Meteor Falls",
  "lavaridge-town": "Lavaridge Town",
};

export const EMERALD_METHOD_LABELS = {
  walk: "Tall grass",
  "rock-smash": "Rock Smash",
};

export const FIRERED_LOCATION_LABELS = {
  "kanto-route-1-area": "Route 1",
  "kanto-route-2-south-towards-viridian-city": "Route 2",
  "kanto-route-22-area": "Route 22",
  "viridian-forest-area": "Viridian Forest",
  "kanto-route-3-area": "Route 3",
  "kanto-route-4-area": "Route 4",
  "mt-moon-1f": "Mt. Moon 1F",
  "mt-moon-b1f": "Mt. Moon B1F",
  "mt-moon-b2f": "Mt. Moon B2F",
  "kanto-route-24-area": "Route 24",
  "kanto-route-25-area": "Route 25",
  "kanto-route-5-area": "Route 5",
  "kanto-route-6-area": "Route 6",
  "kanto-route-11-area": "Route 11",
  "digletts-cave-area": "Diglett's Cave",
  "kanto-route-9-area": "Route 9",
  "kanto-route-10-area": "Route 10",
  "rock-tunnel-1f": "Rock Tunnel 1F",
  "rock-tunnel-b1f": "Rock Tunnel B1F",
  "kanto-route-7-area": "Route 7",
  "kanto-route-8-area": "Route 8",
  "kanto-route-12-area": "Route 12",
  "kanto-route-13-area": "Route 13",
};

// Curated Fire Red wild encounters, verified against PokéAPI
// (pokemon/{id}/encounters, version "firered"). Only methods that need no
// special item are listed: walking through tall grass and Rock Smash.
export const FIRERED_ENCOUNTERS = [
  { name: "pidgey", location: "kanto-route-1-area", method: "walk", minLevel: 2, maxLevel: 5 },
  { name: "rattata", location: "kanto-route-1-area", method: "walk", minLevel: 2, maxLevel: 4 },
  { name: "pidgey", location: "kanto-route-2-south-towards-viridian-city", method: "walk", minLevel: 2, maxLevel: 5 },
  { name: "rattata", location: "kanto-route-2-south-towards-viridian-city", method: "walk", minLevel: 2, maxLevel: 5 },
  { name: "caterpie", location: "kanto-route-2-south-towards-viridian-city", method: "walk", minLevel: 4, maxLevel: 5 },
  { name: "weedle", location: "kanto-route-2-south-towards-viridian-city", method: "walk", minLevel: 4, maxLevel: 5 },
  { name: "rattata", location: "kanto-route-22-area", method: "walk", minLevel: 2, maxLevel: 5 },
  { name: "spearow", location: "kanto-route-22-area", method: "walk", minLevel: 3, maxLevel: 5 },
  { name: "mankey", location: "kanto-route-22-area", method: "walk", minLevel: 2, maxLevel: 5 },
  { name: "caterpie", location: "viridian-forest-area", method: "walk", minLevel: 3, maxLevel: 5 },
  { name: "metapod", location: "viridian-forest-area", method: "walk", minLevel: 5, maxLevel: 5 },
  { name: "weedle", location: "viridian-forest-area", method: "walk", minLevel: 3, maxLevel: 5 },
  { name: "kakuna", location: "viridian-forest-area", method: "walk", minLevel: 4, maxLevel: 6 },
  { name: "pikachu", location: "viridian-forest-area", method: "walk", minLevel: 3, maxLevel: 5 },
  { name: "pidgey", location: "kanto-route-3-area", method: "walk", minLevel: 6, maxLevel: 7 },
  { name: "spearow", location: "kanto-route-3-area", method: "walk", minLevel: 6, maxLevel: 8 },
  { name: "nidoran-f", location: "kanto-route-3-area", method: "walk", minLevel: 6, maxLevel: 6 },
  { name: "nidoran-m", location: "kanto-route-3-area", method: "walk", minLevel: 6, maxLevel: 7 },
  { name: "jigglypuff", location: "kanto-route-3-area", method: "walk", minLevel: 3, maxLevel: 7 },
  { name: "mankey", location: "kanto-route-3-area", method: "walk", minLevel: 7, maxLevel: 7 },
  { name: "rattata", location: "kanto-route-4-area", method: "walk", minLevel: 8, maxLevel: 12 },
  { name: "spearow", location: "kanto-route-4-area", method: "walk", minLevel: 8, maxLevel: 12 },
  { name: "ekans", location: "kanto-route-4-area", method: "walk", minLevel: 6, maxLevel: 12 },
  { name: "mankey", location: "kanto-route-4-area", method: "walk", minLevel: 10, maxLevel: 12 },
  { name: "zubat", location: "mt-moon-1f", method: "walk", minLevel: 7, maxLevel: 10 },
  { name: "geodude", location: "mt-moon-1f", method: "walk", minLevel: 7, maxLevel: 9 },
  { name: "paras", location: "mt-moon-1f", method: "walk", minLevel: 8, maxLevel: 8 },
  { name: "clefairy", location: "mt-moon-1f", method: "walk", minLevel: 8, maxLevel: 8 },
  { name: "paras", location: "mt-moon-b1f", method: "walk", minLevel: 5, maxLevel: 10 },
  { name: "zubat", location: "mt-moon-b2f", method: "walk", minLevel: 8, maxLevel: 11 },
  { name: "geodude", location: "mt-moon-b2f", method: "walk", minLevel: 9, maxLevel: 10 },
  { name: "paras", location: "mt-moon-b2f", method: "walk", minLevel: 10, maxLevel: 12 },
  { name: "clefairy", location: "mt-moon-b2f", method: "walk", minLevel: 10, maxLevel: 12 },
  { name: "pidgey", location: "kanto-route-24-area", method: "walk", minLevel: 11, maxLevel: 13 },
  { name: "caterpie", location: "kanto-route-24-area", method: "walk", minLevel: 7, maxLevel: 7 },
  { name: "metapod", location: "kanto-route-24-area", method: "walk", minLevel: 8, maxLevel: 8 },
  { name: "weedle", location: "kanto-route-24-area", method: "walk", minLevel: 7, maxLevel: 7 },
  { name: "kakuna", location: "kanto-route-24-area", method: "walk", minLevel: 8, maxLevel: 8 },
  { name: "oddish", location: "kanto-route-24-area", method: "walk", minLevel: 12, maxLevel: 14 },
  { name: "abra", location: "kanto-route-24-area", method: "walk", minLevel: 8, maxLevel: 12 },
  { name: "pidgey", location: "kanto-route-25-area", method: "walk", minLevel: 11, maxLevel: 13 },
  { name: "caterpie", location: "kanto-route-25-area", method: "walk", minLevel: 8, maxLevel: 8 },
  { name: "metapod", location: "kanto-route-25-area", method: "walk", minLevel: 9, maxLevel: 9 },
  { name: "weedle", location: "kanto-route-25-area", method: "walk", minLevel: 8, maxLevel: 8 },
  { name: "kakuna", location: "kanto-route-25-area", method: "walk", minLevel: 9, maxLevel: 9 },
  { name: "oddish", location: "kanto-route-25-area", method: "walk", minLevel: 12, maxLevel: 14 },
  { name: "abra", location: "kanto-route-25-area", method: "walk", minLevel: 9, maxLevel: 13 },
  { name: "pidgey", location: "kanto-route-5-area", method: "walk", minLevel: 13, maxLevel: 16 },
  { name: "oddish", location: "kanto-route-5-area", method: "walk", minLevel: 13, maxLevel: 16 },
  { name: "meowth", location: "kanto-route-5-area", method: "walk", minLevel: 10, maxLevel: 16 },
  { name: "pidgey", location: "kanto-route-6-area", method: "walk", minLevel: 13, maxLevel: 16 },
  { name: "oddish", location: "kanto-route-6-area", method: "walk", minLevel: 13, maxLevel: 16 },
  { name: "meowth", location: "kanto-route-6-area", method: "walk", minLevel: 10, maxLevel: 16 },
  { name: "spearow", location: "kanto-route-11-area", method: "walk", minLevel: 13, maxLevel: 17 },
  { name: "ekans", location: "kanto-route-11-area", method: "walk", minLevel: 12, maxLevel: 15 },
  { name: "drowzee", location: "kanto-route-11-area", method: "walk", minLevel: 11, maxLevel: 15 },
  { name: "diglett", location: "digletts-cave-area", method: "walk", minLevel: 15, maxLevel: 22 },
  { name: "dugtrio", location: "digletts-cave-area", method: "walk", minLevel: 29, maxLevel: 31 },
  { name: "rattata", location: "kanto-route-9-area", method: "walk", minLevel: 14, maxLevel: 17 },
  { name: "spearow", location: "kanto-route-9-area", method: "walk", minLevel: 13, maxLevel: 17 },
  { name: "ekans", location: "kanto-route-9-area", method: "walk", minLevel: 11, maxLevel: 17 },
  { name: "spearow", location: "kanto-route-10-area", method: "walk", minLevel: 13, maxLevel: 17 },
  { name: "ekans", location: "kanto-route-10-area", method: "walk", minLevel: 11, maxLevel: 17 },
  { name: "zubat", location: "rock-tunnel-1f", method: "walk", minLevel: 15, maxLevel: 16 },
  { name: "geodude", location: "rock-tunnel-1f", method: "walk", minLevel: 15, maxLevel: 17 },
  { name: "machop", location: "rock-tunnel-1f", method: "walk", minLevel: 16, maxLevel: 17 },
  { name: "mankey", location: "rock-tunnel-1f", method: "walk", minLevel: 16, maxLevel: 17 },
  { name: "zubat", location: "rock-tunnel-b1f", method: "walk", minLevel: 15, maxLevel: 16 },
  { name: "geodude", location: "rock-tunnel-b1f", method: "walk", minLevel: 15, maxLevel: 17 },
  { name: "geodude", location: "rock-tunnel-b1f", method: "rock-smash", minLevel: 5, maxLevel: 30 },
  { name: "graveler", location: "rock-tunnel-b1f", method: "rock-smash", minLevel: 25, maxLevel: 40 },
  { name: "machop", location: "rock-tunnel-b1f", method: "walk", minLevel: 17, maxLevel: 17 },
  { name: "mankey", location: "rock-tunnel-b1f", method: "walk", minLevel: 16, maxLevel: 17 },
  { name: "pidgey", location: "kanto-route-7-area", method: "walk", minLevel: 19, maxLevel: 22 },
  { name: "oddish", location: "kanto-route-7-area", method: "walk", minLevel: 19, maxLevel: 22 },
  { name: "meowth", location: "kanto-route-7-area", method: "walk", minLevel: 17, maxLevel: 20 },
  { name: "growlithe", location: "kanto-route-7-area", method: "walk", minLevel: 18, maxLevel: 20 },
  { name: "pidgey", location: "kanto-route-8-area", method: "walk", minLevel: 18, maxLevel: 20 },
  { name: "ekans", location: "kanto-route-8-area", method: "walk", minLevel: 17, maxLevel: 19 },
  { name: "meowth", location: "kanto-route-8-area", method: "walk", minLevel: 18, maxLevel: 20 },
  { name: "growlithe", location: "kanto-route-8-area", method: "walk", minLevel: 15, maxLevel: 18 },
  { name: "pidgey", location: "kanto-route-12-area", method: "walk", minLevel: 23, maxLevel: 27 },
  { name: "oddish", location: "kanto-route-12-area", method: "walk", minLevel: 22, maxLevel: 26 },
  { name: "gloom", location: "kanto-route-12-area", method: "walk", minLevel: 28, maxLevel: 30 },
  { name: "venonat", location: "kanto-route-12-area", method: "walk", minLevel: 24, maxLevel: 26 },
  { name: "pidgey", location: "kanto-route-13-area", method: "walk", minLevel: 25, maxLevel: 27 },
  { name: "pidgeotto", location: "kanto-route-13-area", method: "walk", minLevel: 29, maxLevel: 29 },
  { name: "oddish", location: "kanto-route-13-area", method: "walk", minLevel: 22, maxLevel: 26 },
  { name: "gloom", location: "kanto-route-13-area", method: "walk", minLevel: 28, maxLevel: 30 },
  { name: "venonat", location: "kanto-route-13-area", method: "walk", minLevel: 24, maxLevel: 26 },
];

// Curated Emerald wild encounters, verified against PokéAPI version 15
// (pokemon/{id}/encounters, version "emerald"). Only methods that need no
// special item are listed: walking through tall grass and Rock Smash.
export const EMERALD_ENCOUNTERS = [
  { name: "poochyena", location: "route-101", method: "walk", minLevel: 2, maxLevel: 3 },
  { name: "wurmple", location: "route-101", method: "walk", minLevel: 2, maxLevel: 3 },
  { name: "zigzagoon", location: "route-101", method: "walk", minLevel: 2, maxLevel: 3 },
  { name: "poochyena", location: "route-102", method: "walk", minLevel: 3, maxLevel: 4 },
  { name: "wurmple", location: "route-102", method: "walk", minLevel: 3, maxLevel: 4 },
  { name: "zigzagoon", location: "route-102", method: "walk", minLevel: 3, maxLevel: 4 },
  { name: "lotad", location: "route-102", method: "walk", minLevel: 3, maxLevel: 4 },
  { name: "seedot", location: "route-102", method: "walk", minLevel: 3, maxLevel: 4 },
  { name: "ralts", location: "route-102", method: "walk", minLevel: 4, maxLevel: 4 },
  { name: "poochyena", location: "route-103", method: "walk", minLevel: 2, maxLevel: 4 },
  { name: "zigzagoon", location: "route-103", method: "walk", minLevel: 3, maxLevel: 4 },
  { name: "wingull", location: "route-103", method: "walk", minLevel: 2, maxLevel: 4 },
  { name: "poochyena", location: "route-104", method: "walk", minLevel: 4, maxLevel: 5 },
  { name: "wurmple", location: "route-104", method: "walk", minLevel: 4, maxLevel: 4 },
  { name: "marill", location: "route-104", method: "walk", minLevel: 4, maxLevel: 5 },
  { name: "taillow", location: "route-104", method: "walk", minLevel: 4, maxLevel: 5 },
  { name: "wingull", location: "route-104", method: "walk", minLevel: 3, maxLevel: 5 },
  { name: "poochyena", location: "petalburg-woods", method: "walk", minLevel: 5, maxLevel: 6 },
  { name: "wurmple", location: "petalburg-woods", method: "walk", minLevel: 5, maxLevel: 6 },
  { name: "silcoon", location: "petalburg-woods", method: "walk", minLevel: 5, maxLevel: 5 },
  { name: "cascoon", location: "petalburg-woods", method: "walk", minLevel: 5, maxLevel: 5 },
  { name: "taillow", location: "petalburg-woods", method: "walk", minLevel: 5, maxLevel: 6 },
  { name: "shroomish", location: "petalburg-woods", method: "walk", minLevel: 5, maxLevel: 6 },
  { name: "slakoth", location: "petalburg-woods", method: "walk", minLevel: 5, maxLevel: 6 },
  { name: "poochyena", location: "route-116", method: "walk", minLevel: 6, maxLevel: 8 },
  { name: "taillow", location: "route-116", method: "walk", minLevel: 6, maxLevel: 8 },
  { name: "whismur", location: "route-116", method: "walk", minLevel: 6, maxLevel: 8 },
  { name: "nincada", location: "route-116", method: "walk", minLevel: 6, maxLevel: 7 },
  { name: "skitty", location: "route-116", method: "walk", minLevel: 7, maxLevel: 8 },
  { name: "abra", location: "route-116", method: "walk", minLevel: 7, maxLevel: 7 },
  { name: "whismur", location: "rusturf-tunnel", method: "walk", minLevel: 5, maxLevel: 8 },
  { name: "makuhita", location: "granite-cave-1f", method: "walk", minLevel: 6, maxLevel: 10 },
  { name: "zubat", location: "granite-cave-1f", method: "walk", minLevel: 7, maxLevel: 8 },
  { name: "geodude", location: "granite-cave-1f", method: "walk", minLevel: 6, maxLevel: 9 },
  { name: "abra", location: "granite-cave-1f", method: "walk", minLevel: 8, maxLevel: 8 },
  { name: "makuhita", location: "granite-cave-b1f", method: "walk", minLevel: 10, maxLevel: 11 },
  { name: "aron", location: "granite-cave-b1f", method: "walk", minLevel: 9, maxLevel: 11 },
  { name: "zubat", location: "granite-cave-b1f", method: "walk", minLevel: 9, maxLevel: 10 },
  { name: "abra", location: "granite-cave-b1f", method: "walk", minLevel: 9, maxLevel: 9 },
  { name: "sableye", location: "granite-cave-b1f", method: "walk", minLevel: 9, maxLevel: 11 },
  { name: "aron", location: "granite-cave-b2f", method: "walk", minLevel: 10, maxLevel: 12 },
  { name: "zubat", location: "granite-cave-b2f", method: "walk", minLevel: 10, maxLevel: 11 },
  { name: "abra", location: "granite-cave-b2f", method: "walk", minLevel: 10, maxLevel: 10 },
  { name: "sableye", location: "granite-cave-b2f", method: "walk", minLevel: 10, maxLevel: 12 },
  { name: "geodude", location: "granite-cave-b2f", method: "rock-smash", minLevel: 5, maxLevel: 20 },
  { name: "poochyena", location: "route-110", method: "walk", minLevel: 12, maxLevel: 12 },
  { name: "wingull", location: "route-110", method: "walk", minLevel: 12, maxLevel: 12 },
  { name: "electrike", location: "route-110", method: "walk", minLevel: 12, maxLevel: 13 },
  { name: "gulpin", location: "route-110", method: "walk", minLevel: 12, maxLevel: 13 },
  { name: "plusle", location: "route-110", method: "walk", minLevel: 12, maxLevel: 13 },
  { name: "minun", location: "route-110", method: "walk", minLevel: 13, maxLevel: 13 },
  { name: "oddish", location: "route-110", method: "walk", minLevel: 13, maxLevel: 13 },
  { name: "trapinch", location: "route-111", method: "walk", minLevel: 19, maxLevel: 21 },
  { name: "sandshrew", location: "route-111", method: "walk", minLevel: 19, maxLevel: 21 },
  { name: "cacnea", location: "route-111", method: "walk", minLevel: 20, maxLevel: 22 },
  { name: "geodude", location: "route-111", method: "rock-smash", minLevel: 5, maxLevel: 20 },
  { name: "marill", location: "route-112", method: "walk", minLevel: 14, maxLevel: 16 },
  { name: "numel", location: "route-112", method: "walk", minLevel: 14, maxLevel: 16 },
  { name: "slugma", location: "route-113", method: "walk", minLevel: 14, maxLevel: 16 },
  { name: "spinda", location: "route-113", method: "walk", minLevel: 14, maxLevel: 16 },
  { name: "lotad", location: "route-114", method: "walk", minLevel: 15, maxLevel: 16 },
  { name: "swablu", location: "route-114", method: "walk", minLevel: 15, maxLevel: 17 },
  { name: "geodude", location: "route-114", method: "rock-smash", minLevel: 5, maxLevel: 20 },
  { name: "poochyena", location: "route-117", method: "walk", minLevel: 13, maxLevel: 14 },
  { name: "seedot", location: "route-117", method: "walk", minLevel: 13, maxLevel: 13 },
  { name: "marill", location: "route-117", method: "walk", minLevel: 13, maxLevel: 13 },
  { name: "oddish", location: "route-117", method: "walk", minLevel: 13, maxLevel: 14 },
  { name: "machop", location: "fiery-path", method: "walk", minLevel: 15, maxLevel: 16 },
  { name: "numel", location: "fiery-path", method: "walk", minLevel: 15, maxLevel: 16 },
  { name: "slugma", location: "fiery-path", method: "walk", minLevel: 15, maxLevel: 15 },
  { name: "zigzagoon", location: "route-118", method: "walk", minLevel: 24, maxLevel: 26 },
  { name: "wingull", location: "route-118", method: "walk", minLevel: 25, maxLevel: 27 },
  { name: "electrike", location: "route-118", method: "walk", minLevel: 24, maxLevel: 26 },
  { name: "kecleon", location: "route-118", method: "walk", minLevel: 25, maxLevel: 25 },
  { name: "zigzagoon", location: "route-119", method: "walk", minLevel: 25, maxLevel: 27 },
  { name: "kecleon", location: "route-119", method: "walk", minLevel: 25, maxLevel: 25 },
  { name: "oddish", location: "route-119", method: "walk", minLevel: 24, maxLevel: 27 },
  { name: "machop", location: "jagged-pass", method: "walk", minLevel: 20, maxLevel: 22 },
  { name: "numel", location: "jagged-pass", method: "walk", minLevel: 20, maxLevel: 22 },
  { name: "zubat", location: "meteor-falls-area", method: "walk", minLevel: 14, maxLevel: 20 },
];

export function getCampaignEncounters(gameId, milestoneId) {
  const encounters = gameId === "emerald"
    ? EMERALD_ENCOUNTERS
    : gameId === "firered"
      ? FIRERED_ENCOUNTERS
      : [];
  if (!encounters.length) return [];

  const labels = gameId === "emerald" ? EMERALD_LOCATION_LABELS : FIRERED_LOCATION_LABELS;
  const milestone = getCampaignMilestone(gameId, milestoneId);
  const accessible = new Set(milestone?.availableLocations ?? []);

  return encounters
    .filter((encounter) => accessible.has(encounter.location))
    .map((encounter) => ({
      pokemon: encounter.name,
      location: labels[encounter.location] ?? encounter.location,
      method: EMERALD_METHOD_LABELS[encounter.method] ?? encounter.method,
      minLevel: encounter.minLevel,
      maxLevel: encounter.maxLevel,
    }));
}

export function getGameVersionGroup(gameId) {
  const game = CAMPAIGN_GAMES.find(({ id }) => id === gameId);
  return game?.versionGroup ?? null;
}

export function getCampaignGame(gameId) {
  return CAMPAIGN_GAMES.find((game) => game.id === gameId) ?? CAMPAIGN_GAMES[0];
}

export function getCampaignMilestones(gameId) {
  if (gameId === "emerald") return EMERALD_MILESTONES;
  if (gameId === "firered") return FIRERED_MILESTONES;
  return [];
}

export function getCampaignMilestone(gameId, milestoneId) {
  return getCampaignMilestones(gameId)
    .find((milestone) => milestone.id === milestoneId) ?? getCampaignMilestones(gameId)[0];
}
