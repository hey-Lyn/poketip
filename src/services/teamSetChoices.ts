import { Dex, toID } from "@pkmn/dex";
import type { PokemonMove } from "./pokeApi";

export { toID as choiceId };

export function getItemChoices() {
  return Dex.items.all()
    .filter((item) => item.exists && (!item.isNonstandard || item.isNonstandard === "Past"))
    .map((item) => ({ id: item.id, name: item.name, description: item.shortDesc || item.desc }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const VERSIONS = ["scarlet-violet", "legends-arceus", "brilliant-diamond-and-shining-pearl", "sword-shield", "lets-go-pikachu-lets-go-eevee", "ultra-sun-ultra-moon", "sun-moon", "omega-ruby-alpha-sapphire", "x-y", "black-2-white-2", "black-white", "heartgold-soulsilver", "platinum", "diamond-pearl", "emerald", "firered-leafgreen", "ruby-sapphire", "crystal", "gold-silver", "yellow", "red-blue"];
const GROUPS = { "level-up": "By level up", machine: "By TM / HM", egg: "Egg moves", tutor: "Tutor moves" };
const GROUP_ORDER = ["By level up", "By TM / HM", "Egg moves", "Tutor moves", "Other learned moves", "All moves"];

export function getMoveChoices(learned: PokemonMove[], all: boolean) {
  const version = VERSIONS.find((name) => learned.some((move) => move.versions?.some((entry) => entry.versionGroup === name)));
  const sources = new Map(learned.map((move) => [toID(move.name), move]));
  return (all ? Dex.moves.all() : learned.map((move) => Dex.moves.get(move.name)))
    .filter((move) => move.exists && !move.isZ && !move.isMax && move.id !== "struggle" && (!move.isNonstandard || move.isNonstandard === "Past"))
    .flatMap((move) => {
      const source = sources.get(move.id);
      const versions = source?.versions?.filter((entry) => !version || entry.versionGroup === version) ?? [];
      if (!all && source?.versions?.length && !versions.length) return [];
      const entry = versions.find((entry) => entry.method === "level-up") ?? versions[0];
      return [{ id: move.id, name: move.name, description: move.shortDesc || move.desc,
        type: move.type.toLowerCase(), category: move.category, power: move.basePower,
        accuracy: move.accuracy === true ? "Always" : String(move.accuracy), pp: move.pp,
        group: all ? "All moves" : GROUPS[entry?.method ?? ""] ?? "Other learned moves",
        level: entry?.method === "level-up" ? entry.level : null }];
    })
    .sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
      (a.group === "By level up" ? (a.level ?? 0) - (b.level ?? 0) : 0) || a.name.localeCompare(b.name));
}
