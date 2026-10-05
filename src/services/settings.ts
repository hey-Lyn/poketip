const SETTINGS_STORAGE_KEY = "poketip-settings-v1";

export const THEMES = ["sylveon", "umbreon"];

export interface Settings {
  theme: string;
  shiny: boolean;
  reduceMotion: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "sylveon",
  shiny: false,
  reduceMotion: false,
};

export function normalizeSettings(raw: unknown): Settings {
  const source = (
    raw && typeof raw === "object" ? raw : {}
  ) as Partial<Settings> & { theme?: string };
  const settings = { ...DEFAULT_SETTINGS };

  if (THEMES.includes(source.theme as string)) {
    settings.theme = source.theme as string;
  }
  if (typeof source.shiny === "boolean") settings.shiny = source.shiny;
  if (typeof source.reduceMotion === "boolean") {
    settings.reduceMotion = source.reduceMotion;
  }

  return settings;
}

export function loadSettings() {
  try {
    return normalizeSettings(JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "null"));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: unknown) {
  try {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify(normalizeSettings(settings)) ?? "null",
    );
  } catch {
    // Preferences stay applied for the session even if storage is unavailable.
  }
}

export { SETTINGS_STORAGE_KEY };
