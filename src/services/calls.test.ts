import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getAccessToken: vi.fn(), getSupabase: vi.fn(), rpc: vi.fn(), fetch: vi.fn(), channel: vi.fn(), removeChannel: vi.fn() }));
vi.mock("./auth", () => ({ getAccessToken: mocks.getAccessToken, getSupabase: mocks.getSupabase }));
import { cleanupCall, getCallConfiguration, getCallToken, heartbeatCall, isActiveCall, listCalls, respondCall, startCall, watchCalls } from "./calls";
import type { TrainerCall } from "./calls";

function jsonResponse(data: unknown, ok = true) {
  return { ok, json: vi.fn().mockResolvedValue(data) };
}

describe("trainer calls service", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.getAccessToken.mockResolvedValue("session-token");
    mocks.getSupabase.mockReturnValue({ rpc: mocks.rpc, channel: mocks.channel, removeChannel: mocks.removeChannel });
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    mocks.fetch.mockResolvedValue(jsonResponse({ available: false }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it("requests credentials with the user's bearer token and never caches them", async () => {
    mocks.fetch.mockResolvedValue(jsonResponse({ token: "room-token", url: "wss://example.livekit.cloud" }));
    await expect(getCallToken("call-1")).resolves.toEqual({ token: "room-token", url: "wss://example.livekit.cloud" });
    expect(mocks.fetch).toHaveBeenCalledWith("/api/calls/token", {
      method: "POST", headers: { Authorization: "Bearer session-token", "Content-Type": "application/json" },
      body: JSON.stringify({ callId: "call-1" }), cache: "no-store",
    });
    await cleanupCall("call-1");
    expect(mocks.fetch).toHaveBeenLastCalledWith("/api/calls/cleanup", expect.objectContaining({ method: "POST", body: JSON.stringify({ callId: "call-1" }) }));
  });

  it("treats absent or nonboolean configuration as unavailable", async () => {
    await expect(getCallConfiguration()).resolves.toEqual({ available: false });
    expect(mocks.fetch).toHaveBeenCalledWith("/api/calls/config", {
      method: "GET", headers: { Authorization: "Bearer session-token" }, cache: "no-store",
    });
    mocks.fetch.mockResolvedValue(jsonResponse({ available: "true" }));
    await expect(getCallConfiguration()).resolves.toEqual({ available: false });
    mocks.fetch.mockResolvedValue(jsonResponse({ available: true }));
    await expect(getCallConfiguration()).resolves.toEqual({ available: true });
  });

  it("refuses token requests without sign-in and rejects malformed server credentials", async () => {
    mocks.getAccessToken.mockResolvedValue(null);
    await expect(getCallToken("call-1")).rejects.toThrow("Sign in to use calls.");
    expect(mocks.fetch).not.toHaveBeenCalled();
    mocks.getAccessToken.mockResolvedValue("session-token");
    mocks.fetch.mockResolvedValue(jsonResponse({ token: "room-token" }));
    await expect(getCallToken("call-1")).rejects.toThrow("Unable to connect this call.");
  });

  it("reports API errors and unreadable responses without claiming to connect", async () => {
    mocks.fetch.mockResolvedValue(jsonResponse({ error: { message: "This call has ended." } }, false));
    await expect(getCallToken("call-1")).rejects.toThrow("This call has ended.");
    mocks.fetch.mockResolvedValue({ ok: false, json: vi.fn().mockRejectedValue(new SyntaxError("Invalid JSON")) });
    await expect(getCallConfiguration()).rejects.toThrow("Calls are temporarily unavailable.");
  });

  it("uses the scoped call RPCs and handles composite-row responses", async () => {
    const call = { id: "call-1", status: "ringing" };
    mocks.rpc.mockResolvedValueOnce({ data: [call], error: null });
    await expect(startCall("conversation-1", "video")).resolves.toEqual(call);
    expect(mocks.rpc).toHaveBeenLastCalledWith("start_trainer_call", { p_conversation: "conversation-1", p_mode: "video" });
    const accepted = { ...call, status: "accepted" };
    mocks.rpc.mockResolvedValueOnce({ data: accepted, error: null });
    await expect(respondCall("call-1", "accept")).resolves.toEqual(accepted);
    expect(mocks.rpc).toHaveBeenLastCalledWith("respond_trainer_call", { p_call: "call-1", p_action: "accept" });
    await heartbeatCall("call-1");
    expect(mocks.rpc).toHaveBeenLastCalledWith("heartbeat_trainer_call", { p_call: "call-1" });
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(listCalls()).resolves.toEqual([]);
    expect(mocks.rpc).toHaveBeenLastCalledWith("list_trainer_calls", {});
  });

  it("maps busy and unavailable conversations to useful errors", async () => {
    mocks.rpc.mockResolvedValue({ error: { message: "CALL_BUSY" } });
    await expect(startCall("conversation-1", "audio")).rejects.toThrow("One of you is already in a call.");
    mocks.rpc.mockResolvedValue({ error: { message: "CONVERSATION_UNAVAILABLE" } });
    await expect(respondCall("call-1", "accept")).rejects.toThrow("This conversation is no longer available for calls.");
    mocks.getSupabase.mockReturnValue(null);
    await expect(listCalls()).rejects.toThrow("Sign in to use calls.");
  });

  it("filters realtime events by participant and removes the subscription on cleanup", () => {
    const channel = { on: vi.fn(), subscribe: vi.fn() };
    channel.on.mockReturnValue(channel);
    mocks.channel.mockReturnValue(channel);
    const changed = vi.fn();
    const stop = watchCalls("me", changed);
    expect(channel.on).toHaveBeenCalledTimes(4);
    expect(channel.on).toHaveBeenCalledWith("postgres_changes", { event: "INSERT", schema: "public", table: "trainer_calls", filter: "caller_id=eq.me" }, changed);
    expect(channel.on).toHaveBeenCalledWith("postgres_changes", { event: "UPDATE", schema: "public", table: "trainer_calls", filter: "callee_id=eq.me" }, changed);
    channel.subscribe.mock.calls[0][0]("SUBSCRIBED");
    expect(changed).toHaveBeenCalledTimes(1);
    stop();
    expect(mocks.removeChannel).toHaveBeenCalledWith(channel);
  });

  it("recognizes only ringing and accepted calls as active", () => {
    for (const status of ["ringing", "accepted"] as const) expect(isActiveCall({ status } as TrainerCall)).toBe(true);
    for (const status of ["ended", "declined", "canceled", "missed"] as const) expect(isActiveCall({ status } as TrainerCall)).toBe(false);
  });
});
