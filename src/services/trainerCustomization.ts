import type { CSSProperties } from "react";

export const MAX_TRAINER_TITLE_LENGTH = 60;
export const MAX_GAME_LENGTH = 80;
export const CARD_PALETTES = [
  { id: "fairy", name: "Fairy", accent: "#fa8caa", dark: "#8f3048" },
  { id: "water", name: "Water", accent: "#76dbf1", dark: "#245c6c" },
  { id: "grass", name: "Grass", accent: "#95d6a4", dark: "#325c45" },
  { id: "ghost", name: "Ghost", accent: "#c5a3ef", dark: "#564077" },
  { id: "fire", name: "Fire", accent: "#ffb37d", dark: "#8c452e" },
];
export const CARD_COVERS = [
  { id: "classic", name: "Classic", image: null },
  { id: "forest", name: "Forest", image: "/pokedex-background.png" },
  { id: "journey", name: "Journey", image: "/profileback.jpg" },
  { id: "arena", name: "Arena", image: "/pokemon-details-background.png" },
];
export interface FeaturedPokemon { id: number; name: string }
export interface TrainerCustomization {
  trainer_title: string;
  card_palette: string;
  card_frame_color: string;
  card_background_start: string;
  card_background_end: string;
  cover_style: string;
  cover_url: string | null;
  favorite_game: string;
  featured_team: FeaturedPokemon[];
}
export function getCustomization(profile): TrainerCustomization {
  const palette = CARD_PALETTES.find((entry) => entry.id === profile?.card_palette) ?? CARD_PALETTES[0];
  return {
    trainer_title: profile?.trainer_title ?? "",
    card_palette: profile?.card_palette ?? "fairy",
    card_frame_color: isCardColor(profile?.card_frame_color) ? profile.card_frame_color : palette.accent,
    card_background_start: isCardColor(profile?.card_background_start) ? profile.card_background_start : "#123945",
    card_background_end: isCardColor(profile?.card_background_end) ? profile.card_background_end : "#0d2630",
    cover_style: profile?.cover_style ?? "classic",
    cover_url: profile?.cover_url ?? null,
    favorite_game: profile?.favorite_game ?? "",
    featured_team: profile?.featured_team ?? [],
  };
}
export function isCardColor(value): boolean { return typeof value === "string" && /^#[0-9a-f]{6}$/iu.test(value); }
export function trainerCardStyle(profile): CSSProperties {
  const colors = getCustomization(profile);
  const palette = CARD_PALETTES.find((entry) => entry.id === colors.card_palette) ?? CARD_PALETTES[0];
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
      .map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  };
  const lightness = [luminance(colors.card_background_start), luminance(colors.card_background_end)];
  const useDarkText = (Math.min(...lightness) + 0.05) / 0.05 > 1.05 / (Math.max(...lightness) + 0.05);
  return { "--trainer-accent": palette.accent, "--trainer-frame": colors.card_frame_color,
    "--trainer-background-start": colors.card_background_start, "--trainer-background-end": colors.card_background_end,
    "--trainer-text": useDarkText ? "#14212b" : "#f4faff",
    "--trainer-surface": useDarkText ? "rgb(255 255 255 / 25%)" : "rgb(0 0 0 / 20%)" } as CSSProperties;
}
export function trainerCoverStyle(profile): CSSProperties {
  const cover = CARD_COVERS.find((entry) => entry.id === profile?.cover_style) ?? CARD_COVERS[0];
  const custom = typeof profile?.cover_url === "string" && /^(https:\/\/|data:image\/(png|jpeg|webp|gif);base64,)/u.test(profile.cover_url) ? profile.cover_url : null;
  const image = custom ?? cover.image;
  return { background: image
    ? `linear-gradient(0deg, rgb(13 38 48 / 40%), rgb(13 38 48 / 15%)), url(${JSON.stringify(image)}) center / cover`
    : "radial-gradient(circle at 80% 30%, rgb(118 219 241 / 25%), transparent 55%), linear-gradient(120deg, var(--trainer-frame), var(--trainer-accent))" };
}
export function validateCustomization(updates) {
  for (const field of ["card_frame_color", "card_background_start", "card_background_end"]) {
    if (field in updates && !isCardColor(updates[field])) throw new Error("Choose a valid RGB card color.");
  }
  for (const [field, limit] of [["trainer_title", MAX_TRAINER_TITLE_LENGTH], ["favorite_game", MAX_GAME_LENGTH]] as const) {
    if (field in updates && (typeof updates[field] !== "string" || updates[field].length > limit)) {
      throw new Error(`${field === "trainer_title" ? "Trainer title" : "Favorite game"} must be ${limit} characters or fewer.`);
    }
  }
  if ("card_palette" in updates && !CARD_PALETTES.some((entry) => entry.id === updates.card_palette)) throw new Error("Choose a card color.");
  if ("cover_style" in updates && !CARD_COVERS.some((entry) => entry.id === updates.cover_style)) throw new Error("Choose a cover style.");
  if ("cover_url" in updates && updates.cover_url !== null && (typeof updates.cover_url !== "string" || updates.cover_url.length > 2048 || !/^https:\/\//u.test(updates.cover_url))) throw new Error("Choose a valid cover image.");
  if ("featured_team" in updates && (!Array.isArray(updates.featured_team) || updates.featured_team.length > 6 || updates.featured_team.some((member) =>
    !Number.isInteger(member?.id) || member.id < 1 || member.id > 100000 || typeof member.name !== "string" || !member.name.trim() || member.name.length > 100))) {
    throw new Error("Choose up to six Pokémon for your featured team.");
  }
}
