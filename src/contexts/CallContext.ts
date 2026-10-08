import { createContext, useContext } from "react";
import type { Room } from "livekit-client";
import type { Conversation } from "../services/messages";
import type { CallMode, TrainerCall } from "../services/calls";

export interface TrainerCallContext {
  userId: string | null;
  available: boolean;
  checking: boolean;
  calls: TrainerCall[];
  activeCall: TrainerCall | null;
  peer: Conversation | null;
  room: Room | null;
  busy: boolean;
  error: string;
  mediaError: string;
  connectionState: "disconnected" | "connecting" | "connected" | "reconnecting";
  microphoneEnabled: boolean;
  screenShareEnabled: boolean;
  screenSharePending: boolean;
  minimized: boolean;
  // eslint-disable-next-line no-unused-vars -- Named parameters describe this TypeScript-only interface.
  startCall(conversation: Conversation, mode: CallMode): Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMicrophone: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
  // eslint-disable-next-line no-unused-vars -- Named parameter describes this TypeScript-only interface.
  setMinimized(value: boolean): void;
  dismissError: () => void;
}
export const CallContext = createContext<TrainerCallContext | null>(null);
export function useTrainerCall() {
  const context = useContext(CallContext);
  if (!context) throw new Error("Calls must be rendered inside CallProvider.");
  return context;
}
