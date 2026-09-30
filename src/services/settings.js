const SETTINGS_STORAGE_KEY = "poketip-settings-v1";

export const THEMES = ["sylveon", "umbreon"];

export const DEFAULT_SETTINGS = {
  theme: "sylveon",
  shiny: false,
  reduceMotion: false,
};

export function normalizeSettings(raw) {
  const source = raw && typeof raw === "object" ? raw : {};
  const settings = { ...DEFAULT_SETTINGS };

  if (THEMES.includes(source.theme)) settings.theme = source.theme;
  if (typeof source.shiny === "boolean") settings.shiny = source.shiny;
  if (typeof source.reduceMotion === "boolean") {
    settings.reduceMotion = source.reduceMotion;
  }

  return settings;
}

export function loadSettings() {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY)));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeSettings(settings)),
    );
  } catch {
    // Preferences stay applied for the session even if storage is unavailable.
  }
}

export { SETTINGS_STORAGE_KEY };
