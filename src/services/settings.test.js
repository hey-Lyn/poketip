import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  normalizeSettings,
  saveSettings,
  SETTINGS_STORAGE_KEY,
} from "./settings";

describe("settings service", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns defaults when nothing is stored", () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("returns defaults when the stored value is corrupt", () => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, "{not json");
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it("keeps known values and drops unknown keys", () => {
    expect(normalizeSettings({
      theme: "umbreon",
      shiny: true,
      reduceMotion: true,
      sidebarOpen: true,
    })).toEqual({ theme: "umbreon", shiny: true, reduceMotion: true });
  });

  it("falls back to Sylveon for an unknown theme", () => {
    expect(normalizeSettings({ theme: "charizard" }).theme).toBe("sylveon");
  });

  it("round-trips saved settings", () => {
    saveSettings({ theme: "umbreon", shiny: true, reduceMotion: true });
    expect(loadSettings()).toEqual({ theme: "umbreon", shiny: true, reduceMotion: true });
  });
});
