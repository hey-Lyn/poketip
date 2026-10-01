import { createClient } from "@supabase/supabase-js";
import { AiRequestError } from "./validateAiRequest";

function createAuthClient() {
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

function readBearerToken(authorization) {
  if (typeof authorization !== "string") return null;
  if (!authorization.startsWith("Bearer ")) return null;

  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

export async function requireUser(request) {
  const token = readBearerToken(request.headers?.authorization);
  if (!token) {
    throw new AiRequestError(
      "Sign in to use the AI assistant.",
      "AUTH_REQUIRED",
      401,
    );
  }

  const supabase = createAuthClient();
  if (!supabase) {
    throw new AiRequestError(
      "AI authentication is not configured on the server.",
      "AUTH_NOT_CONFIGURED",
      503,
    );
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    throw new AiRequestError(
      "Your session is invalid or expired. Sign in again.",
      "AUTH_INVALID",
      401,
    );
  }

  return data.user;
}
