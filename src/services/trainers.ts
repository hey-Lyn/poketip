import { getSupabase } from "./auth";
import type { TrainerCustomization } from "./trainerCustomization";

export const MAX_USERNAME_LENGTH = 24;
export const TRAINERS_PAGE_SIZE = 20;
const USERNAME_PATTERN = /^[a-z0-9][a-z0-9_]{2,23}$/u;

export interface TrainerProfile extends Partial<TrainerCustomization> {
  id: string;
  username: string;
  display_name: string;
  bio: string;
  favorite_pokemon_id: number | null;
  favorite_pokemon_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidUsername(value: string): boolean {
  return USERNAME_PATTERN.test(value);
}

function requireClient() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Trainer profiles are not configured.");
  return supabase;
}

function trainerError(error, fallback: string) {
  if (error.code === "42501") return new Error("Sign in to explore trainer profiles.");
  if (error.code === "PGRST202" || error.code === "42703") {
    return new Error("Trainer profiles are not ready yet. Apply the social profiles database migration first.");
  }
  return new Error(fallback);
}

export async function getTrainerProfile(username: string): Promise<TrainerProfile | null> {
  const normalized = normalizeUsername(username);
  if (!isValidUsername(normalized)) return null;
  const { data, error } = await requireClient().rpc("get_trainer_profile", {
    p_username: normalized,
  });
  if (error) throw trainerError(error, "Unable to load this trainer. Please try again.");
  return data?.[0] ?? null;
}

export async function searchTrainers(query = "", page = 0): Promise<{
  trainers: TrainerProfile[];
  hasNextPage: boolean;
}> {
  const normalized = query.trim().replace(/^@/u, "").toLowerCase();
  if (normalized.length > 100) throw new Error("Search must be 100 characters or fewer.");
  if (!Number.isSafeInteger(page) || page < 0 || page > Math.floor(2147483647 / TRAINERS_PAGE_SIZE)) {
    throw new Error("Invalid trainer page.");
  }

  const { data, error } = await requireClient().rpc("search_trainers", {
    p_query: normalized,
    p_offset: page * TRAINERS_PAGE_SIZE,
    p_limit: TRAINERS_PAGE_SIZE + 1,
  });
  if (error) throw trainerError(error, "Unable to load trainers. Please try again.");

  const trainers: TrainerProfile[] = data ?? [];
  return {
    trainers: trainers.slice(0, TRAINERS_PAGE_SIZE),
    hasNextPage: trainers.length > TRAINERS_PAGE_SIZE,
  };
}
