import { getAccessToken, getSupabase } from "./auth";

export type CallMode = "audio" | "video";
export type CallStatus = "ringing" | "accepted" | "declined" | "canceled" | "ended" | "missed";
export interface TrainerCall {
  id: string;
  conversation_id: string;
  caller_id: string;
  callee_id: string;
  mode: CallMode;
  status: CallStatus;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
  ended_at: string | null;
}
export type CallAction = "accept" | "decline" | "cancel" | "end";

export function isActiveCall(call: TrainerCall) {
  return call.status === "ringing" || call.status === "accepted";
}

async function callApi(path: string, body?: object) {
  const token = await getAccessToken();
  if (!token) throw new Error("Sign in to use calls.");
  const response = await fetch(`/api/calls/${path}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
  });
  let data;
  try { data = await response.json(); }
  catch { throw new Error("Calls are temporarily unavailable. Please try again."); }
  if (!response.ok) throw new Error(data?.error?.message || "Unable to connect this call. Please try again.");
  return data;
}

export async function getCallConfiguration(): Promise<{ available: boolean }> {
  const config = await callApi("config");
  return { available: config?.available === true };
}
export async function getCallToken(callId: string): Promise<{ token: string; url: string }> {
  const data = await callApi("token", { callId });
  if (typeof data?.token !== "string" || typeof data?.url !== "string") throw new Error("Unable to connect this call.");
  return data;
}
export async function cleanupCall(callId: string) {
  await callApi("cleanup", { callId });
}

async function rpc(name: string, args = {}) {
  const client = getSupabase();
  if (!client) throw new Error("Sign in to use calls.");
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const reasons: Record<string, string> = {
      AUTH_REQUIRED: "Sign in to use calls.",
      CONVERSATION_UNAVAILABLE: "This conversation is no longer available for calls.",
      PROFILE_UNAVAILABLE: "Both trainers must enable their shared profiles to use calls.",
      CALL_BUSY: "One of you is already in a call. Try again later.",
      CALL_RATE_LIMIT: "Too many call attempts. Wait a minute and try again.",
      CALL_UNAVAILABLE: "This call has already ended or is unavailable.",
      INVALID_CALL_ACTION: "This call has changed. Please try again.",
    };
    throw new Error(reasons[error.message] || "Unable to update this call. Please try again.");
  }
  return data;
}
export async function listCalls(): Promise<TrainerCall[]> {
  return (await rpc("list_trainer_calls")) ?? [];
}
export async function startCall(conversationId: string, mode: CallMode): Promise<TrainerCall> {
  const data = await rpc("start_trainer_call", { p_conversation: conversationId, p_mode: mode });
  return Array.isArray(data) ? data[0] : data;
}
export async function respondCall(callId: string, action: CallAction): Promise<TrainerCall> {
  const data = await rpc("respond_trainer_call", { p_call: callId, p_action: action });
  return Array.isArray(data) ? data[0] : data;
}
export async function heartbeatCall(callId: string) {
  await rpc("heartbeat_trainer_call", { p_call: callId });
}
export function watchCalls(userId: string, onChange: () => void) {
  const client = getSupabase();
  if (!client) return () => {};
  const channel = client.channel(`trainer-calls-${userId}-${crypto.randomUUID()}`);
  for (const event of ["INSERT", "UPDATE"] as const) for (const participant of ["caller_id", "callee_id"]) {
    channel.on("postgres_changes", { event, schema: "public", table: "trainer_calls", filter: `${participant}=eq.${userId}` }, onChange);
  }
  channel.subscribe((status) => { if (status === "SUBSCRIBED") onChange(); });
  return () => { void client.removeChannel(channel); };
}
