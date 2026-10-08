import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoomEvent, Track } from "livekit-client";
import type { Room } from "livekit-client";
import type { TrainerCallContext } from "../contexts/CallContext";
import type { TrainerCall } from "../services/calls";
import type { Conversation } from "../services/messages";
const mocks = vi.hoisted(() => ({ context: vi.fn() }));
vi.mock("../contexts/CallContext", () => ({ useTrainerCall: mocks.context }));
import CallPanel from "./CallPanel";

const peer: Conversation = { id: "conversation", initiator_id: "me", recipient_id: "misty", status: "accepted", blocked_by: null,
  updated_at: "2026-10-07T12:00:00Z", peer_id: "misty", peer_username: "misty", peer_name: "Misty", peer_avatar: null, last_body: null, unread_count: 0 };
const incoming: TrainerCall = { id: "call", conversation_id: "conversation", caller_id: "misty", callee_id: "me", mode: "video", status: "ringing",
  created_at: "2026-10-07T12:00:00Z", expires_at: "2026-10-07T12:01:00Z", accepted_at: null, ended_at: null };
let state: TrainerCallContext;

function mediaRoom() {
  const remoteAudio = { attach: vi.fn(), detach: vi.fn() } as unknown as Track;
  const remoteVideo = { attach: vi.fn(), detach: vi.fn() } as unknown as Track;
  const localVideo = { attach: vi.fn(), detach: vi.fn() } as unknown as Track;
  const remoteCamera = { track: remoteVideo as Track | null, isMuted: false };
  const listeners = new Map<string, Set<() => void>>();
  const room = {
    canPlaybackAudio: true,
    remoteParticipants: new Map([["misty", { isSpeaking: false, isMicrophoneEnabled: true,
      getTrackPublication: (source: Track.Source) => source === Track.Source.Camera ? remoteCamera : { track: remoteAudio, isMuted: false } }]]),
    localParticipant: { getTrackPublication: () => ({ track: localVideo, isMuted: false }) },
    on: vi.fn((event: string, listener: () => void) => { const group = listeners.get(event) ?? new Set(); group.add(listener); listeners.set(event, group); }),
    off: vi.fn((event: string, listener: () => void) => { listeners.get(event)?.delete(listener); }),
    startAudio: vi.fn(async () => { room.canPlaybackAudio = true; listeners.get(RoomEvent.AudioPlaybackStatusChanged)?.forEach((listener) => listener()); }),
  };
  return { room: room as unknown as Room, raw: room, remoteAudio, remoteVideo, localVideo, remoteCamera,
    emit: (event: RoomEvent) => listeners.get(event)?.forEach((listener) => listener()) };
}

describe("trainer call panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state = { userId: "me", available: true, checking: false, calls: [incoming], activeCall: incoming, peer, room: null, busy: false,
      error: "", mediaError: "", connectionState: "disconnected", microphoneEnabled: false, cameraEnabled: false, minimized: false,
      startCall: vi.fn().mockResolvedValue(undefined), acceptCall: vi.fn().mockResolvedValue(undefined), declineCall: vi.fn().mockResolvedValue(undefined),
      endCall: vi.fn().mockResolvedValue(undefined), toggleMicrophone: vi.fn().mockResolvedValue(undefined), toggleCamera: vi.fn().mockResolvedValue(undefined), setMinimized: vi.fn(), dismissError: vi.fn() };
    mocks.context.mockImplementation(() => state);
  });
  it("only exposes answer and decline before accepting a received call", async () => {
    const user = userEvent.setup(); render(<CallPanel />);
    expect(screen.getByRole("status")).toHaveTextContent("Incoming video call");
    expect(screen.queryByRole("button", { name: "Turn camera on" })).not.toBeInTheDocument();
    expect(document.querySelector("video, audio")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Accept" })); expect(state.acceptCall).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Decline" })); expect(state.declineCall).toHaveBeenCalledOnce();
  });
  it("allows canceling an outgoing call without opening media", async () => {
    state.activeCall = { ...incoming, caller_id: "me", callee_id: "misty" };
    const user = userEvent.setup(); render(<CallPanel />);
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel call" })); expect(state.endCall).toHaveBeenCalledOnce();
    expect(document.querySelector("video, audio")).toBeNull();
  });
  it("requires an explicit join when an accepted call was recovered after a reload", async () => {
    state.activeCall = { ...incoming, status: "accepted" };
    const user = userEvent.setup(); render(<CallPanel />);
    expect(screen.getByRole("status")).toHaveTextContent("Ready to join");
    expect(screen.queryByRole("button", { name: "Unmute microphone" })).not.toBeInTheDocument();
    expect(state.acceptCall).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Join call" })); expect(state.acceptCall).toHaveBeenCalledOnce();
  });
  it("keeps ending available while connecting and disables device controls", async () => {
    state.activeCall = { ...incoming, status: "accepted" }; state.room = mediaRoom().room; state.busy = true; state.connectionState = "connecting";
    const user = userEvent.setup(); render(<CallPanel />);
    expect(screen.getByRole("button", { name: "Unmute microphone" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Turn camera on" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "End call" })); expect(state.endCall).toHaveBeenCalledOnce();
  });
  it("keeps remote audio attached while minimized and detaches tracks on teardown", () => {
    const media = mediaRoom(); state.activeCall = { ...incoming, status: "accepted" }; state.room = media.room; state.connectionState = "connected";
    const view = render(<CallPanel />);
    expect(media.remoteAudio.attach).toHaveBeenCalledOnce(); expect(media.remoteVideo.attach).toHaveBeenCalledOnce();
    const audio = document.querySelector("audio");
    state = { ...state, minimized: true }; view.rerender(<CallPanel />);
    expect(document.querySelector("audio")).toBe(audio); expect(document.querySelector("video")).toBeNull();
    expect(media.remoteAudio.detach).not.toHaveBeenCalled(); expect(media.remoteVideo.detach).toHaveBeenCalledOnce();
    view.unmount(); expect(media.remoteAudio.detach).toHaveBeenCalledWith(audio); expect(media.raw.off).toHaveBeenCalledTimes(media.raw.on.mock.calls.length);
  });
  it("removes a video that the other trainer has stopped and offers audio playback unlock", async () => {
    const media = mediaRoom(); media.raw.canPlaybackAudio = false;
    state.activeCall = { ...incoming, status: "accepted" }; state.room = media.room; state.connectionState = "connected";
    const user = userEvent.setup(); render(<CallPanel />);
    const remoteVideo = screen.getByLabelText("Misty's camera");
    media.remoteCamera.track = null; act(() => media.emit(RoomEvent.TrackUnsubscribed));
    expect(screen.queryByLabelText("Misty's camera")).not.toBeInTheDocument(); expect(media.remoteVideo.detach).toHaveBeenCalledWith(remoteVideo);
    await user.click(screen.getByRole("button", { name: "Click to hear the call" }));
    expect(media.raw.startAudio).toHaveBeenCalledOnce(); expect(screen.queryByRole("button", { name: "Click to hear the call" })).not.toBeInTheDocument();
  });
  it("never offers a camera toggle in voice calls", () => {
    state.activeCall = { ...incoming, mode: "audio", status: "accepted" }; state.room = mediaRoom().room; state.connectionState = "connected";
    render(<CallPanel />);
    expect(screen.queryByRole("button", { name: /camera/u })).not.toBeInTheDocument(); expect(document.querySelector("video")).toBeNull();
  });
});
