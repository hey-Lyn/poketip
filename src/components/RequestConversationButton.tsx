import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { requestConversation } from "../services/messages";

export default function RequestConversationButton({ recipientId }: { recipientId: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div className="trainerChatAction"><button type="button" className="trainerAction" disabled={busy} onClick={async () => {
    if (busy) return;
    setBusy(true); setError("");
    try { const id = await requestConversation(recipientId); navigate(`/messages/${id}`); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }}><MessageCircle size={16} />{busy ? "Opening..." : "Request conversation"}</button>{error && <p role="alert">{error}</p>}</div>;
}
