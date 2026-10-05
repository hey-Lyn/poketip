import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, MessageCircle, RefreshCw, Reply, Send, Shield, UserRound, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import ChatProfilePreview from "./ChatProfilePreview";
import { MAX_MESSAGE_LENGTH, listConversations, readMessages, markConversationRead, respondConversation, sendMessage, watchMessages } from "../services/messages";
import type { ChatMessage, Conversation, ConversationAction } from "../services/messages";
import type { TrainerProfile } from "../services/trainers";
import "./MessagesPage.css";

function ChatAvatar({ src, name, onClick }: { src?: string | null; name: string; onClick?: () => void }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const content = src && src !== failedSource ? <img src={src} alt="" onError={() => setFailedSource(src)} /> : <UserRound aria-hidden="true" />;
  return onClick ? <button type="button" className="chatAvatar chatAvatarButton" aria-label={`Preview ${name}'s profile`} onClick={onClick}>{content}</button>
    : <span className="chatAvatar">{content}</span>;
}
function mergeMessages(old: ChatMessage[], fresh: ChatMessage[]) {
  return [...new Map([...old, ...fresh].map((message) => [message.id, message])).values()]
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
}
function ConversationPane({ conversation, userId, ownProfile, revision, onRefresh }: {
  conversation: Conversation; userId: string; ownProfile: TrainerProfile | null; revision: number; onRefresh: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasOlder, setHasOlder] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [preview, setPreview] = useState<"self" | "peer" | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const sending = useRef(false);
  const firstLoad = useRef(true);
  const tailRef = useRef<HTMLDivElement>(null);
  const incoming = conversation.recipient_id === userId;

  useEffect(() => {
    let active = true;
    readMessages(conversation.id).then(async (fresh) => {
      if (!active) return;
      setMessages((previous) => mergeMessages(previous, fresh)); setError(""); setLoading(false);
      if (firstLoad.current) { setHasOlder(fresh.length === 50); firstLoad.current = false; }
      const last = fresh.at(-1);
      if (last && document.visibilityState === "visible") {
        try { await markConversationRead(conversation.id, last.id); } catch { /* Reading can still work while receipts reconnect. */ }
      }
    }).catch((requestError) => { if (active) { setError(requestError.message); setLoading(false); } });
    return () => { active = false; };
  }, [conversation.id, revision]);
  const latestId = messages.at(-1)?.id;
  useEffect(() => { tailRef.current?.scrollIntoView?.({ block: "end" }); }, [latestId]);

  async function action(value: ConversationAction) {
    setBusy(true); setError("");
    try { await respondConversation(conversation.id, value); setConfirmBlock(false); onRefresh(); }
    catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (busy || sending.current || conversation.status !== "accepted" || !draft.trim()) return;
    const submittedDraft = draft;
    const submittedReply = replyTarget;
    sending.current = true;
    setBusy(true); setError("");
    try {
      const message = submittedReply ? await sendMessage(conversation.id, submittedDraft, submittedReply.id) : await sendMessage(conversation.id, submittedDraft);
      setMessages((previous) => mergeMessages(previous, [{ ...message, ...(submittedReply ? { reply: { id: submittedReply.id, sender_id: submittedReply.sender_id, body: submittedReply.body } } : {}) }]));
      setDraft((current) => current === submittedDraft ? "" : current);
      setReplyTarget((current) => current?.id === submittedReply?.id ? null : current);
      onRefresh();
    }
    catch (requestError) { setError(requestError.message); }
    finally { sending.current = false; setBusy(false); composerRef.current?.focus(); }
  }
  async function older() {
    setOlderLoading(true); setError("");
    try { const fresh = await readMessages(conversation.id, messages[0]?.id); setMessages((previous) => mergeMessages(fresh, previous)); setHasOlder(fresh.length === 50); }
    catch (requestError) { setError(requestError.message); }
    finally { setOlderLoading(false); }
  }
  return <section className="chatConversation" aria-label={`Conversation with ${conversation.peer_name}`}>
    <header className="chatConversationHeader">
      <Link className="chatMobileBack" to="/messages" aria-label="Back to conversations"><ArrowLeft /></Link>
      <ChatAvatar src={conversation.peer_avatar} name={conversation.peer_name || "Trainer"} onClick={() => setPreview("peer")} />
      <div><Link to={`/trainers/${conversation.peer_username}`}>{conversation.peer_name || conversation.peer_username || "Trainer"}</Link><span>@{conversation.peer_username || "trainer"}</span></div>
      {conversation.status !== "blocked" && <button className="chatBlockButton" type="button" disabled={busy} onClick={() => setConfirmBlock(true)}><Shield size={15} /> Block</button>}
    </header>
    {confirmBlock && <div className="chatNotice"><p>Block {conversation.peer_name}? Neither of you will be able to send more messages in this conversation.</p><div><button className="chatDanger" disabled={busy} onClick={() => action("block")}>Confirm block</button><button disabled={busy} onClick={() => setConfirmBlock(false)}>Cancel</button></div></div>}
    {conversation.status === "pending" && <div className="chatRequestNotice">
      <MessageCircle aria-hidden="true" /><h2>{incoming ? `${conversation.peer_name} wants to chat` : "Request sent"}</h2>
      <p>{incoming ? "Accept this request to start exchanging messages. You can view their profile first." : "You can send messages after this trainer accepts your request."}</p>
      <div>{incoming ? <><button className="chatPrimary" disabled={busy} onClick={() => action("accept")}><Check size={16} /> Accept</button><button disabled={busy} onClick={() => action("decline")}><X size={16} /> Decline</button></> : <button disabled={busy} onClick={() => action("cancel")}>Cancel request</button>}</div>
      <Link to={`/trainers/${conversation.peer_username}`}>View trainer profile</Link>
    </div>}
    {["blocked", "declined"].includes(conversation.status) && <div className="chatNotice" role="status">{conversation.status === "blocked" ? "This conversation is blocked. Its history is still available." : "This request was declined or canceled. Messaging is unavailable."}</div>}
    {error && <div className="chatError" role="alert">{error}<button onClick={onRefresh} disabled={busy}>Refresh</button></div>}
    <div className="chatHistory" role="log" aria-label="Message history" aria-live="polite" aria-relevant="additions">
      {loading && <p className="chatHint" role="status">Loading messages...</p>}
      {hasOlder && <button className="chatOlder" disabled={olderLoading} onClick={older}>{olderLoading ? "Loading..." : "Load older messages"}</button>}
      {!loading && !messages.length && conversation.status === "accepted" && <div className="chatStart"><span className="chatPokeball" aria-hidden="true" /><h2>A new adventure starts here</h2><p>Say hello to {conversation.peer_name}.</p></div>}
      {messages.map((message, index) => {
        const date = new Date(message.created_at);
        const previous = messages[index - 1];
        const newDay = !previous || new Date(previous.created_at).toDateString() !== date.toDateString();
        const group = newDay || previous.sender_id !== message.sender_id || date.getTime() - new Date(previous.created_at).getTime() > 300000;
        const own = message.sender_id === userId;
        return <div key={message.id}>
          {newDay && <div className="chatDay"><span>{date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</span></div>}
          <article className={`chatMessage ${group ? "startsGroup" : ""} ${own ? "isOwn" : ""}`}>
            {group ? <ChatAvatar src={own ? ownProfile?.avatar_url : conversation.peer_avatar} name={own ? ownProfile?.display_name || "You" : conversation.peer_name || "Trainer"} onClick={() => setPreview(own ? "self" : "peer")} /> : <span className="chatMessageSpacer" />}
            <div>{group && <header><strong>{own ? "You" : conversation.peer_name}</strong><time dateTime={message.created_at}>{date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</time></header>}
              {message.reply_to_message_id && <blockquote className="chatQuote"><strong>{message.reply ? message.reply.sender_id === userId ? "You" : conversation.peer_name : "Original message"}</strong><span>{message.reply?.body || "This message is unavailable."}</span></blockquote>}
              <p>{message.body}</p>
            </div>
            {conversation.status === "accepted" && <button type="button" className="chatReplyAction" aria-label={`Reply to message: ${message.body.slice(0, 80)}`} title="Reply" onClick={() => { setReplyTarget(message); composerRef.current?.focus(); }}><Reply size={16} /></button>}
          </article>
        </div>;
      })}<div ref={tailRef} />
    </div>
    {conversation.status === "accepted" && <form className="chatComposer" onSubmit={submit}>
      {replyTarget && <div className="chatReplyDraft"><Reply size={16} aria-hidden="true" /><div><strong>Replying to {replyTarget.sender_id === userId ? "yourself" : conversation.peer_name}</strong><span>{replyTarget.body}</span></div><button type="button" aria-label="Cancel reply" onClick={() => { setReplyTarget(null); composerRef.current?.focus(); }}><X size={16} /></button></div>}
      <label className="chatSrOnly" htmlFor="chat-message">Message {conversation.peer_name}</label>
      <textarea ref={composerRef} id="chat-message" placeholder={`Message ${conversation.peer_name}`} value={draft} maxLength={MAX_MESSAGE_LENGTH} rows={2}
        onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(event); } }} />
      <div><span>{draft.length}/{MAX_MESSAGE_LENGTH}</span><button className="chatPrimary" type="submit" disabled={busy || !draft.trim()} aria-label="Send message"><Send size={17} />{busy ? "Sending..." : "Send"}</button></div>
    </form>}
    {preview && <ChatProfilePreview username={preview === "self" ? ownProfile?.username : conversation.peer_username}
      ownProfile={preview === "self" ? ownProfile : undefined} isSelf={preview === "self"}
      name={preview === "self" ? ownProfile?.display_name || "You" : conversation.peer_name || "Trainer"}
      avatar={preview === "self" ? ownProfile?.avatar_url : conversation.peer_avatar} onClose={() => setPreview(null)} />}
  </section>;
}

function MessagesInbox({ userId }: { userId: string }) {
  const { profile: ownProfile } = useProfile({ id: userId });
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("chats");
  const [search, setSearch] = useState("");
  const [revision, setRevision] = useState(0);
  const version = useRef(0);
  const refreshInbox = useCallback(() => {
    const attempt = ++version.current;
    return listConversations().then((data) => { if (attempt === version.current) { setConversations(data); setError(""); setLoading(false); } })
      .catch((requestError) => { if (attempt === version.current) { setError(requestError.message); setLoading(false); } });
  }, []);
  const refresh = useCallback(() => { void refreshInbox(); setRevision((previous) => previous + 1); }, [refreshInbox]);
  useEffect(() => {
    const requests = version;
    void refreshInbox(); const stop = watchMessages(userId, refresh);
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    window.addEventListener("focus", refresh); document.addEventListener("visibilitychange", visible);
    // Also recover changes when a websocket reconnect is delayed.
    const timer = setInterval(visible, 30000);
    return () => { ++requests.current; stop(); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", visible); clearInterval(timer); };
  }, [refreshInbox, refresh, userId]);
  const selected = conversations.find((entry) => entry.id === conversationId);
  const incomingRequests = conversations.filter((entry) => entry.status === "pending" && entry.recipient_id === userId);
  const visible = conversations.filter((entry) => (tab === "requests" ? incomingRequests.includes(entry) : !incomingRequests.includes(entry))
    && `${entry.peer_name} ${entry.peer_username}`.toLowerCase().includes(search.toLowerCase()));
  return <main className="content messagesPage">
    <div className="messagesHeading"><div><span className="chatEyebrow">TRAINER CONNECTIONS</span><h1>Messages</h1></div><Link to="/trainers">Find trainers <UserRound size={16} /></Link></div>
    <div className={`messagesWorkspace ${conversationId ? "hasConversation" : ""}`}>
      <aside className="chatInbox" aria-label="Conversations">
        <header><h2>Your inbox</h2><button onClick={refresh} aria-label="Refresh inbox"><RefreshCw size={16} /></button></header>
        <div className="chatTabs" role="group" aria-label="Inbox filter"><button aria-pressed={tab === "chats"} onClick={() => setTab("chats")}>Chats</button><button aria-pressed={tab === "requests"} onClick={() => setTab("requests")}>Requests {incomingRequests.length > 0 && <span>{incomingRequests.length}</span>}</button></div>
        <input className="chatSearch" aria-label="Search conversations" placeholder="Search trainers" value={search} onChange={(event) => setSearch(event.target.value)} />
        {loading && <p className="chatHint" role="status">Loading inbox...</p>}
        {error && <p className="chatError" role="alert">{error}</p>}
        <div className="chatConversationList">{visible.map((entry) => <button key={entry.id} className={`chatInboxRow ${entry.id === conversationId ? "isSelected" : ""}`} aria-current={entry.id === conversationId ? "page" : undefined} onClick={() => navigate(`/messages/${entry.id}`)}>
          <ChatAvatar src={entry.peer_avatar} name="" /><span><strong>{entry.peer_name || entry.peer_username || "Trainer"}</strong><small>{entry.status === "pending" ? (entry.recipient_id === userId ? "Wants to chat with you" : "Waiting for acceptance") : entry.status === "blocked" ? "Blocked" : entry.status === "declined" ? "Request closed" : entry.last_body || "Say hello!"}</small></span>
          {!!entry.unread_count && <b className="chatUnread" aria-label={`${entry.unread_count} unread messages`}>{entry.unread_count > 99 ? "99+" : entry.unread_count}</b>}
        </button>)}</div>
        {!loading && !error && !visible.length && <p className="chatHint">{search ? "No trainers match your search." : tab === "requests" ? "No pending requests." : "Start a conversation from a trainer's profile."}</p>}
      </aside>
      {selected ? <ConversationPane key={selected.id} conversation={selected} userId={userId} ownProfile={ownProfile} revision={revision} onRefresh={() => { refresh(); setTab("chats"); }} /> : <section className="chatEmpty"><span className="chatPokeball" aria-hidden="true" /><h2>{conversationId && !loading ? "Conversation unavailable" : "Your next trainer connection"}</h2><p>{conversationId && !loading ? "Choose a conversation from your inbox, or go back to the list." : "Choose a chat or review your requests. Every conversation starts with an invitation."}</p><Link to="/messages" className="chatMobileBack">Back to inbox</Link><Link to="/trainers" className="chatPrimary">Explore trainers</Link></section>}
    </div>
  </main>;
}
export default function MessagesPage() {
  const { user, loading } = useAuth();
  if (loading) return <main className="content messagesPage"><p role="status">Loading account...</p></main>;
  if (!user) return <main className="content messagesPage"><section className="chatEmpty"><MessageCircle /><h1>Your trainer inbox</h1><p>Sign in to send conversation requests and chat with other trainers.</p><Link className="chatPrimary" to="/profile">Sign in</Link></section></main>;
  return <MessagesInbox key={user.id} userId={user.id} />;
}
