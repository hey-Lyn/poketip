import { createClient } from "@supabase/supabase-js";
import { AiRequestError } from "./validateAiRequest";

const DEFAULT_DAILY_LIMIT = 7;
const DEFAULT_CREDIT_COST = 1;
const DEFAULT_IP_DAILY_LIMIT = 14;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function createAdminClient() {
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

// Allows the request when it is within the free daily limit. Once the daily
// limit is reached, each request spends AI credits from the user's profile.
export async function checkUsageLimit(userId) {
  const dailyLimit = Number(process.env.AI_DAILY_LIMIT) || DEFAULT_DAILY_LIMIT;
  const creditCost = Number(process.env.AI_CREDIT_COST) || DEFAULT_CREDIT_COST;
  const supabase = createAdminClient();

  if (!supabase) {
    throw new AiRequestError(
      "AI usage tracking is not configured on the server.",
      "USAGE_TRACKING_NOT_CONFIGURED",
      503,
    );
  }

  const { data: usedToday, error: usageError } = await supabase.rpc(
    "increment_ai_usage",
    {
      p_user_id: userId,
      p_date: todayIso(),
    },
  );

  if (usageError) {
    throw new AiRequestError(
      "AI usage tracking is unavailable right now.",
      "USAGE_TRACKING_UNAVAILABLE",
      503,
    );
  }

  if (usedToday <= dailyLimit) {
    return { source: "daily", creditsRemaining: null };
  }

  const { data: creditsRemaining, error: creditError } = await supabase.rpc(
    "consume_ai_credit",
    {
      p_user_id: userId,
      p_amount: creditCost,
    },
  );

  if (creditError) {
    if (String(creditError.message ?? "").includes("INSUFFICIENT_CREDITS")) {
      throw new AiRequestError(
        "You reached your daily AI request limit and have no credits left.",
        "RATE_LIMITED",
        429,
      );
    }

    throw new AiRequestError(
      "AI usage tracking is unavailable right now.",
      "USAGE_TRACKING_UNAVAILABLE",
      503,
    );
  }

  return { source: "credits", creditsRemaining };
}

// Reads the client IP from the forwarding headers Vercel provides, falling back
// to the socket address and finally a shared "unknown" bucket.
export function readClientIp(request) {
  const forwarded = request.headers?.["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof firstForwarded === "string" && firstForwarded.trim()) {
    return firstForwarded.split(",")[0].trim();
  }

  const realIp = request.headers?.["x-real-ip"];
  const firstReal = Array.isArray(realIp) ? realIp[0] : realIp;
  if (typeof firstReal === "string" && firstReal.trim()) {
    return firstReal.trim();
  }

  return request.socket?.remoteAddress || "unknown";
}

// Caps how many AI requests a single client IP can make per day, so many
// accounts created from the same network cannot bypass the per-user limit.
export async function checkIpUsageLimit(request) {
  const ip = readClientIp(request);
  const dailyLimit = Number(process.env.AI_IP_DAILY_LIMIT) || DEFAULT_IP_DAILY_LIMIT;
  const supabase = createAdminClient();

  if (!supabase) {
    throw new AiRequestError(
      "AI usage tracking is not configured on the server.",
      "USAGE_TRACKING_NOT_CONFIGURED",
      503,
    );
  }

  const { data: usedToday, error } = await supabase.rpc("increment_ip_usage", {
    p_ip: ip,
    p_date: todayIso(),
  });

  if (error) {
    throw new AiRequestError(
      "AI usage tracking is unavailable right now.",
      "USAGE_TRACKING_UNAVAILABLE",
      503,
    );
  }

  if (usedToday > dailyLimit) {
    throw new AiRequestError(
      "Too many AI requests from this network today. Try again tomorrow.",
      "IP_RATE_LIMITED",
      429,
    );
  }

  return { ip, usedToday };
}
