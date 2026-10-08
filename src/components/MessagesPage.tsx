import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEventHandler } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Copy, MessageCircle, Pencil, Phone, RefreshCw, Reply, Search, Send, Shield, ShieldCheck, UserRound, Video, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useProfile } from "../hooks/useProfile";
import ChatProfilePreview from "./ChatProfilePreview";
import { MAX_MESSAGE_LENGTH, editMessage, listConversations, readMessageContext, readMessages, markConversationRead, respondConversation, searchMessages, sendMessage, watchMessages } from "../services/messages";
import { errorMessage } from "../services/errors";
import { useTrainerCall } from "../contexts/CallContext";
import type { ChatMessage, Conversation, ConversationAction } from "../services/messages";
import type { TrainerProfile } from "../services/trainers";
import "./MessagesPage.css";

function ChatAvatar({ src, name, onClick }: { src?: string | null; name: string; onClick?: MouseEventHandler<HTMLButtonElement> }) {
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
  const callState = useTrainerCall();
  const callHistory = callState.calls.filter((call) => call.conversation_id === conversation.id && !["ringing", "accepted"].includes(call.status));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasOlder, setHasOlder] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [preview, setPreview] = useState<{ person: "self" | "peer"; anchor: HTMLButtonElement } | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [editingTarget, setEditingTarget] = useState<ChatMessage | null>(null);
  const [contextMenu, setContextMenu] = useState<{ message: ChatMessage; left: number; top: number } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchTargetId, setSearchTargetId] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const messageElements = useRef(new Map<string, HTMLElement>());
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
    }).catch((requestError) => { if (active) { setError(errorMessage(requestError, "Unable to load messages.")); setLoading(false); } });
    return () => { active = false; };
  }, [conversation.id, revision]);
  const latestId = messages.at(-1)?.id;
  const searchQuery = messageSearch.trim();
  const searchIsCurrent = searchedQuery === searchQuery;
  useEffect(() => { tailRef.current?.scrollIntoView?.({ block: "end" }); }, [latestId]);
  useEffect(() => {
    if (replyTarget) messageElements.current.get(replyTarget.id)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [replyTarget]);
  useEffect(() => {
    if (searchTargetId) messageElements.current.get(searchTargetId)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
  }, [searchTargetId, messages.length]);
  useEffect(() => {
    if (!contextMenu) return undefined;
    contextMenuRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const dismissOutside = (event: PointerEvent) => {
      if (!contextMenuRef.current?.contains(event.target as Node)) setContextMenu(null);
    };
    const dismissEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setContextMenu(null); };
    window.addEventListener("pointerdown", dismissOutside);
    window.addEventListener("keydown", dismissEscape);
    return () => { window.removeEventListener("pointerdown", dismissOutside); window.removeEventListener("keydown", dismissEscape); };
  }, [contextMenu]);
  useEffect(() => {
    const query = messageSearch.trim();
    if (!searchOpen || query.length < 2) {
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setSearchLoading(true); setSearchError("");
      searchMessages(conversation.id, query).then((results) => {
        if (active) { setSearchResults(results); setSearchHasMore(results.length === 50); setSearchedQuery(query); }
      }).catch((requestError) => {
        if (active) { setSearchResults([]); setSearchError(errorMessage(requestError, "Unable to search messages.")); setSearchedQuery(query); }
      }).finally(() => { if (active) setSearchLoading(false); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [conversation.id, messageSearch, searchOpen]);

  function startReply(message: ChatMessage) {
    setEditingTarget(null); setReplyTarget(message); setContextMenu(null); composerRef.current?.focus();
  }
  function startEdit(message: ChatMessage) {
    setReplyTarget(null); setEditingTarget(message); setDraft(message.body); setContextMenu(null);
    window.requestAnimationFrame(() => composerRef.current?.focus());
  }
  async function copyMessage(message: ChatMessage) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(message.body);
      else {
        const helper = document.createElement("textarea");
        helper.value = message.body; helper.setAttribute("readonly", ""); helper.style.position = "fixed"; helper.style.opacity = "0";
        document.body.append(helper); helper.select();
        let copied = false;
        try { copied = document.execCommand("copy"); } finally { helper.remove(); }
        if (!copied) throw new Error("Clipboard access is unavailable.");
      }
      setContextMenu(null);
    } catch {
      setError("Unable to copy this message. Check clipboard permissions and try again.");
      setContextMenu(null);
    }
  }
  async function jumpToSearchResult(message: ChatMessage) {
    setSearchError("");
    try {
      const context = await readMessageContext(conversation.id, message.id);
      setMessages((previous) => mergeMessages(previous, context));
      setHasOlder((current) => current || context.length === 21);
      setSearchTargetId(message.id); setSearchOpen(false);
    } catch (requestError) { setSearchError(errorMessage(requestError, "Unable to open this message.")); }
  }
  async function loadMoreSearchResults() {
    const before = searchResults.at(-1)?.id;
    if (!before || searchLoadingMore) return;
    setSearchLoadingMore(true); setSearchError("");
    try {
      const more = await searchMessages(conversation.id, messageSearch, before);
      setSearchResults((current) => [...current, ...more]); setSearchHasMore(more.length === 50);
    } catch (requestError) { setSearchError(errorMessage(requestError, "Unable to load more search results.")); }
    finally { setSearchLoadingMore(false); }
  }

  async function action(value: ConversationAction) {
    setBusy(true); setError("");
    try { await respondConversation(conversation.id, value); setConfirmBlock(false); onRefresh(); }
    catch (requestError) { setError(errorMessage(requestError, "Unable to update this conversation.")); }
    finally { setBusy(false); }
  }
  async function submit(event) {
    event.preventDefault();
    if (busy || sending.current || conversation.status !== "accepted" || !draft.trim()) return;
    const submittedDraft = draft;
    const submittedReply = replyTarget;
    const submittedEdit = editingTarget;
    sending.current = true;
    setBusy(true); setError("");
    try {
      if (submittedEdit) {
        const updated = await editMessage(submittedEdit.id, submittedDraft);
        setMessages((previous) => mergeMessages(previous, [updated]));
        setEditingTarget((current) => current?.id === submittedEdit.id ? null : current);
      } else {
        const message = submittedReply ? await sendMessage(conversation.id, submittedDraft, submittedReply.id) : await sendMessage(conversation.id, submittedDraft);
        setMessages((previous) => mergeMessages(previous, [{ ...message, ...(submittedReply ? { reply: { id: submittedReply.id, sender_id: submittedReply.sender_id, body: submittedReply.body } } : {}) }]));
        setReplyTarget((current) => current?.id === submittedReply?.id ? null : current);
      }
      setDraft((current) => current === submittedDraft ? "" : current);
      onRefresh();
    }
    catch (requestError) { setError(errorMessage(requestError, submittedEdit ? "Unable to edit this message." : "Unable to send this message.")); }
    finally { sending.current = false; setBusy(false); composerRef.current?.focus(); }
  }
  async function older() {
    setOlderLoading(true); setError("");
    try { const fresh = await readMessages(conversation.id, messages[0]?.id); setMessages((previous) => mergeMessages(fresh, previous)); setHasOlder(fresh.length === 50); }
    catch (requestError) { setError(errorMessage(requestError, "Unable to load older messages.")); }
    finally { setOlderLoading(false); }
  }
  return <section className="chatConversation" aria-label={`Conversation with ${conversation.peer_name}`}>
    <header className="chatConversationHeader">
      <Link className="chatMobileBack" to="/messages" aria-label="Back to conversations"><ArrowLeft /></Link>
      <ChatAvatar src={conversation.peer_avatar} name={conversation.peer_name || "Trainer"} onClick={(event) => setPreview({ person: "peer", anchor: event.currentTarget })} />
      <div><Link to={`/trainers/${conversation.peer_username}`}>{conversation.peer_name || conversation.peer_username || "Trainer"}</Link><span>@{conversation.peer_username || "trainer"}</span></div>
      {conversation.status === "accepted" && <span className="chatCallButtons">
        <button type="button" aria-label="Start voice call" title={callState.available ? "Voice call" : "Calls are currently unavailable"} disabled={!callState.available || callState.checking || callState.busy || !!callState.activeCall} onClick={() => void callState.startCall(conversation, "audio")}><Phone size={17} /></button>
        <button type="button" aria-label="Start video call" title={callState.available ? "Video call" : "Calls are currently unavailable"} disabled={!callState.available || callState.checking || callState.busy || !!callState.activeCall} onClick={() => void callState.startCall(conversation, "video")}><Video size={18} /></button>
      </span>}
      <button className="chatSearchToggle" type="button" aria-label="Search messages" title="Search messages" onClick={() => { setSearchOpen(true); window.requestAnimationFrame(() => searchInputRef.current?.focus()); }}><Search size={16} /></button>
      {conversation.status !== "blocked" && <button className="chatBlockButton" type="button" disabled={busy} onClick={() => setConfirmBlock(true)}><Shield size={15} /> Block</button>}
      {conversation.status === "blocked" && conversation.blocked_by === userId && <button className="chatBlockButton" type="button" disabled={busy} onClick={() => void action("unblock")}><ShieldCheck size={15} /> Unblock</button>}
    </header>
    {conversation.status === "accepted" && !callState.available && !callState.checking && <p className="chatCallAvailability" role="status">Voice and video calls are currently unavailable.</p>}
    {!!callHistory.length && <details className="chatCallHistory"><summary><Phone size={13} aria-hidden="true" />Call history ({callHistory.length})</summary>
      <ul>{callHistory.map((call) => <li key={call.id} className={call.status === "missed" && call.callee_id === userId ? "isMissed" : ""}>
        {call.mode === "video" ? <Video size={14} aria-hidden="true" /> : <Phone size={14} aria-hidden="true" />}
        <span>{call.status === "missed" ? (call.callee_id === userId ? "Missed call" : "No answer") : call.status === "declined" ? "Call declined" : call.status === "canceled" ? "Call canceled" : "Call ended"} · {call.mode === "video" ? "Video" : "Voice"}</span>
        <time dateTime={call.created_at}>{new Date(call.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
      </li>)}</ul>
    </details>}
    {searchOpen && <section className="chatMessageSearch" aria-label="Search messages">
      <div className="chatMessageSearchBar"><Search size={16} aria-hidden="true" /><input ref={searchInputRef} type="search" aria-label="Search messages in this conversation" placeholder="Search messages" value={messageSearch} maxLength={100} onChange={(event) => { setMessageSearch(event.target.value); setSearchedQuery(""); setSearchError(""); }} /><button type="button" aria-label="Close message search" onClick={() => setSearchOpen(false)}><X size={16} /></button></div>
      {messageSearch.trim().length < 2 && <p className="chatSearchHint">Enter at least 2 characters to search this conversation.</p>}
      {searchLoading && messageSearch.trim().length >= 2 && <p className="chatSearchHint" role="status">Searching messages...</p>}
      {searchError && messageSearch.trim().length >= 2 && searchIsCurrent && <p className="chatSearchError" role="alert">{searchError}</p>}
      {!searchLoading && searchIsCurrent && messageSearch.trim().length >= 2 && !searchError && searchResults.length === 0 && <p className="chatSearchHint">No messages found.</p>}
      {searchIsCurrent && messageSearch.trim().length >= 2 && !!searchResults.length && <ul className="chatMessageSearchResults" aria-label="Matching messages">{searchResults.map((result) => <li key={result.id}><button type="button" className="chatMessageSearchResult" onClick={() => void jumpToSearchResult(result)}>
        <span>{result.sender_id === userId ? "You" : conversation.peer_name} · {new Date(result.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span><p>{result.body}</p>
      </button></li>)}</ul>}
      {searchIsCurrent && messageSearch.trim().length >= 2 && searchHasMore && <button className="chatSearchMore" type="button" disabled={searchLoadingMore} onClick={() => void loadMoreSearchResults()}>{searchLoadingMore ? "Loading..." : "Load more results"}</button>}
    </section>}
    {confirmBlock && <div className="chatNotice"><p>Block {conversation.peer_name}? Neither of you will be able to send more messages in this conversation.</p><div><button className="chatDanger" disabled={busy} onClick={() => action("block")}>Confirm block</button><button disabled={busy} onClick={() => setConfirmBlock(false)}>Cancel</button></div></div>}
    {conversation.status === "pending" && <div className="chatRequestNotice">
      <MessageCircle aria-hidden="true" /><h2>{incoming ? `${conversation.peer_name} wants to chat` : "Request sent"}</h2>
      <p>{incoming ? "Accept this request to start exchanging messages. You can view their profile first." : "You can send messages after this trainer accepts your request."}</p>
      <div>{incoming ? <><button className="chatPrimary" disabled={busy} onClick={() => action("accept")}><Check size={16} /> Accept</button><button disabled={busy} onClick={() => action("decline")}><X size={16} /> Decline</button></> : <button disabled={busy} onClick={() => action("cancel")}>Cancel request</button>}</div>
      <Link to={`/trainers/${conversation.peer_username}`}>View trainer profile</Link>
    </div>}
    {["blocked", "declined"].includes(conversation.status) && <div className="chatNotice" role="status">{conversation.status === "blocked" ? conversation.blocked_by === userId ? "You blocked this trainer. Select Unblock to restore the conversation's previous status. Its history is still available." : "This conversation was blocked by the other trainer. Its history is still available." : "This request was declined or canceled. Messaging is unavailable."}</div>}
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
          <article
            ref={(element) => { if (element) messageElements.current.set(message.id, element); else messageElements.current.delete(message.id); }}
            data-message-id={message.id}
            tabIndex={0}
            className={`chatMessage ${group ? "startsGroup" : ""} ${own ? "isOwn" : ""} ${replyTarget?.id === message.id ? "isReplyTarget" : ""} ${searchTargetId === message.id ? "isSearchTarget" : ""}`}
            onDoubleClick={(event) => { if (!own && conversation.status === "accepted" && !(event.target as HTMLElement).closest("button")) startReply(message); }}
            onContextMenu={(event) => {
              event.preventDefault();
              setContextMenu({ message, left: Math.max(8, Math.min(event.clientX, window.innerWidth - 220)), top: Math.max(8, Math.min(event.clientY, window.innerHeight - 150)) });
            }}
          >
            {group ? <ChatAvatar src={own ? ownProfile?.avatar_url : conversation.peer_avatar} name={own ? ownProfile?.display_name || "You" : conversation.peer_name || "Trainer"} onClick={(event) => setPreview({ person: own ? "self" : "peer", anchor: event.currentTarget })} /> : <span className="chatMessageSpacer" />}
            <div>{group && <header><strong>{own ? "You" : conversation.peer_name}</strong><time dateTime={message.created_at}>{date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</time></header>}
              {message.reply_to_message_id && <blockquote className="chatQuote"><strong>{message.reply ? message.reply.sender_id === userId ? "You" : conversation.peer_name : "Original message"}</strong><span>{message.reply?.body || "This message is unavailable."}</span></blockquote>}
              <p>{message.body}{message.edited_at && <span className="chatEditedLabel"> (edited)</span>}</p>
            </div>
            {conversation.status === "accepted" && (own
              ? <button type="button" className="chatReplyAction" aria-label={`Edit message: ${message.body.slice(0, 80)}`} title="Edit message" onClick={() => startEdit(message)}><Pencil size={16} /></button>
              : <button type="button" className="chatReplyAction" aria-label={`Reply to message: ${message.body.slice(0, 80)}`} title="Reply" onClick={() => startReply(message)}><Reply size={16} /></button>)}
          </article>
        </div>;
      })}<div ref={tailRef} />
    </div>
    {contextMenu && <div ref={contextMenuRef} className="chatContextMenu" role="menu" aria-label="Message actions" style={{ left: contextMenu.left, top: contextMenu.top }}>
      <button type="button" role="menuitem" onClick={() => void copyMessage(contextMenu.message)}><Copy size={15} /> Copy text</button>
      {conversation.status === "accepted" && <button type="button" role="menuitem" onClick={() => startReply(contextMenu.message)}><Reply size={15} /> Reply</button>}
      {contextMenu.message.sender_id === userId && conversation.status === "accepted" && <button type="button" role="menuitem" onClick={() => startEdit(contextMenu.message)}><Pencil size={15} /> Edit message</button>}
    </div>}
    {conversation.status === "accepted" && <form className="chatComposer" onSubmit={submit}>
      {replyTarget && <div className="chatReplyDraft"><Reply size={16} aria-hidden="true" /><div><strong>Replying to {replyTarget.sender_id === userId ? "yourself" : conversation.peer_name}</strong><span>{replyTarget.body}</span></div><button type="button" aria-label="Cancel reply" onClick={() => { setReplyTarget(null); composerRef.current?.focus(); }}><X size={16} /></button></div>}
      {editingTarget && <div className="chatReplyDraft chatEditDraft"><Pencil size={16} aria-hidden="true" /><div><strong>Editing your message</strong><span>{editingTarget.body}</span></div><button type="button" aria-label="Cancel edit" onClick={() => { setEditingTarget(null); setDraft(""); composerRef.current?.focus(); }}><X size={16} /></button></div>}
      <label className="chatSrOnly" htmlFor="chat-message">{editingTarget ? "Edit message" : `Message ${conversation.peer_name}`}</label>
      <textarea ref={composerRef} id="chat-message" placeholder={editingTarget ? "Edit your message" : `Message ${conversation.peer_name}`} value={draft} maxLength={MAX_MESSAGE_LENGTH} rows={2}
        onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(event); } }} />
      <div><span>{draft.length}/{MAX_MESSAGE_LENGTH}</span><button className="chatPrimary" type="submit" disabled={busy || !draft.trim()} aria-label={editingTarget ? "Save edited message" : "Send message"}>{editingTarget ? <Check size={17} /> : <Send size={17} />}{busy ? (editingTarget ? "Saving..." : "Sending...") : editingTarget ? "Save" : "Send"}</button></div>
    </form>}
    {preview && <ChatProfilePreview username={preview.person === "self" ? ownProfile?.username : conversation.peer_username}
      ownProfile={preview.person === "self" ? ownProfile : undefined} isSelf={preview.person === "self"} anchor={preview.anchor}
      name={preview.person === "self" ? ownProfile?.display_name || "You" : conversation.peer_name || "Trainer"}
      avatar={preview.person === "self" ? ownProfile?.avatar_url : conversation.peer_avatar} onClose={() => setPreview(null)} />}
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
      .catch((requestError) => { if (attempt === version.current) { setError(errorMessage(requestError, "Unable to load conversations.")); setLoading(false); } });
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
        <div className="chatConversationList">{visible.map((entry) => <button key={entry.id} className={`chatInboxRow ${entry.id === conversationId ? "isSelected" : ""} ${entry.unread_count > 0 ? "hasUnread" : ""}`} aria-current={entry.id === conversationId ? "page" : undefined} onClick={() => navigate(`/messages/${entry.id}`)}>
          <ChatAvatar src={entry.peer_avatar} name="" /><span><strong>{entry.peer_name || entry.peer_username || "Trainer"}</strong><small>{entry.status === "pending" ? (entry.recipient_id === userId ? "Wants to chat with you" : "Waiting for acceptance") : entry.status === "blocked" ? "Blocked" : entry.status === "declined" ? "Request closed" : entry.last_body || "Say hello!"}</small></span>
          {!!entry.unread_count && <b className="chatUnread" aria-label={`${entry.unread_count} unread messages`}>{entry.unread_count > 99 ? "99+" : entry.unread_count}</b>}
        </button>)}</div>
        {!loading && !error && !visible.length && <p className="chatHint">{search ? "No trainers match your search." : tab === "requests" ? "No pending requests." : "Start a conversation from a trainer's profile."}</p>}
      </aside>
      {selected ? <ConversationPane key={selected.id} conversation={selected} userId={userId} ownProfile={ownProfile ? { ...ownProfile, username: ownProfile.username ?? "", display_name: ownProfile.display_name ?? "", bio: ownProfile.bio ?? "" } : null} revision={revision} onRefresh={() => { refresh(); setTab("chats"); }} /> : <section className="chatEmpty"><span className="chatPokeball" aria-hidden="true" /><h2>{conversationId && !loading ? "Conversation unavailable" : "Your next trainer connection"}</h2><p>{conversationId && !loading ? "Choose a conversation from your inbox, or go back to the list." : "Choose a chat or review your requests. Every conversation starts with an invitation."}</p><Link to="/messages" className="chatMobileBack">Back to inbox</Link><Link to="/trainers" className="chatPrimary">Explore trainers</Link></section>}
    </div>
  </main>;
}
export default function MessagesPage() {
  const { user, loading } = useAuth();
  if (loading) return <main className="content messagesPage"><p role="status">Loading account...</p></main>;
  if (!user) return <main className="content messagesPage"><section className="chatEmpty"><MessageCircle /><h1>Your trainer inbox</h1><p>Sign in to send conversation requests and chat with other trainers.</p><Link className="chatPrimary" to="/profile">Sign in</Link></section></main>;
  return <MessagesInbox key={user.id} userId={user.id} />;
}
