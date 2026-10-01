import { useEffect, useRef, useState } from "react";
import { sendAiMessage } from "../services/aiApi";
import { getAccessToken } from "../services/auth";

const MAX_HISTORY_MESSAGES = 8;
const STORAGE_PREFIX = "poketip-ai-chat:";

function loadStoredMessages(storageKey?: string): any[] {
  if (!storageKey) return [];
  try {
    const stored = sessionStorage.getItem(`${STORAGE_PREFIX}${storageKey}`);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function storeMessages(storageKey: string | undefined, messages: any[]) {
  if (!storageKey) return;
  try {
    if (messages.length) {
      sessionStorage.setItem(`${STORAGE_PREFIX}${storageKey}`, JSON.stringify(messages));
    } else {
      sessionStorage.removeItem(`${STORAGE_PREFIX}${storageKey}`);
    }
  } catch {
    // The conversation still works when browser storage is unavailable.
  }
}

export function useAiConversation(
  context: any,
  { storageKey }: { storageKey?: string } = {},
) {
  const [messages, setMessages] = useState<any[]>(() => loadStoredMessages(storageKey));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [billing, setBilling] = useState<any>(null);
  const activeRequest = useRef<AbortController | null>(null);

  useEffect(() => () => activeRequest.current?.abort(), []);

  useEffect(() => {
    storeMessages(storageKey, messages);
  }, [storageKey, messages]);

  async function ask(question: string, options: { mode?: string } = {}) {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || loading) return false;

    const history = messages
      .map(({ role, content }) => ({ role, content }))
      .slice(-MAX_HISTORY_MESSAGES);
    const controller = new AbortController();
    activeRequest.current = controller;
    setMessages((current) => [
      ...current,
      { role: "user", content: trimmedQuestion },
    ]);
    setError("");
    setLoading(true);

    try {
      const token = await getAccessToken();
      const result = await sendAiMessage(trimmedQuestion, {
        history,
        context,
        mode: options.mode,
        token,
        signal: controller.signal,
      });
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: result.answer,
          sources: result.sources ?? [],
          actions: result.actions ?? [],
        },
      ]);
      setBilling(result.billing ?? null);
      return result;
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message);
      return false;
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
        setLoading(false);
      }
    }
  }

  function clear() {
    activeRequest.current?.abort();
    activeRequest.current = null;
    setMessages([]);
    setError("");
    setBilling(null);
    setLoading(false);
  }

  return { messages, loading, error, billing, ask, clear };
}
