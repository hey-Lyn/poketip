import { useCallback, useEffect, useRef, useState } from "react";
import { getProfile, saveProfile, uploadAvatar } from "../services/profile";
import type { Profile, ProfileUpdates } from "../services/profile";

export function useProfile(user: { id: string } | null) {
  const userId = user?.id ?? null;
  const [result, setResult] = useState<{ userId: string | null; profile: Profile | null; error: string }>({ userId: null, profile: null, error: "" });
  const requestVersion = useRef(0);

  const refresh = useCallback(() => {
    const version = ++requestVersion.current;
    if (!userId) return Promise.resolve(null);

    return getProfile(userId)
      .then((loaded) => {
        if (version === requestVersion.current) {
          setResult({ userId, profile: loaded, error: "" });
        }
        return loaded;
      })
      .catch((requestError) => {
        if (version === requestVersion.current) {
          setResult((previous) => ({
            userId,
            profile: previous.userId === userId ? previous.profile : null,
            error: requestError.message,
          }));
        }
        return null;
      });
  }, [userId]);

  const invalidateRequests = useCallback(() => { ++requestVersion.current; }, []);

  useEffect(() => {
    refresh();
    return invalidateRequests;
  }, [refresh, invalidateRequests]);

  const loaded = Boolean(userId) && result.userId === userId;
  const loading = Boolean(userId) && !loaded;

  const save = useCallback(async (updates: ProfileUpdates) => {
    if (!userId) throw new Error("Sign in to edit your profile.");
    const version = ++requestVersion.current;
    const currentProfile = result.userId === userId ? result.profile : null;
    const saved = await saveProfile(userId, { ...updates,
      ...(currentProfile?.social_ready !== undefined ? { social_ready: currentProfile.social_ready } : {}),
      ...(currentProfile?.customization_ready !== undefined ? { customization_ready: currentProfile.customization_ready } : {}),
      ...(currentProfile?.card_colors_ready !== undefined ? { card_colors_ready: currentProfile.card_colors_ready } : {}),
    });
    if (version === requestVersion.current) {
      setResult({ userId, profile: saved, error: "" });
    }
    return saved;
  }, [userId, result]);

  const changeAvatar = useCallback(async (file) => {
    const version = requestVersion.current;
    const avatarUrl = await uploadAvatar(userId, file);
    if (version !== requestVersion.current) throw new Error("Your profile changed. Please try again.");
    return save({ avatar_url: avatarUrl });
  }, [userId, save]);

  return {
    profile: loaded ? result.profile : null,
    loading,
    error: loaded ? result.error : "",
    refresh,
    save,
    changeAvatar,
  };
}
