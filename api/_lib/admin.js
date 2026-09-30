import { createClient } from "@supabase/supabase-js";
import { AiRequestError } from "./validateAiRequest.js";
import { requireUser } from "./auth.js";

export function createAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

// Verifies the bearer token and that the account has the admin role.
export async function requireAdmin(request) {
  const user = await requireUser(request);
  const supabase = createAdminClient();

  if (!supabase) {
    throw new AiRequestError(
      "Admin tools are not configured on the server.",
      "ADMIN_NOT_CONFIGURED",
      503,
    );
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    throw new AiRequestError(
      "Unable to verify admin access.",
      "ADMIN_CHECK_FAILED",
      503,
    );
  }

  if (data?.role !== "admin") {
    throw new AiRequestError(
      "Admin access is required.",
      "ADMIN_REQUIRED",
      403,
    );
  }

  return { user, supabase };
}
