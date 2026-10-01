import { createClient } from "@supabase/supabase-js";

let supabaseClient;

export function getSupabase() {
  if (supabaseClient) return supabaseClient;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  supabaseClient = createClient(url, anonKey);
  return supabaseClient;
}

export async function getAccessToken() {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function signIn(email, password) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Sign in is not configured.");

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error("Incorrect email or password.");
}

export async function signUp(email, password) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Registration is not configured.");

  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) {
    if (/already registered/i.test(error.message)) {
      throw new Error("This email is already registered.");
    }
    throw new Error("Unable to create the account.");
  }

  return data;
}

export async function signOut() {
  const supabase = getSupabase();
  if (!supabase) return;

  await supabase.auth.signOut();
}

export async function updatePassword(password) {
  const supabase = getSupabase();
  if (!supabase) throw new Error("Account updates are not configured.");
  if (!password || password.length < 6) {
    throw new Error("The password must be at least 6 characters long.");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error("Unable to update the password.");
}
