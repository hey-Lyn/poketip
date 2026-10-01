import { getSupabase } from "./auth";

const AVATAR_BUCKET = "avatars";
const AVATAR_PATH = "avatar";
export const MAX_BIO_LENGTH = 280;
export const MAX_DISPLAY_NAME_LENGTH = 40;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const PROFILE_COLUMNS =
  "display_name, bio, favorite_pokemon_id, favorite_pokemon_name, avatar_url, credits, role, created_at";

const EDITABLE_PROFILE_FIELDS = [
  "display_name",
  "bio",
  "favorite_pokemon_id",
  "favorite_pokemon_name",
  "avatar_url",
];

function requireClient() {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Profile is not configured.");
  return supabase;
}

export async function getProfile(userId) {
  if (!userId) return null;

  const supabase = requireClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error("Unable to load your profile.");
  return data ?? null;
}

export async function saveProfile(userId, updates) {
  const supabase = requireClient();
  const safeUpdates = {};
  for (const field of EDITABLE_PROFILE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      safeUpdates[field] = updates[field];
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      ...safeUpdates,
      updated_at: new Date().toISOString(),
    })
    .select(PROFILE_COLUMNS)
    .single();

  if (error) throw new Error("Unable to save your profile.");
  return data;
}

export async function uploadAvatar(userId, file) {
  if (!file) throw new Error("Choose an image to upload.");
  if (!file.type.startsWith("image/")) {
    throw new Error("The avatar must be an image file.");
  }
  if (file.size > MAX_AVATAR_BYTES) {
    throw new Error("The avatar must be 2 MB or smaller.");
  }

  const supabase = requireClient();
  const path = `${userId}/${AVATAR_PATH}`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, {
      upsert: true,
      cacheControl: "3600",
      contentType: file.type,
    });

  if (error) throw new Error("Unable to upload the avatar.");

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
