import { getSupabase } from "./auth";
import { isValidUsername, normalizeUsername } from "./trainers";
import { validateCustomization } from "./trainerCustomization";

const AVATAR_BUCKET = "avatars";
const AVATAR_PATH = "avatar";
export const MAX_BIO_LENGTH = 280;
export const MAX_DISPLAY_NAME_LENGTH = 40;
export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const PRIVATE_PROFILE_COLUMNS =
  "display_name, bio, favorite_pokemon_id, favorite_pokemon_name, avatar_url, credits, role, created_at";
const SOCIAL_PROFILE_COLUMNS = `${PRIVATE_PROFILE_COLUMNS}, username, social_enabled`;
const CARD_COLOR_FIELDS = ["card_frame_color", "card_background_start", "card_background_end"];
const LEGACY_CUSTOMIZATION_FIELDS = ["trainer_title", "card_palette", "cover_style", "cover_url", "favorite_game", "featured_team"];
const CUSTOMIZATION_FIELDS = [...LEGACY_CUSTOMIZATION_FIELDS, ...CARD_COLOR_FIELDS];
const LEGACY_CUSTOMIZATION_COLUMNS = `${SOCIAL_PROFILE_COLUMNS}, ${LEGACY_CUSTOMIZATION_FIELDS.join(", ")}`;
const PROFILE_COLUMNS = `${SOCIAL_PROFILE_COLUMNS}, ${CUSTOMIZATION_FIELDS.join(", ")}`;

const EDITABLE_PROFILE_FIELDS = [
  "display_name",
  "bio",
  "favorite_pokemon_id",
  "favorite_pokemon_name",
  "avatar_url",
  "username",
  "social_enabled",
  ...CUSTOMIZATION_FIELDS,
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

  // Keep the existing private profile usable until the social migration has
  // been applied to the connected Supabase project.
  if (error?.code === "42703") {
    const customized = await supabase.from("profiles").select(LEGACY_CUSTOMIZATION_COLUMNS).eq("id", userId).maybeSingle();
    if (!customized.error) return customized.data ? { ...customized.data, social_ready: true, customization_ready: true, card_colors_ready: false } : null;
    if (customized.error.code !== "42703") throw new Error("Unable to load your profile.");
    const social = await supabase.from("profiles").select(SOCIAL_PROFILE_COLUMNS).eq("id", userId).maybeSingle();
    if (!social.error) return social.data ? { ...social.data, social_ready: true, customization_ready: false } : null;
    if (social.error.code !== "42703") throw new Error("Unable to load your profile.");
    const legacy = await supabase
      .from("profiles")
      .select(PRIVATE_PROFILE_COLUMNS)
      .eq("id", userId)
      .maybeSingle();
    if (legacy.error) throw new Error("Unable to load your profile.");
    return legacy.data ? { ...legacy.data, social_ready: false, customization_ready: false } : null;
  }
  if (error) throw new Error("Unable to load your profile.");
  return data ? { ...data, social_ready: true, customization_ready: true, card_colors_ready: true } : null;
}

export async function saveProfile(userId, updates) {
  const supabase = requireClient();
  const safeUpdates: Record<string, any> = {};
  for (const field of EDITABLE_PROFILE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updates, field)) {
      safeUpdates[field] = updates[field];
    }
  }

  if ("username" in safeUpdates) {
    if (safeUpdates.username !== null && typeof safeUpdates.username !== "string") {
      throw new Error("Enter a valid username.");
    }
    const username = normalizeUsername(safeUpdates.username ?? "");
    if (username && !isValidUsername(username)) {
      throw new Error("Username must be 3–24 letters, numbers or underscores, starting with a letter or number.");
    }
    safeUpdates.username = username || null;
    if (safeUpdates.social_enabled === true && !username) {
      throw new Error("Choose a username before enabling your social profile.");
    }
  }

  if (updates.social_ready === false) {
    delete safeUpdates.username;
    delete safeUpdates.social_enabled;
  }
  if (updates.customization_ready === false || updates.social_ready === false) {
    for (const field of CUSTOMIZATION_FIELDS) delete safeUpdates[field];
  }
  if (updates.card_colors_ready === false) for (const field of CARD_COLOR_FIELDS) delete safeUpdates[field];
  validateCustomization(safeUpdates);
  if (safeUpdates.featured_team) safeUpdates.featured_team = safeUpdates.featured_team.map(({ id, name }) => ({ id, name }));
  const columns = updates.social_ready === false ? PRIVATE_PROFILE_COLUMNS
    : updates.customization_ready === false ? SOCIAL_PROFILE_COLUMNS
      : updates.card_colors_ready === false ? LEGACY_CUSTOMIZATION_COLUMNS : PROFILE_COLUMNS;

  const { data, error } = await supabase
    .from("profiles")
    // Signup/backfill creates this row. Updating only editable columns also
    // avoids ON CONFLICT trying to update the protected primary key.
    .update({
      ...safeUpdates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select(columns)
    .single();

  if (error?.code === "42703") {
    throw new Error("Profile customization is not ready yet. Apply the profile customization database migration first.");
  }
  if (error?.code === "23505") throw new Error("This username is already taken. Choose another one.");
  if (error?.code === "23514") throw new Error("Choose a valid username before enabling your social profile.");
  if (error) throw new Error("Unable to save your profile.");
  return { ...data,
    ...("social_ready" in updates ? { social_ready: updates.social_ready } : {}),
    ...("customization_ready" in updates ? { customization_ready: updates.customization_ready } : {}),
    ...("card_colors_ready" in updates ? { card_colors_ready: updates.card_colors_ready } : {}),
  };
}

export async function uploadCover(userId, file) {
  if (!userId) throw new Error("Sign in to upload a cover.");
  if (!file || !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) throw new Error("Choose a PNG, JPG, WebP or GIF cover.");
  if (file.size > MAX_AVATAR_BYTES) throw new Error("The cover must be 2 MB or smaller.");
  const supabase = requireClient();
  const path = `${userId}/cover-${crypto.randomUUID()}`;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).upload(path, file, { cacheControl: "3600", contentType: file.type });
  if (error) throw new Error("Unable to upload the cover.");
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
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
