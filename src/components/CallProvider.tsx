import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Room } from "livekit-client";
import { CallContext } from "../contexts/CallContext";
import { cleanupCall, getCallConfiguration, getCallToken, heartbeatCall, isActiveCall, listCalls, respondCall, startCall as requestCall, watchCalls } from "../services/calls";
import type { CallMode, TrainerCall } from "../services/calls";
import { listConversations } from "../services/messages";
import type { Conversation } from "../services/messages";
import { errorMessage } from "../services/errors";

const CallPanel = lazy(() => import("./CallPanel"));

function mediaFailure(error: unknown) {
  const name = error && typeof error === "object" && "name" in error ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") return "Allow microphone or camera access in your browser, then try the control again.";
  if (name === "NotFoundError" || name === "DevicesNotFoundError") return "No microphone or camera was found. Connect a device and try again.";
  if (name === "NotReadableError" || name === "TrackStartError") return "This device is in use by another app. Close it there and try again.";
  return "Unable to access this device. Check your browser permissions and try again.";
}

export default function CallProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  return <CallSession key={userId ?? "signed-out"} userId={userId}>{children}</CallSession>;
}

function CallSession({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(Boolean(userId));
  const [calls, setCalls] = useState<TrainerCall[]>([]);
  const [activeCall, setActiveCall] = useState<TrainerCall | null>(null);
  const [peer, setPeer] = useState<Conversation | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [mediaError, setMediaError] = useState("");
  const [connectionState, setConnectionState] = useState<"disconnected" | "connecting" | "connected" | "reconnecting">("disconnected");
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const currentCall = useRef<TrainerCall | null>(null);
  const currentRoom = useRef<Room | null>(null);
  const localIntent = useRef<string | null>(null);
  const connectingFor = useRef<string | null>(null);
  const mediaGeneration = useRef(0);
  const actionGeneration = useRef(0);
  const refreshVersion = useRef(0);
  const alive = useRef(true);

  const commitCall = useCallback((call: TrainerCall | null) => {
    currentCall.current = call;
    setActiveCall(call);
  }, []);
  const releaseRoom = useCallback(() => {
    ++mediaGeneration.current;
    connectingFor.current = null;
    const previous = currentRoom.current;
    currentRoom.current = null;
    previous?.removeAllListeners();
    void previous?.disconnect(true).catch(() => {});
    if (alive.current) {
      setRoom(null); setConnectionState("disconnected"); setMicrophoneEnabled(false); setCameraEnabled(false);
    }
  }, []);
  const closeServerRoom = useCallback((id: string) => {
    void cleanupCall(id).catch(() => {
      // The peer also disconnects on the terminal database event; cleanup is idempotent.
    });
  }, []);

  const connectToCall = useCallback(async (call: TrainerCall) => {
    if (localIntent.current !== call.id || connectingFor.current === call.id || !alive.current) return;
    connectingFor.current = call.id;
    const attempt = ++mediaGeneration.current;
    setConnectionState("connecting"); setMediaError("");
    const stillCurrent = () => alive.current && attempt === mediaGeneration.current && localIntent.current === call.id;
    let nextRoom: Room | null = null;
    try {
      const [{ Room: LiveKitRoom, RoomEvent }, credentials] = await Promise.all([import("livekit-client"), getCallToken(call.id)]);
      if (!stillCurrent()) return;
      nextRoom = new LiveKitRoom({ adaptiveStream: true, dynacast: true, videoCaptureDefaults: { resolution: { width: 1280, height: 720, frameRate: 24 } } });
      currentRoom.current = nextRoom;
      const updateDevices = () => {
        if (stillCurrent() && nextRoom) {
          setMicrophoneEnabled(nextRoom.localParticipant.isMicrophoneEnabled);
          setCameraEnabled(nextRoom.localParticipant.isCameraEnabled);
        }
      };
      nextRoom.on(RoomEvent.Reconnecting, () => { if (stillCurrent()) setConnectionState("reconnecting"); });
      nextRoom.on(RoomEvent.Reconnected, () => { if (stillCurrent()) setConnectionState("connected"); });
      nextRoom.on(RoomEvent.LocalTrackPublished, updateDevices);
      nextRoom.on(RoomEvent.LocalTrackUnpublished, updateDevices);
      nextRoom.on(RoomEvent.TrackMuted, updateDevices);
      nextRoom.on(RoomEvent.TrackUnmuted, updateDevices);
      nextRoom.on(RoomEvent.Disconnected, () => {
        if (!stillCurrent()) return;
        localIntent.current = null; releaseRoom();
        setError("The call disconnected. You can start a new call from the chat.");
        void respondCall(call.id, "end").then(() => closeServerRoom(call.id)).catch(() => {});
      });
      setRoom(nextRoom);
      await nextRoom.connect(credentials.url, credentials.token);
      if (!stillCurrent()) { await nextRoom.disconnect(true); return; }
      setConnectionState("connected");
      try {
        await nextRoom.localParticipant.setMicrophoneEnabled(true, { echoCancellation: true, noiseSuppression: true, autoGainControl: true });
        if (!stillCurrent()) { await nextRoom.disconnect(true); return; }
        updateDevices();
      } catch (deviceError) { if (stillCurrent()) setMediaError(mediaFailure(deviceError)); }
    } catch (requestError) {
      if (!stillCurrent()) { await nextRoom?.disconnect(true); return; }
      localIntent.current = null; releaseRoom();
      setError(errorMessage(requestError, "Unable to connect the call. Please try again."));
      void respondCall(call.id, "end").then(() => closeServerRoom(call.id)).catch(() => {});
    }
  }, [closeServerRoom, releaseRoom]);

  const refreshCalls = useCallback(async () => {
    const version = ++refreshVersion.current;
    try {
      const fresh = await listCalls();
      if (!alive.current || version !== refreshVersion.current) return;
      setCalls(fresh);
      const previous = currentCall.current;
      const active = fresh.find((call) => call.id === previous?.id && isActiveCall(call)) || fresh.find(isActiveCall) || null;
      if (previous && !fresh.some((call) => call.id === previous.id && isActiveCall(call))) {
        localIntent.current = null; releaseRoom(); closeServerRoom(previous.id);
        const terminal = fresh.find((call) => call.id === previous.id);
        if (terminal?.status === "declined") setError("The call was declined.");
        else if (terminal?.status === "missed") setError(previous.caller_id === userId ? "No answer. You can try again later." : "You missed a call. Open the chat to call back.");
      }
      commitCall(active);
      if (active && previous?.id !== active.id) {
        setMinimized(false); setPeer(null);
        const conversations = await listConversations();
        if (alive.current && currentCall.current?.id === active.id) setPeer(conversations.find((conversation) => conversation.id === active.conversation_id) ?? null);
      }
      if (active?.status === "accepted" && localIntent.current === active.id) void connectToCall(active);
    } catch {
      // Realtime and polling retry independently; an interrupted refresh must not stop a live call.
    }
  }, [closeServerRoom, commitCall, connectToCall, releaseRoom, userId]);

  useEffect(() => {
    if (!userId) return undefined;
    let active = true;
    getCallConfiguration().then((config) => { if (active) setAvailable(config.available); })
      .catch(() => { if (active) setAvailable(false); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, [userId]);
  useEffect(() => {
    if (!userId || !available) return undefined;
    let active = true;
    const versions = refreshVersion;
    queueMicrotask(() => { if (active) void refreshCalls(); });
    const stop = watchCalls(userId, () => { void refreshCalls(); });
    const recover = () => { void refreshCalls(); };
    window.addEventListener("focus", recover);
    const timer = window.setInterval(() => {
      if (currentCall.current || document.visibilityState === "visible") void refreshCalls();
    }, 5000);
    const heartbeat = window.setInterval(() => {
      const call = currentCall.current;
      if (call?.status === "accepted" && currentRoom.current) void heartbeatCall(call.id).catch(() => { void refreshCalls(); });
    }, 20000);
    return () => { active = false; ++versions.current; stop(); window.removeEventListener("focus", recover); window.clearInterval(timer); window.clearInterval(heartbeat); };
  }, [available, refreshCalls, userId]);
  useEffect(() => {
    alive.current = true;
    const actions = actionGeneration;
    const media = mediaGeneration;
    const refreshes = refreshVersion;
    return () => {
      alive.current = false;
      ++actions.current; ++media.current; ++refreshes.current;
      localIntent.current = null;
      const previous = currentRoom.current;
      currentRoom.current = null;
      previous?.removeAllListeners(); void previous?.disconnect(true).catch(() => {});
      const call = currentCall.current;
      if (call && previous) void respondCall(call.id, "end").then(() => closeServerRoom(call.id)).catch(() => {});
    };
  }, [closeServerRoom]);

  async function startCall(conversation: Conversation, mode: CallMode) {
    if (busy || currentCall.current) return;
    if (!available) { setError("Calls are currently unavailable. Please try again later."); return; }
    const attempt = ++actionGeneration.current;
    setBusy(true); setError(""); setMediaError("");
    try {
      const call = await requestCall(conversation.id, mode);
      if (!alive.current || attempt !== actionGeneration.current) { void respondCall(call.id, "cancel").catch(() => {}); return; }
      localIntent.current = call.id; commitCall(call); setPeer(conversation); setMinimized(false);
      setCalls((previous) => [call, ...previous.filter((entry) => entry.id !== call.id)]);
    } catch (requestError) { if (alive.current) setError(errorMessage(requestError, "Unable to start this call.")); }
    finally { if (alive.current && attempt === actionGeneration.current) setBusy(false); }
  }
  async function acceptCall() {
    const current = currentCall.current;
    if (!current || busy || !available) return;
    const attempt = ++actionGeneration.current;
    setBusy(true); setError("");
    try {
      const accepted = current.status === "accepted" ? current : await respondCall(current.id, "accept");
      if (!alive.current || attempt !== actionGeneration.current) return;
      localIntent.current = accepted.id; commitCall(accepted);
      await connectToCall(accepted);
      if (alive.current) void refreshCalls();
    } catch (requestError) { if (alive.current && attempt === actionGeneration.current) setError(errorMessage(requestError, "Unable to accept this call.")); }
    finally { if (alive.current && attempt === actionGeneration.current) setBusy(false); }
  }
  async function endCall() {
    const call = currentCall.current;
    if (!call) return;
    const attempt = ++actionGeneration.current;
    localIntent.current = null; releaseRoom(); setBusy(true); setError("");
    const action = call.status === "ringing" ? (call.caller_id === userId ? "cancel" : "decline") : "end";
    try {
      let ended: TrainerCall;
      try { ended = await respondCall(call.id, action); }
      catch (requestError) {
        if (action === "end") throw requestError;
        ended = await respondCall(call.id, "end");
      }
      closeServerRoom(call.id);
      if (alive.current && attempt === actionGeneration.current) {
        commitCall(null); setPeer(null); setMediaError("");
        setCalls((previous) => [ended, ...previous.filter((entry) => entry.id !== ended.id)]);
      }
    } catch (requestError) { if (alive.current) setError(errorMessage(requestError, "Unable to end the call. Please try again.")); }
    finally { if (alive.current && attempt === actionGeneration.current) { setBusy(false); void refreshCalls(); } }
  }
  async function toggleDevice(device: "microphone" | "camera") {
    const current = currentRoom.current;
    if (!current || connectionState !== "connected" || (device === "camera" && currentCall.current?.mode !== "video")) return;
    setMediaError("");
    try {
      if (device === "microphone") {
        await current.localParticipant.setMicrophoneEnabled(!current.localParticipant.isMicrophoneEnabled);
        if (currentRoom.current === current) setMicrophoneEnabled(current.localParticipant.isMicrophoneEnabled);
      } else {
        await current.localParticipant.setCameraEnabled(!current.localParticipant.isCameraEnabled);
        if (currentRoom.current === current) setCameraEnabled(current.localParticipant.isCameraEnabled);
      }
    } catch (deviceError) { if (currentRoom.current === current) setMediaError(mediaFailure(deviceError)); }
    finally { if (currentRoom.current !== current) await current.disconnect(true); }
  }

  return <CallContext.Provider value={{ userId, available, checking, calls, activeCall, peer, room, busy, error, mediaError, connectionState, microphoneEnabled, cameraEnabled, minimized, startCall, acceptCall, declineCall: endCall, endCall, toggleMicrophone: () => toggleDevice("microphone"), toggleCamera: () => toggleDevice("camera"), setMinimized, dismissError: () => { setError(""); setMediaError(""); } }}>
    {children}
    {(activeCall || error) && <Suspense fallback={<p className="callLoading" role="status">Loading call controls...</p>}><CallPanel /></Suspense>}
  </CallContext.Provider>;
}
