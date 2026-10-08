import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), createRoom: vi.fn(), deleteRoom: vi.fn(), removeParticipant: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("livekit-server-sdk", async importOriginal => ({
  ...await importOriginal<typeof import("livekit-server-sdk")>(),
  RoomServiceClient: class { createRoom = mocks.createRoom; deleteRoom = mocks.deleteRoom; removeParticipant = mocks.removeParticipant; },
}));
import { cleanupCallRoom, createCallToken, getCallConfig } from "./calls";
import tokenHandler from "../calls/token";
import configHandler from "../calls/config";
import cleanupHandler from "../calls/cleanup";

const callId = "e1000000-0000-0000-0000-000000000001";
const conversationId = "e2000000-0000-0000-0000-000000000001";
const caller = "e0000000-0000-0000-0000-000000000001";
const callee = "e0000000-0000-0000-0000-000000000002";
const stranger = "e0000000-0000-0000-0000-000000000003";
const request = () => ({ method: "POST", headers: { authorization: "Bearer verified-session" }, body: { callId } });
const originalEnv = { ...process.env };

function clientFixture(overrides: { user?: string; authError?: boolean; call?: object | null; conversation?: object | null; profiles?: object[]; queryError?: boolean } = {}) {
  const call = { id: callId, conversation_id: conversationId, caller_id: caller, callee_id: callee,
    status: "accepted", mode: "video", expires_at: new Date(Date.now() + 90_000).toISOString(), ...overrides.call };
  const conversation = { id: conversationId, initiator_id: caller, recipient_id: callee, status: "accepted", ...overrides.conversation };
  const profiles = overrides.profiles ?? [{ id: caller, social_enabled: true }, { id: callee, social_enabled: true }];
  const getUser = vi.fn().mockResolvedValue(overrides.authError
    ? { data: { user: null }, error: { message: "invalid" } }
    : { data: { user: { id: overrides.user ?? caller } }, error: null });
  const from = vi.fn((table: string) => ({ select: () => ({
    eq: () => ({ maybeSingle: async () => ({ data: table === "trainer_calls"
      ? overrides.call === null ? null : call : overrides.conversation === null ? null : conversation,
      error: overrides.queryError ? { message: "private DB detail" } : null }) }),
    in: async () => ({ data: profiles, error: null }),
  }) }));
  mocks.createClient.mockReturnValue({ auth: { getUser }, from });
  return { getUser, from, call, conversation, profiles };
}

function response() {
  return {
    headers: {} as Record<string, string>, statusCode: 200, payload: undefined as any,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // The repo uses jsdom for every test. jose needs Node's typed-array realm for
  // actual server-side JWT signing rather than jsdom's Uint8Array constructor.
  vi.stubGlobal("Uint8Array", Object.getPrototypeOf(Buffer.prototype).constructor);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  process.env.LIVEKIT_URL = "wss://calls.livekit.cloud";
  process.env.LIVEKIT_API_KEY = "test-api-key";
  process.env.LIVEKIT_API_SECRET = "server-only-secret-at-least-32-characters";
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "server-only-supabase-key";
  mocks.createRoom.mockResolvedValue({});
  mocks.deleteRoom.mockResolvedValue(undefined);
  mocks.removeParticipant.mockResolvedValue(undefined);
});
afterEach(() => { process.env = { ...originalEnv }; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("call authorization and LiveKit tokens", () => {
  it("issues a short-lived token only for the accepted participant and room", async () => {
    const fixture = clientFixture();
    const result = await createCallToken(request());
    const payload = JSON.parse(Buffer.from(result.token.split(".")[1], "base64url").toString());
    expect(fixture.getUser).toHaveBeenCalledWith("verified-session");
    expect(result.url).toBe("wss://calls.livekit.cloud");
    expect(payload.sub).toBe(caller);
    expect(payload.exp - payload.nbf).toBeLessThanOrEqual(60);
    expect(payload.video).toEqual({ room: `trainer-call-${callId}`, roomJoin: true,
      canPublish: true, canSubscribe: true, canPublishData: false, canUpdateOwnMetadata: false,
      canPublishSources: ["microphone", "camera"] });
    expect(mocks.createRoom).toHaveBeenCalledWith({ name: `trainer-call-${callId}`, maxParticipants: 2, emptyTimeout: 90, departureTimeout: 20 });
    expect(JSON.stringify(result)).not.toContain(process.env.LIVEKIT_API_SECRET);
    expect(JSON.stringify(result)).not.toContain(process.env.SUPABASE_SERVICE_ROLE_KEY);
  });
  it("limits audio calls to microphone publishing", async () => {
    clientFixture({ user: callee, call: { mode: "audio" } });
    const result = await createCallToken(request());
    const payload = JSON.parse(Buffer.from(result.token.split(".")[1], "base64url").toString());
    expect(payload.sub).toBe(callee);
    expect(payload.video.canPublishSources).toEqual(["microphone"]);
  });
  it("requires server-verified Bearer authentication before reading call data", async () => {
    const fixture = clientFixture({ authError: true });
    await expect(createCallToken({ ...request(), headers: {} })).rejects.toMatchObject({ code: "AUTH_REQUIRED", status: 401 });
    await expect(createCallToken(request())).rejects.toMatchObject({ code: "AUTH_INVALID", status: 401 });
    expect(fixture.from).not.toHaveBeenCalled();
    expect(mocks.createRoom).not.toHaveBeenCalled();
  });
  it.each([{}, { callId: "../../room" }, null, []])("rejects invalid identifiers without querying the database: %j", async body => {
    clientFixture();
    await expect(createCallToken({ ...request(), body })).rejects.toMatchObject({ code: "INVALID_CALL_REQUEST", status: 400 });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("rejects an unrelated signed-in user", async () => {
    clientFixture({ user: stranger });
    await expect(createCallToken(request())).rejects.toMatchObject({ code: "CALL_UNAVAILABLE", status: 403 });
    expect(mocks.createRoom).not.toHaveBeenCalled();
  });
  it.each([
    { call: null }, { call: { status: "ringing" } }, { call: { status: "ended" } },
    { call: { expires_at: new Date(0).toISOString() } }, { call: { expires_at: "invalid" } },
    { conversation: { status: "blocked" } }, { conversation: { recipient_id: stranger } },
    { profiles: [{ id: caller, social_enabled: true }, { id: callee, social_enabled: false }] },
  ])("denies unavailable or unconsented calls before creating rooms: %j", async override => {
    clientFixture(override);
    await expect(createCallToken(request())).rejects.toMatchObject({ code: "CALL_UNAVAILABLE", status: 403 });
    expect(mocks.createRoom).not.toHaveBeenCalled();
  });
  it("rechecks consent after provisioning a room", async () => {
    const fixture = clientFixture();
    mocks.createRoom.mockImplementationOnce(async () => { fixture.conversation.status = "blocked"; return {}; });
    await expect(createCallToken(request())).rejects.toMatchObject({ code: "CALL_UNAVAILABLE", status: 403 });
  });
  it("fails closed when the backend is not configured", async () => {
    clientFixture();
    delete process.env.LIVEKIT_API_SECRET;
    expect(getCallConfig()).toBeNull();
    await expect(createCallToken(request())).rejects.toMatchObject({ code: "CALLS_NOT_CONFIGURED", status: 503 });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
});

describe("call room cleanup", () => {
  it.each(["declined", "canceled", "ended", "missed"])("deletes only the participant's exact terminal room: %s", async status => {
    clientFixture({ call: { status } });
    expect(await cleanupCallRoom(request())).toEqual({ ok: true });
    expect(mocks.removeParticipant).toHaveBeenCalledWith(`trainer-call-${callId}`, caller, { revokeTokenTs: expect.any(BigInt) });
    expect(mocks.removeParticipant).toHaveBeenCalledWith(`trainer-call-${callId}`, callee, { revokeTokenTs: expect.any(BigInt) });
    expect(mocks.deleteRoom).toHaveBeenCalledWith(`trainer-call-${callId}`);
  });
  it("allows cleanup after the conversation is blocked", async () => {
    clientFixture({ conversation: { status: "blocked" } });
    await cleanupCallRoom(request());
    expect(mocks.deleteRoom).toHaveBeenCalledOnce();
  });
  it("rejects a stranger or a still-active call", async () => {
    clientFixture();
    await expect(cleanupCallRoom(request())).rejects.toMatchObject({ code: "CALL_STILL_ACTIVE", status: 409 });
    clientFixture({ user: stranger, call: { status: "ended" } });
    await expect(cleanupCallRoom(request())).rejects.toMatchObject({ code: "CALL_UNAVAILABLE", status: 403 });
    expect(mocks.deleteRoom).not.toHaveBeenCalled();
    expect(mocks.removeParticipant).not.toHaveBeenCalled();
  });
  it("revokes identities even when they have already left the room", async () => {
    clientFixture({ call: { status: "ended" } });
    mocks.removeParticipant.mockRejectedValue({ code: "not_found" });
    await cleanupCallRoom(request());
    expect(mocks.removeParticipant).toHaveBeenCalledTimes(2);
    expect(mocks.deleteRoom).toHaveBeenCalledOnce();
  });
  it("treats a missing room as success but preserves service failures", async () => {
    clientFixture({ call: { status: "ended" } });
    mocks.deleteRoom.mockRejectedValueOnce({ code: "not_found" });
    expect(await cleanupCallRoom(request())).toEqual({ ok: true });
    mocks.deleteRoom.mockRejectedValueOnce(new Error("service secret internals"));
    await expect(cleanupCallRoom(request())).rejects.toThrow("service secret internals");
  });
});

describe("call API handlers", () => {
  it.each([[configHandler, "POST", "GET"], [tokenHandler, "GET", "POST"], [cleanupHandler, "GET", "POST"]] as const)(
    "restricts methods and always disables response caching", async (handler, method, allow) => {
      const res = response();
      await handler({ method }, res);
      expect(res.statusCode).toBe(405);
      expect(res.headers).toEqual({ "Cache-Control": "no-store", Allow: allow });
    });
  it("returns only availability and never includes configuration secrets", async () => {
    const res = response();
    await configHandler({ method: "GET" }, res);
    expect(res.payload).toEqual({ available: true });
    delete process.env.LIVEKIT_API_KEY;
    await configHandler({ method: "GET" }, res);
    expect(res.payload).toEqual({ available: false });
  });
  it.each(["http://calls.example.com", "wss://user:secret@calls.example.com", "invalid"])("fails closed for insecure or malformed server URLs: %s", url => {
    process.env.LIVEKIT_URL = url;
    expect(getCallConfig()).toBeNull();
  });
  it("normalizes an https service URL to the secure websocket client URL", () => {
    process.env.LIVEKIT_URL = "https://calls.livekit.cloud/";
    expect(getCallConfig()?.url).toBe("wss://calls.livekit.cloud");
  });
  it("returns authorization errors with their status", async () => {
    const res = response();
    await tokenHandler({ method: "POST", headers: {}, body: { callId } }, res);
    expect(res.statusCode).toBe(401);
    expect(res.payload.error.code).toBe("AUTH_REQUIRED");
  });
  it("does not leak LiveKit or database error internals", async () => {
    clientFixture();
    mocks.createRoom.mockRejectedValueOnce(new Error("server-only-secret and request credentials"));
    const res = response();
    await tokenHandler(request(), res);
    expect(res.statusCode).toBe(503);
    expect(res.payload.error.code).toBe("CALLS_UNAVAILABLE");
    expect(JSON.stringify(res.payload)).not.toContain("server-only-secret");
    clientFixture({ queryError: true });
    await tokenHandler(request(), res);
    expect(res.statusCode).toBe(503);
    expect(JSON.stringify(res.payload)).not.toContain("private DB detail");
  });
});
