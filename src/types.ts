export type StatKey =
  | "hp"
  | "attack"
  | "defense"
  | "specialAttack"
  | "specialDefense"
  | "speed";

export type StatBlock = Record<StatKey, number>;

export interface TeamMember {
  id: number;
  name: string;
  sprite: string;
  types: string[];
  speciesName: string;
  item: string;
  ability: string;
  nature: string;
  teraType: string;
  level: number;
  gender: string;
  ivs: StatBlock;
  evs: StatBlock;
  moves: string[];
}

export type TeamSlot = TeamMember | null;
export type Team = TeamSlot[];

export interface PokemonLite {
  id: number;
  name: string;
  sprite: string;
  types: string[];
  speciesName?: string;
  abilities?: { name: string; isHidden?: boolean }[];
}

export interface AiChatMessage {
  role: string;
  content: string;
  sources?: unknown[];
  actions?: any[];
}

export interface AiBilling {
  [key: string]: unknown;
}
