import { useCallback, useEffect, useState } from "react";
import { loadSettings, saveSettings } from "../services/settings";

export function useSettings() {
  const [settings, setSettings] = useState(loadSettings);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSettings = useCallback((changes) => {
    setSettings((current) => ({ ...current, ...changes }));
  }, []);

  return [settings, updateSettings];
}
