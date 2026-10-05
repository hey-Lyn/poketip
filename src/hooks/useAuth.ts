import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "../services/auth";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let subscription;

    (async () => {
      const supabase = getSupabase();
      if (!supabase) {
        if (active) setLoading(false);
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    })();

    const supabase = getSupabase();
    if (supabase) {
      subscription = supabase.auth.onAuthStateChange(
        (_event, nextSession) => {
          if (active) setSession(nextSession);
        },
      ).data.subscription;
    }

    return () => {
      active = false;
      subscription?.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}
