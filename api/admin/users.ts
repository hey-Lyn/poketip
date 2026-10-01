import { requireAdmin } from "../_lib/admin";
import { AiRequestError } from "../_lib/validateAiRequest";

export const config = {
  maxDuration: 30,
};

const ALLOWED_ROLES = new Set(["user", "admin"]);
const PROFILES_SELECT = "id, display_name, credits, role, created_at";

function readBody(body) {
  if (typeof body !== "string") return body;

  try {
    return JSON.parse(body);
  } catch {
    throw new AiRequestError("The request body contains invalid JSON.");
  }
}

async function listUsers(supabase) {
  const { data: authData, error: authError } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (authError) {
    throw new AiRequestError(
      "Unable to load accounts right now.",
      "ADMIN_LIST_FAILED",
      503,
    );
  }

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select(PROFILES_SELECT);

  if (profileError) {
    throw new AiRequestError(
      "Unable to load profiles right now.",
      "ADMIN_LIST_FAILED",
      503,
    );
  }

  const byId = new Map<string, any>(
    (profiles ?? []).map((profile: any) => [profile.id, profile]),
  );

  return authData.users.map((user) => {
    const profile = byId.get(user.id);
    return {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      display_name: profile?.display_name ?? "",
      credits: profile?.credits ?? 0,
      role: profile?.role ?? "user",
    };
  });
}

function readUpdates(body) {
  const updates: Record<string, any> = {};

  if (body.role !== undefined) {
    if (!ALLOWED_ROLES.has(body.role)) {
      throw new AiRequestError("This role is not supported.", "INVALID_ROLE");
    }
    updates.role = body.role;
  }

  if (body.credits !== undefined) {
    if (!Number.isInteger(body.credits) || body.credits < 0) {
      throw new AiRequestError("Credits must be a non-negative integer.", "INVALID_CREDITS");
    }
    updates.credits = body.credits;
  }

  if (!Object.keys(updates).length) {
    throw new AiRequestError("No supported changes were provided.");
  }

  return updates;
}

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "GET" && request.method !== "PATCH") {
    response.setHeader("Allow", "GET, PATCH");
    return response.status(405).json({
      error: { code: "METHOD_NOT_ALLOWED", message: "Only GET and PATCH requests are allowed." },
    });
  }

  try {
    const { user: admin, supabase } = await requireAdmin(request);

    if (request.method === "GET") {
      return response.status(200).json({ users: await listUsers(supabase) });
    }

    const body = readBody(request.body) ?? {};
    if (typeof body.userId !== "string" || !body.userId) {
      throw new AiRequestError("A target user id is required.", "INVALID_USER_ID");
    }

    const updates = readUpdates(body);
    if (
      body.userId === admin.id &&
      updates.role !== undefined &&
      updates.role !== "admin"
    ) {
      throw new AiRequestError(
        "You cannot remove your own admin role.",
        "SELF_DEMOTE_FORBIDDEN",
        400,
      );
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", body.userId)
      .select(PROFILES_SELECT)
      .single();

    if (error) {
      throw new AiRequestError(
        "Unable to update this account.",
        "ADMIN_UPDATE_FAILED",
        503,
      );
    }

    return response.status(200).json({ user: data });
  } catch (error) {
    if (!error?.code) console.error("Unexpected admin endpoint error:", error);
    const status = Number.isInteger(error.status) ? error.status : 500;
    const code = typeof error.code === "string" ? error.code : "ADMIN_REQUEST_FAILED";
    const message = status >= 500 && !error.code
      ? "The admin service is temporarily unavailable."
      : error.message;

    return response.status(status).json({ error: { code, message } });
  }
}
