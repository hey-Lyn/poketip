import { useCallback, useEffect, useState } from "react";
import { loadSettings, saveSettings, type Settings } from "../services/settings";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSettings = useCallback((changes: Partial<Settings>) => {
    setSettings((current) => ({ ...current, ...changes }));
  }, []);

  return [settings, updateSettings] as const;
}
