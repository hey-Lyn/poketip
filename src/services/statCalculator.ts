import type { StatBlock, StatKey } from "../types";

export const STAT_KEYS: StatKey[] = [
  "hp",
  "attack",
  "defense",
  "specialAttack",
  "specialDefense",
  "speed",
];

export const STAT_LABELS: Record<StatKey, string> = {
  hp: "HP",
  attack: "Atk",
  defense: "Def",
  specialAttack: "SpA",
  specialDefense: "SpD",
  speed: "Spe",
};

export const STAT_NAME_TO_KEY: Record<string, StatKey> = {
  hp: "hp",
  attack: "attack",
  defense: "defense",
  "special-attack": "specialAttack",
  "special-defense": "specialDefense",
  speed: "speed",
};

type NatureEffect = { increased: StatKey; decreased: StatKey } | null;

const NATURE_EFFECTS: Record<string, NatureEffect> = {
  Lonely: { increased: "attack", decreased: "defense" },
  Brave: { increased: "attack", decreased: "speed" },
  Adamant: { increased: "attack", decreased: "specialAttack" },
  Naughty: { increased: "attack", decreased: "specialDefense" },
  Bold: { increased: "defense", decreased: "attack" },
  Relaxed: { increased: "defense", decreased: "speed" },
  Impish: { increased: "defense", decreased: "specialAttack" },
  Lax: { increased: "defense", decreased: "specialDefense" },
  Timid: { increased: "speed", decreased: "attack" },
  Hasty: { increased: "speed", decreased: "defense" },
  Jolly: { increased: "speed", decreased: "specialAttack" },
  Naive: { increased: "speed", decreased: "specialDefense" },
  Modest: { increased: "specialAttack", decreased: "attack" },
  Mild: { increased: "specialAttack", decreased: "defense" },
  Quiet: { increased: "specialAttack", decreased: "speed" },
  Rash: { increased: "specialAttack", decreased: "specialDefense" },
  Calm: { increased: "specialDefense", decreased: "attack" },
  Gentle: { increased: "specialDefense", decreased: "defense" },
  Sassy: { increased: "specialDefense", decreased: "speed" },
  Careful: { increased: "specialDefense", decreased: "specialAttack" },
  Hardy: null,
  Docile: null,
  Serious: null,
  Bashful: null,
  Quirky: null,
};

const NATURE_EFFECTS_LOWER: Record<string, NatureEffect> = Object.fromEntries(
  Object.entries(NATURE_EFFECTS).map(([name, effect]) => [
    name.toLowerCase(),
    effect,
  ]),
);

export function getNatureMultiplier(
  nature: string | null | undefined,
  stat: StatKey,
): number {
  const effect = NATURE_EFFECTS_LOWER[(nature ?? "").toLowerCase()] ?? null;
  if (!effect) return 1;
  if (effect.increased === stat) return 1.1;
  if (effect.decreased === stat) return 0.9;
  return 1;
}

export function calculateHp(
  base: number,
  iv: number,
  ev: number,
  level: number,
  isShedinja = false,
): number {
  if (isShedinja) return 1;
  return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100) +
    level + 10;
}

export function calculateStat(
  base: number,
  iv: number,
  ev: number,
  level: number,
  multiplier: number,
): number {
  const raw = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
  return Math.floor((raw + 5) * multiplier);
}

export interface FinalStatsInput {
  baseStats: Partial<StatBlock> | null | undefined;
  ivs?: Partial<StatBlock> | null;
  evs?: Partial<StatBlock> | null;
  nature?: string | null;
  level?: number;
  isShedinja?: boolean;
}

export function calculateFinalStats(input: FinalStatsInput): StatBlock {
  const { baseStats, nature, isShedinja = false } = input;
  const level = Math.min(100, Math.max(1, Math.round(input.level ?? 100)));
  const ivs = input.ivs ?? {};
  const evs = input.evs ?? {};
  const finalStats = {} as StatBlock;

  for (const stat of STAT_KEYS) {
    const base = baseStats?.[stat] ?? 0;
    const iv = ivs[stat] ?? 31;
    const ev = evs[stat] ?? 0;

    finalStats[stat] = stat === "hp"
      ? calculateHp(base, iv, ev, level, isShedinja)
      : calculateStat(base, iv, ev, level, getNatureMultiplier(nature, stat));
  }

  return finalStats;
}

export function pokeApiStatsToBlock(
  stats: { name: string; value: number }[] | null | undefined,
): StatBlock {
  const block = {} as StatBlock;

  for (const stat of stats ?? []) {
    const key = STAT_NAME_TO_KEY[stat.name];
    if (key) block[key] = stat.value;
  }

  return block;
}

export function sumStats(
  stats: Partial<StatBlock> | null | undefined,
): number {
  return STAT_KEYS.reduce((total, stat) => total + (stats?.[stat] ?? 0), 0);
}
