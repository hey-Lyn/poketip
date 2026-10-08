import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrainerCall } from "../services/calls";
import type { Conversation } from "../services/messages";

const mocks = vi.hoisted(() => ({ config: vi.fn(), list: vi.fn(), request: vi.fn(), respond: vi.fn(), token: vi.fn(), cleanup: vi.fn(), heartbeat: vi.fn(), watch: vi.fn(), conversations: vi.fn(), Room: vi.fn() }));
vi.mock("../services/calls", async (original) => ({
  ...await original<typeof import("../services/calls")>(),
  getCallConfiguration: mocks.config, listCalls: mocks.list, startCall: mocks.request, respondCall: mocks.respond,
  getCallToken: mocks.token, cleanupCall: mocks.cleanup, heartbeatCall: mocks.heartbeat, watchCalls: mocks.watch,
}));
vi.mock("../services/messages", () => ({ listConversations: mocks.conversations }));
vi.mock("livekit-client", () => ({ Room: mocks.Room, RoomEvent: {
  Reconnecting: "reconnecting", Reconnected: "reconnected", Disconnected: "disconnected",
  LocalTrackPublished: "localTrackPublished", LocalTrackUnpublished: "localTrackUnpublished", TrackMuted: "trackMuted", TrackUnmuted: "trackUnmuted",
} }));
vi.mock("./CallPanel", () => ({ default: () => null }));
import CallProvider from "./CallProvider";
import { useTrainerCall } from "../contexts/CallContext";

const conversation: Conversation = {
  id: "conversation-1", initiator_id: "me", recipient_id: "peer", status: "accepted", blocked_by: null,
  updated_at: "2026-10-07T12:00:00Z", peer_id: "peer", peer_username: "misty", peer_name: "Misty", peer_avatar: null,
  last_body: null, unread_count: 0,
};
const ringing: TrainerCall = {
  id: "call-1", conversation_id: conversation.id, caller_id: "me", callee_id: "peer", mode: "video", status: "ringing",
  created_at: "2026-10-07T12:00:00Z", expires_at: "2026-10-07T12:00:45Z", accepted_at: null, ended_at: null,
};
const accepted: TrainerCall = { ...ringing, status: "accepted", accepted_at: "2026-10-07T12:00:10Z" };
const ended: TrainerCall = { ...accepted, status: "ended", ended_at: "2026-10-07T12:01:00Z" };

function createRoom() {
  const events = new Map<string, () => void>();
  const localParticipant = { isMicrophoneEnabled: false, isCameraEnabled: false, setMicrophoneEnabled: vi.fn(), setCameraEnabled: vi.fn() };
  localParticipant.setMicrophoneEnabled.mockImplementation(async (enabled: boolean) => { localParticipant.isMicrophoneEnabled = enabled; });
  localParticipant.setCameraEnabled.mockImplementation(async (enabled: boolean) => { localParticipant.isCameraEnabled = enabled; });
  const room = {
    localParticipant, connect: vi.fn().mockResolvedValue(undefined), disconnect: vi.fn().mockResolvedValue(undefined),
    removeAllListeners: vi.fn(), on: vi.fn(), events,
  };
  room.on.mockImplementation((event: string, callback: () => void) => { events.set(event, callback); return room; });
  return room;
}
let rooms: ReturnType<typeof createRoom>[];

function Controls() {
  const call = useTrainerCall();
  return <>
    <output data-testid="available">{String(call.available)}</output>
    <output data-testid="checking">{String(call.checking)}</output>
    <output data-testid="status">{call.activeCall?.status ?? "none"}</output>
    <output data-testid="connection">{call.connectionState}</output>
    <output data-testid="microphone">{String(call.microphoneEnabled)}</output>
    <output data-testid="camera">{String(call.cameraEnabled)}</output>
    <output data-testid="media-error">{call.mediaError}</output>
    <output data-testid="error">{call.error}</output>
    <button onClick={() => void call.startCall(conversation, "video")}>Start video call</button>
    <button onClick={() => void call.acceptCall()}>Join call</button>
    <button onClick={() => void call.endCall()}>End call</button>
    <button onClick={() => void call.toggleMicrophone()}>Toggle microphone</button>
  </>;
}
function page(userId: string | null = "me") {
  return render(<CallProvider userId={userId}><Controls /></CallProvider>);
}
async function refresh() {
  await act(async () => { mocks.watch.mock.calls[0][1](); });
}

describe("call media lifecycle", () => {
  beforeEach(() => {
    vi.resetAllMocks(); rooms = [];
    mocks.config.mockResolvedValue({ available: true }); mocks.list.mockResolvedValue([]);
    mocks.request.mockResolvedValue(ringing); mocks.respond.mockResolvedValue(accepted);
    mocks.token.mockResolvedValue({ token: "room-token", url: "wss://example.livekit.cloud" });
    mocks.cleanup.mockResolvedValue(undefined); mocks.heartbeat.mockResolvedValue(undefined); mocks.watch.mockReturnValue(() => {});
    mocks.conversations.mockResolvedValue([conversation]);
    mocks.Room.mockImplementation(function () { const room = createRoom(); rooms.push(room); return room; });
  });

  it("never opens media while an outgoing call is ringing, then joins when the peer accepts", async () => {
    const user = userEvent.setup(); page();
    await waitFor(() => expect(screen.getByTestId("available")).toHaveTextContent("true"));
    await user.click(screen.getByRole("button", { name: "Start video call" }));
    expect(screen.getByTestId("status")).toHaveTextContent("ringing");
    expect(mocks.request).toHaveBeenCalledWith(conversation.id, "video");
    expect(mocks.token).not.toHaveBeenCalled(); expect(mocks.Room).not.toHaveBeenCalled();
    mocks.list.mockResolvedValue([accepted]); await refresh();
    await waitFor(() => expect(screen.getByTestId("microphone")).toHaveTextContent("true"));
    expect(mocks.token).toHaveBeenCalledWith(ringing.id);
    expect(rooms[0].connect).toHaveBeenCalledWith("wss://example.livekit.cloud", "room-token");
    expect(rooms[0].localParticipant.setCameraEnabled).not.toHaveBeenCalled();
    expect(screen.getByTestId("camera")).toHaveTextContent("false");
  });

  it("requires an explicit acceptance before joining an incoming call", async () => {
    const user = userEvent.setup(); const incoming = { ...ringing, caller_id: "peer", callee_id: "me" };
    mocks.list.mockResolvedValue([incoming]); page();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("ringing"));
    expect(mocks.token).not.toHaveBeenCalled(); expect(mocks.Room).not.toHaveBeenCalled();
    const incomingAccepted = { ...accepted, caller_id: "peer", callee_id: "me" };
    mocks.respond.mockResolvedValue(incomingAccepted); mocks.list.mockResolvedValue([incomingAccepted]);
    await user.click(screen.getByRole("button", { name: "Join call" }));
    await waitFor(() => expect(screen.getByTestId("connection")).toHaveTextContent("connected"));
    expect(mocks.respond).toHaveBeenCalledWith(ringing.id, "accept");
    expect(rooms[0].localParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true, expect.objectContaining({ echoCancellation: true, noiseSuppression: true }));
  });

  it("does not resume capture from an accepted call discovered after reload until the user rejoins", async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([accepted]); page();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("accepted"));
    expect(screen.getByTestId("connection")).toHaveTextContent("disconnected");
    expect(mocks.token).not.toHaveBeenCalled(); expect(mocks.Room).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Join call" }));
    await waitFor(() => expect(screen.getByTestId("microphone")).toHaveTextContent("true"));
    expect(mocks.respond).not.toHaveBeenCalled();
  });

  it("cannot connect or capture if the user ends the call while credentials are pending", async () => {
    const user = userEvent.setup(); let deliverToken;
    mocks.token.mockImplementation(() => new Promise((resolve) => { deliverToken = resolve; }));
    mocks.list.mockResolvedValue([accepted]); page();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("accepted"));
    await user.click(screen.getByRole("button", { name: "Join call" }));
    await waitFor(() => expect(mocks.token).toHaveBeenCalledTimes(1));
    mocks.respond.mockResolvedValue(ended); mocks.list.mockResolvedValue([ended]);
    await user.click(screen.getByRole("button", { name: "End call" }));
    await act(async () => { deliverToken({ token: "late-token", url: "wss://example.livekit.cloud" }); });
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("none"));
    expect(mocks.Room).not.toHaveBeenCalled();
    expect(screen.getByTestId("microphone")).toHaveTextContent("false");
  });

  it("disconnects and releases tracks when the provider unmounts", async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([accepted]); const result = page();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("accepted"));
    await user.click(screen.getByRole("button", { name: "Join call" }));
    await waitFor(() => expect(screen.getByTestId("microphone")).toHaveTextContent("true"));
    result.unmount();
    expect(rooms[0].removeAllListeners).toHaveBeenCalled(); expect(rooms[0].disconnect).toHaveBeenCalledWith(true);
    expect(mocks.respond).toHaveBeenCalledWith(accepted.id, "end");
  });

  it("does not publish media after a delayed connection finishes for an ended call", async () => {
    const user = userEvent.setup(); let finishConnection;
    mocks.Room.mockImplementation(function () {
      const room = createRoom();
      room.connect.mockImplementation(() => new Promise((resolve) => { finishConnection = resolve; }));
      rooms.push(room); return room;
    });
    mocks.list.mockResolvedValue([accepted]); page();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("accepted"));
    await user.click(screen.getByRole("button", { name: "Join call" }));
    await waitFor(() => expect(rooms[0]?.connect).toHaveBeenCalled());
    mocks.respond.mockResolvedValue(ended); mocks.list.mockResolvedValue([ended]);
    await user.click(screen.getByRole("button", { name: "End call" }));
    await act(async () => { finishConnection(); });
    expect(rooms[0].localParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
    expect(rooms[0].localParticipant.setCameraEnabled).not.toHaveBeenCalled();
    expect(rooms[0].disconnect).toHaveBeenCalledWith(true);
  });

  it("keeps a connected call when the page content changes", async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([accepted]); const result = page();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("accepted"));
    await user.click(screen.getByRole("button", { name: "Join call" }));
    await waitFor(() => expect(screen.getByTestId("microphone")).toHaveTextContent("true"));
    result.rerender(<CallProvider userId="me"><Controls /><p>Another page</p></CallProvider>);
    expect(screen.getByTestId("connection")).toHaveTextContent("connected");
    expect(rooms[0].disconnect).not.toHaveBeenCalled(); expect(mocks.Room).toHaveBeenCalledTimes(1);
  });

  it("does not subscribe or start a database call when LiveKit is unavailable", async () => {
    const user = userEvent.setup(); mocks.config.mockResolvedValue({ available: false }); page();
    await waitFor(() => expect(screen.getByTestId("checking")).toHaveTextContent("false"));
    expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.watch).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Start video call" }));
    expect(mocks.request).not.toHaveBeenCalled(); expect(mocks.Room).not.toHaveBeenCalled();
    expect(screen.getByTestId("error")).toHaveTextContent("Calls are currently unavailable.");
  });

  it("releases media and clears the previous user's call state on logout", async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([accepted]); const result = page();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("accepted"));
    await user.click(screen.getByRole("button", { name: "Join call" }));
    await waitFor(() => expect(screen.getByTestId("microphone")).toHaveTextContent("true"));
    result.rerender(<CallProvider userId={null}><Controls /></CallProvider>);
    expect(rooms[0].disconnect).toHaveBeenCalledWith(true);
    expect(screen.getByTestId("status")).toHaveTextContent("none");
    expect(screen.getByTestId("available")).toHaveTextContent("false");
    expect(screen.getByTestId("microphone")).toHaveTextContent("false");
    expect(mocks.respond).toHaveBeenCalledWith(accepted.id, "end");
  });

  it("keeps the microphone state truthful when muting fails", async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([accepted]); page();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("accepted"));
    await user.click(screen.getByRole("button", { name: "Join call" }));
    await waitFor(() => expect(screen.getByTestId("microphone")).toHaveTextContent("true"));
    rooms[0].localParticipant.setMicrophoneEnabled.mockRejectedValueOnce(new DOMException("Device busy", "NotReadableError"));
    await user.click(screen.getByRole("button", { name: "Toggle microphone" }));
    await waitFor(() => expect(screen.getByTestId("media-error")).toHaveTextContent("in use by another app"));
    expect(screen.getByTestId("microphone")).toHaveTextContent("true");
    expect(rooms[0].localParticipant.setMicrophoneEnabled).toHaveBeenLastCalledWith(false);
  });

  it("shows reconnection without ending the accepted call", async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([accepted]); page();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("accepted"));
    await user.click(screen.getByRole("button", { name: "Join call" }));
    await waitFor(() => expect(screen.getByTestId("microphone")).toHaveTextContent("true"));
    act(() => { rooms[0].events.get("reconnecting")?.(); });
    expect(screen.getByTestId("connection")).toHaveTextContent("reconnecting");
    expect(mocks.respond).not.toHaveBeenCalled(); expect(rooms[0].disconnect).not.toHaveBeenCalled();
    act(() => { rooms[0].events.get("reconnected")?.(); });
    expect(screen.getByTestId("connection")).toHaveTextContent("connected");
  });
});
