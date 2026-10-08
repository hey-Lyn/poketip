import { useEffect, useRef, useState } from "react";
import { Maximize2, Mic, MicOff, Minimize2, Phone, PhoneIncoming, PhoneOff, UserRound, ScreenShare, ScreenShareOff, Volume2, X } from "lucide-react";
import { RoomEvent, Track } from "livekit-client";
import type { Room } from "livekit-client";
import { useTrainerCall } from "../contexts/CallContext";
import "./CallPanel.css";

interface RoomMedia {
  room: Room | null;
  localVideo: Track | null;
  remoteVideo: Track | null;
  remoteAudio: Track | null;
  remoteScreenAudio: Track | null;
  peerPresent: boolean;
  peerSpeaking: boolean;
  peerMicMuted: boolean;
  audioBlocked: boolean;
}
const emptyMedia: RoomMedia = { room: null, localVideo: null, remoteVideo: null, remoteAudio: null, remoteScreenAudio: null, peerPresent: false, peerSpeaking: false, peerMicMuted: false, audioBlocked: false };

function useRoomMedia(room: Room | null, peerId?: string) {
  const [media, setMedia] = useState<RoomMedia>(emptyMedia);
  useEffect(() => {
    if (!room) return;
    const refresh = () => {
      const participant = peerId ? room.remoteParticipants.get(peerId) : room.remoteParticipants.values().next().value;
      const localScreen = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      const remoteScreen = participant?.getTrackPublication(Track.Source.ScreenShare);
      const remoteMicrophone = participant?.getTrackPublication(Track.Source.Microphone);
      const remoteScreenAudio = participant?.getTrackPublication(Track.Source.ScreenShareAudio);
      const next: RoomMedia = {
        room,
        localVideo: localScreen?.track && !localScreen.isMuted ? localScreen.track : null,
        remoteVideo: remoteScreen?.track && !remoteScreen.isMuted ? remoteScreen.track : null,
        remoteAudio: remoteMicrophone?.track ?? null,
        remoteScreenAudio: remoteScreenAudio?.track && !remoteScreenAudio.isMuted ? remoteScreenAudio.track : null,
        peerPresent: !!participant,
        peerSpeaking: participant?.isSpeaking ?? false,
        peerMicMuted: participant?.isMicrophoneEnabled === false,
        audioBlocked: !room.canPlaybackAudio,
      };
      setMedia((previous) => Object.keys(next).every((key) => next[key as keyof RoomMedia] === previous[key as keyof RoomMedia]) ? previous : next);
    };
    const events = [RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.TrackPublished, RoomEvent.TrackUnpublished,
      RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished,
      RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ActiveSpeakersChanged, RoomEvent.AudioPlaybackStatusChanged];
    events.forEach((event) => room.on(event, refresh));
    refresh();
    return () => { events.forEach((event) => room.off(event, refresh)); };
  }, [room, peerId]);
  return media.room === room ? media : emptyMedia;
}

function VideoFeed({ track, local = false, label }: { track: Track; local?: boolean; label: string }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    track.attach(element);
    return () => { track.detach(element); };
  }, [track]);
  return <video ref={video} className={`callVideo${local ? " callVideoLocal" : ""}`} autoPlay playsInline muted aria-label={label} />;
}

function RemoteAudio({ track }: { track: Track }) {
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    track.attach(element);
    return () => { track.detach(element); };
  }, [track]);
  return <audio ref={audio} autoPlay />;
}

function CallAvatar({ avatar, speaking = false, large = false }: { avatar?: string | null; speaking?: boolean; large?: boolean }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return <span className={`callAvatar${large ? " callAvatarLarge" : ""}${speaking ? " isSpeaking" : ""}`}>
    {avatar && avatar !== failedSource ? <img src={avatar} alt="" onError={() => setFailedSource(avatar)} /> : <UserRound aria-hidden="true" />}
  </span>;
}

function useCallDuration(acceptedAt: string | null | undefined, accepted: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!accepted) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [accepted, acceptedAt]);
  const start = acceptedAt ? Date.parse(acceptedAt) : now;
  const seconds = Number.isFinite(start) ? Math.max(0, Math.floor((now - start) / 1000)) : 0;
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export default function CallPanel() {
  const { activeCall, peer, room, busy, error, mediaError, connectionState, microphoneEnabled, screenShareEnabled, screenSharePending, minimized,
    userId, acceptCall, declineCall, endCall, toggleMicrophone, toggleScreenShare, setMinimized, dismissError } = useTrainerCall();
  const media = useRoomMedia(room, peer?.peer_id);
  const accepted = activeCall?.status === "accepted";
  const duration = useCallDuration(activeCall?.accepted_at, accepted);
  const [playbackFailure, setPlaybackFailure] = useState<{ room: Room; error: string } | null>(null);
  const [startingAudioRoom, setStartingAudioRoom] = useState<Room | null>(null);
  const startingAudio = !!room && startingAudioRoom === room;
  const displayedPlaybackError = room && media.audioBlocked && playbackFailure?.room === room ? playbackFailure.error : "";

  if (!activeCall) return error ? <aside className="callErrorToast" role="alert">
    <PhoneOff aria-hidden="true" size={20} /><p>{error}</p>
    <button type="button" onClick={dismissError} aria-label="Dismiss call error"><X size={18} /></button>
  </aside> : null;

  const ringing = activeCall.status === "ringing";
  const incoming = ringing && activeCall.callee_id === userId;
  const videoCall = activeCall.mode === "video";
  const name = peer?.peer_name || peer?.peer_username || "Trainer";
  const compact = minimized && accepted;
  const connected = connectionState === "connected";
  const needsJoin = accepted && !room && connectionState === "disconnected";
  const status = ringing ? incoming ? `Incoming ${videoCall ? "screen sharing" : "voice"} call` : "Calling…"
    : needsJoin ? "Ready to join"
    : connectionState === "reconnecting" ? "Reconnecting…"
    : connected ? `${videoCall ? "Screen sharing" : "Voice"} call` : "Connecting…";
  const controlsDisabled = busy || !room || !connected;
  const enableAudio = async () => {
    if (!room || startingAudio) return;
    setStartingAudioRoom(room);
    try { await room.startAudio(); setPlaybackFailure(null); }
    catch { setPlaybackFailure({ room, error: "Audio could not start. Try again." }); }
    finally { setStartingAudioRoom((current) => current === room ? null : current); }
  };

  return <aside className={`callPanel${ringing ? " isRinging" : ""}${compact ? " isMinimized" : ""}${videoCall && accepted && !compact ? " isVideoCall" : ""}`}
    role="dialog" aria-modal="false" aria-label={`${videoCall ? "Screen sharing" : "Voice"} call with ${name}`}
    onKeyDown={(event) => { if (event.key === "Escape" && accepted && !compact) { event.preventDefault(); setMinimized(true); } }}>
    {media.remoteAudio && <RemoteAudio track={media.remoteAudio} />}
    {media.remoteScreenAudio && <RemoteAudio track={media.remoteScreenAudio} />}
    <header className="callHeader">
      <CallAvatar avatar={peer?.peer_avatar} speaking={media.peerSpeaking} />
      <div className="callHeading">
        <strong>{name}</strong>
        <div className="callStatusRow">
          <span className={`callConnection${connected ? " isConnected" : ""}`} role="status"><i aria-hidden="true" />{status}</span>
          {accepted && connected && <time className="callDuration" aria-label="Call duration">{duration}</time>}
        </div>
      </div>
      {accepted && <button type="button" className="callIconButton callExpand" onClick={() => setMinimized(!compact)} aria-label={compact ? "Expand call" : "Minimize call"} title={compact ? "Expand call" : "Minimize call"}>
        {compact ? <Maximize2 size={17} aria-hidden="true" /> : <Minimize2 size={17} aria-hidden="true" />}
      </button>}
      {ringing && <span className="callModeIcon" aria-hidden="true">{videoCall ? <ScreenShare size={20} /> : <PhoneIncoming size={20} />}</span>}
    </header>

    {ringing && <div className="callRingingBody">
      <div className="callRingingAvatar"><CallAvatar avatar={peer?.peer_avatar} large /></div>
      <p>{incoming ? `${name} is calling you` : `Waiting for ${name} to answer`}</p>
      <small>{incoming ? "Answer to turn on your microphone." : "Your microphone will start when they answer."}{videoCall ? " Your screen is shared only when you select Share screen." : ""}</small>
    </div>}

    {accepted && !compact && <div className={`callStage${videoCall ? " callStageVideo" : " callStageVoice"}`}>
      {videoCall && media.remoteVideo ? <VideoFeed track={media.remoteVideo} label={`${name}'s shared screen`} /> : <div className="callParticipantPlaceholder">
        <CallAvatar avatar={peer?.peer_avatar} large speaking={media.peerSpeaking} />
        <strong>{name}</strong>
        <span>{needsJoin ? "Join to continue your call" : !connected ? "Connecting to your call…" : !media.peerPresent ? "Waiting for the other trainer…" : videoCall ? "No screen is being shared" : "Voice connected"}</span>
      </div>}
      {media.peerPresent && <span className="callParticipantLabel">{name}{media.peerMicMuted && <MicOff aria-label="Microphone muted" size={14} />}</span>}
      {videoCall && <div className="callSelfPreview">
        {media.localVideo ? <VideoFeed track={media.localVideo} local label="Your shared screen" /> : <div className="callSelfScreenOff"><ScreenShareOff size={22} aria-hidden="true" /></div>}
        <span>You{!microphoneEnabled && <MicOff aria-label="Microphone muted" size={12} />}</span>
      </div>}
    </div>}

    {accepted && media.audioBlocked && <div className="callAudioPrompt">
      <button type="button" onClick={() => void enableAudio()} disabled={startingAudio}>
        <Volume2 size={16} aria-hidden="true" />{startingAudio ? "Enabling audio…" : "Click to hear the call"}
      </button>
      {displayedPlaybackError && <small role="alert">{displayedPlaybackError}</small>}
    </div>}
    {(error || mediaError) && <div className="callInlineError" role="alert"><p>{error || mediaError}</p>
      {error && <button type="button" onClick={dismissError} aria-label="Dismiss call error"><X size={15} /></button>}
    </div>}

    <footer className="callControls">
      {ringing ? incoming ? <>
        <button type="button" className="callAction callDecline" onClick={() => void declineCall()} disabled={busy}><PhoneOff size={18} aria-hidden="true" />Decline</button>
        <button type="button" className="callAction callAccept" onClick={() => void acceptCall()} disabled={busy}><Phone size={18} aria-hidden="true" />{busy ? "Answering…" : "Accept"}</button>
      </> : <button type="button" className="callAction callDecline" onClick={() => void endCall()} disabled={busy}><PhoneOff size={18} aria-hidden="true" />Cancel call</button>
      : <>
        {needsJoin ? <button type="button" className="callAction callAccept" onClick={() => void acceptCall()} disabled={busy}><Phone size={18} aria-hidden="true" />{busy ? "Joining…" : "Join call"}</button> : <button type="button" className={`callIconButton${!microphoneEnabled ? " isOff" : ""}`} onClick={() => void toggleMicrophone()} disabled={controlsDisabled}
          aria-label={microphoneEnabled ? "Mute microphone" : "Unmute microphone"} aria-pressed={microphoneEnabled} title={microphoneEnabled ? "Mute microphone" : "Unmute microphone"}>
          {microphoneEnabled ? <Mic size={20} aria-hidden="true" /> : <MicOff size={20} aria-hidden="true" />}
        </button>}
        {videoCall && !needsJoin && <button type="button" className={`callIconButton${!screenShareEnabled ? " isOff" : ""}`} onClick={() => void toggleScreenShare()} disabled={controlsDisabled || screenSharePending}
          aria-label={screenShareEnabled ? "Stop sharing" : "Share screen"} aria-pressed={screenShareEnabled} title={screenShareEnabled ? "Stop sharing" : "Share screen"}>
          {screenShareEnabled ? <ScreenShare size={20} aria-hidden="true" /> : <ScreenShareOff size={20} aria-hidden="true" />}
        </button>}
        <button type="button" className="callIconButton callHangup" onClick={() => void endCall()} aria-label="End call" title="End call"><PhoneOff size={20} aria-hidden="true" /></button>
      </>}
    </footer>
  </aside>;
}
