import { createClient } from "@supabase/supabase-js";
import { AccessToken, RoomServiceClient, TrackSource } from "livekit-server-sdk";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TERMINAL_STATUSES = new Set(["declined", "canceled", "ended", "missed"]);

export class CallRequestError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function getCallConfig() {
  const rawUrl = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !apiKey || !apiSecret || !supabaseUrl || !supabaseKey) return null;
  try {
    const url = new URL(rawUrl);
    if (!["wss:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    url.protocol = "wss:";
    const clientUrl = url.toString().replace(/\/$/, "");
    url.protocol = "https:";
    return { url: clientUrl, serverUrl: url.toString().replace(/\/$/, ""), apiKey, apiSecret, supabaseUrl, supabaseKey };
  } catch { return null; }
}

function readCallId(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)
    || !("callId" in body) || typeof body.callId !== "string" || !UUID.test(body.callId)) {
    throw new CallRequestError("A valid call is required.", "INVALID_CALL_REQUEST", 400);
  }
  return body.callId.toLowerCase();
}

async function requireCallContext(request) {
  const authorization = request.headers?.authorization;
  const bearer = typeof authorization === "string" ? /^Bearer\s+(\S+)$/i.exec(authorization) : null;
  if (!bearer) throw new CallRequestError("Sign in to use calls.", "AUTH_REQUIRED", 401);
  const callId = readCallId(request.body);
  const config = getCallConfig();
  if (!config) throw new CallRequestError("Calls are not configured on the server yet.", "CALLS_NOT_CONFIGURED", 503);
  const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await supabase.auth.getUser(bearer[1]);
  if (authError || !auth?.user) throw new CallRequestError("Your session has expired. Sign in again.", "AUTH_INVALID", 401);
  const userId = auth.user.id;
  const { data: call, error: callError } = await supabase.from("trainer_calls")
    .select("id,conversation_id,caller_id,callee_id,mode,status,expires_at").eq("id", callId).maybeSingle();
  if (callError) throw new CallRequestError("Calls are temporarily unavailable.", "CALLS_UNAVAILABLE", 503);
  if (!call || ![call.caller_id, call.callee_id].includes(userId)) {
    throw new CallRequestError("This call is unavailable.", "CALL_UNAVAILABLE", 403);
  }
  const { data: conversation, error: conversationError } = await supabase.from("trainer_conversations")
    .select("id,initiator_id,recipient_id,status").eq("id", call.conversation_id).maybeSingle();
  if (conversationError) throw new CallRequestError("Calls are temporarily unavailable.", "CALLS_UNAVAILABLE", 503);
  if (!conversation || ![conversation.initiator_id, conversation.recipient_id].includes(userId)
    || call.caller_id === call.callee_id
    || ![conversation.initiator_id, conversation.recipient_id].includes(call.caller_id)
    || ![conversation.initiator_id, conversation.recipient_id].includes(call.callee_id)) {
    throw new CallRequestError("This call is unavailable.", "CALL_UNAVAILABLE", 403);
  }
  return { config, supabase, userId, call, conversation };
}

export async function createCallToken(request) {
  const { config, supabase, userId, call, conversation } = await requireCallContext(request);
  if (call.status !== "accepted" || conversation.status !== "accepted"
    || !["audio", "video"].includes(call.mode) || !(Date.parse(call.expires_at) > Date.now())) {
    throw new CallRequestError("This call is no longer active.", "CALL_UNAVAILABLE", 403);
  }
  const { data: profiles, error: profileError } = await supabase.from("profiles")
    .select("id,social_enabled").in("id", [call.caller_id, call.callee_id]);
  if (profileError) throw new CallRequestError("Calls are temporarily unavailable.", "CALLS_UNAVAILABLE", 503);
  if (profiles?.length !== 2 || !profiles.every(profile => profile.social_enabled === true)) {
    throw new CallRequestError("This trainer is unavailable for calls.", "CALL_UNAVAILABLE", 403);
  }
  const room = `trainer-call-${call.id}`;
  const rooms = new RoomServiceClient(config.serverUrl, config.apiKey, config.apiSecret);
  await rooms.createRoom({ name: room, maxParticipants: 2, emptyTimeout: 90, departureTimeout: 20 });
  // Room provisioning is a network request. Recheck consent afterwards so a
  // block/hang-up during that request does not yield a new credential.
  const [latestCall, latestConversation, latestProfiles] = await Promise.all([
    supabase.from("trainer_calls").select("status,expires_at").eq("id", call.id).maybeSingle(),
    supabase.from("trainer_conversations").select("status").eq("id", call.conversation_id).maybeSingle(),
    supabase.from("profiles").select("id,social_enabled").in("id", [call.caller_id, call.callee_id]),
  ]);
  if (latestCall.error || latestConversation.error || latestProfiles.error) {
    throw new CallRequestError("Calls are temporarily unavailable.", "CALLS_UNAVAILABLE", 503);
  }
  if (latestCall.data?.status !== "accepted" || latestConversation.data?.status !== "accepted"
    || !(Date.parse(latestCall.data.expires_at) > Date.now())
    || latestProfiles.data?.length !== 2 || !latestProfiles.data.every(profile => profile.social_enabled === true)) {
    throw new CallRequestError("This call is no longer active.", "CALL_UNAVAILABLE", 403);
  }
  // The expiry gates joining, not an ongoing LiveKit connection. Cleanup handles
  // hang-ups and withdrawn consent; database state guards every new token.
  const ttl = Math.max(1, Math.min(60, Math.floor((Date.parse(latestCall.data.expires_at) - Date.now()) / 1000)));
  const access = new AccessToken(config.apiKey, config.apiSecret, { identity: userId, ttl });
  access.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
    canUpdateOwnMetadata: false,
    canPublishSources: call.mode === "video" ? [TrackSource.MICROPHONE, TrackSource.CAMERA] : [TrackSource.MICROPHONE],
  });
  return { token: await access.toJwt(), url: config.url };
}

export async function cleanupCallRoom(request) {
  const { config, call, conversation } = await requireCallContext(request);
  if (!TERMINAL_STATUSES.has(call.status) && conversation.status !== "blocked") {
    throw new CallRequestError("End the call before closing its room.", "CALL_STILL_ACTIVE", 409);
  }
  const rooms = new RoomServiceClient(config.serverUrl, config.apiKey, config.apiSecret);
  // LiveKit Cloud revokes cached/refreshed join tokens by their nbf timestamp.
  // Move the cutoff past the current second to reject a token minted this same
  // second as the hang-up. No future token is issued for this terminal call.
  const revokeTokenTs = BigInt(Math.floor(Date.now() / 1000) + 1);
  for (const identity of [call.caller_id, call.callee_id]) {
    try { await rooms.removeParticipant(`trainer-call-${call.id}`, identity, { revokeTokenTs }); }
    catch (error) {
      if (!error || typeof error !== "object" || !("code" in error) || error.code !== "not_found") throw error;
    }
  }
  try { await rooms.deleteRoom(`trainer-call-${call.id}`); }
  catch (error) {
    // Twirp's not_found is the only safe idempotent exception. Authentication,
    // connectivity and other service failures must still reach the client.
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "not_found") throw error;
  }
  return { ok: true };
}

export function sendCallError(response, error: unknown) {
  if (error instanceof CallRequestError) {
    return response.status(error.status).json({ error: { code: error.code, message: error.message } });
  }
  return response.status(503).json({ error: { code: "CALLS_UNAVAILABLE", message: "Calls are temporarily unavailable. Please try again." } });
}
