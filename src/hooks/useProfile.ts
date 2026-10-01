import { useCallback, useEffect, useState } from "react";
import { getProfile, saveProfile, uploadAvatar } from "../services/profile";

export function useProfile(user) {
  const userId = user?.id ?? null;
  const [profile, setProfile] = useState(null);
  const [loadedFor, setLoadedFor] = useState(null);
  const [error, setError] = useState("");

  const refresh = useCallback(() => {
    if (!userId) return Promise.resolve(null);

    return getProfile(userId)
      .then((loaded) => {
        setProfile(loaded);
        setError("");
        return loaded;
      })
      .catch((requestError) => {
        setError(requestError.message);
        return null;
      })
      .finally(() => setLoadedFor(userId));
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loading = Boolean(userId) && loadedFor !== userId;

  const save = useCallback(async (updates) => {
    const saved = await saveProfile(userId, updates);
    setProfile(saved);
    setError("");
    return saved;
  }, [userId]);

  const changeAvatar = useCallback(async (file) => {
    const avatarUrl = await uploadAvatar(userId, file);
    return save({ avatar_url: avatarUrl });
  }, [userId, save]);

  return {
    profile: userId ? profile : null,
    loading,
    error,
    refresh,
    save,
    changeAvatar,
  };
}
