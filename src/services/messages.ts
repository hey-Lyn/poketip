import { getSupabase } from "./auth";

export const MAX_MESSAGE_LENGTH = 2000;
export interface Conversation {
  id: string; initiator_id: string; recipient_id: string;
  status: "pending" | "accepted" | "declined" | "blocked";
  blocked_by: string | null; updated_at: string;
  peer_id: string; peer_username: string; peer_name: string; peer_avatar: string | null;
  last_body: string | null; unread_count: number;
}
export interface ReplyContext { id: string; sender_id: string; body: string }
export interface ChatMessage { id: string; conversation_id: string; sender_id: string; body: string; created_at: string; edited_at?: string | null; reply_to_message_id?: string | null; reply?: ReplyContext | null }
export type ConversationAction = "accept" | "decline" | "cancel" | "block" | "unblock";

async function rpc(name: string, args = {}) {
  const client = getSupabase();
  if (!client) throw new Error("Sign in to use messages.");
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const reasons = {
      AUTH_REQUIRED: "Sign in to use messages.",
      PROFILE_UNAVAILABLE: "Both trainers must enable their shared profiles to start or send messages.",
      CONVERSATION_UNAVAILABLE: "This conversation is unavailable or hasn't been accepted.",
      REQUEST_RATE_LIMIT: "Too many requests. Try again in an hour.",
      MESSAGE_RATE_LIMIT: "You're sending messages too quickly. Wait a minute and try again.",
      INVALID_CONVERSATION_ACTION: "This request has changed. Refresh your inbox and try again.",
      REPLY_UNAVAILABLE: "The message you selected is unavailable. Choose another message to reply to.",
    };
    if (error.code === "PGRST202" || error.code === "42P01") throw new Error("Messages are waiting for their database setup.");
    throw new Error(reasons[error.message] ?? "Unable to complete this action. Please try again.");
  }
  return data;
}
export async function listConversations(): Promise<Conversation[]> {
  return (await rpc("list_trainer_conversations")) ?? [];
}
export async function requestConversation(recipientId: string): Promise<string> {
  if (!recipientId) throw new Error("Choose a trainer first.");
  return rpc("request_trainer_conversation", { p_recipient: recipientId });
}
export async function respondConversation(id: string, action: ConversationAction) {
  await rpc("respond_trainer_conversation", { p_conversation: id, p_action: action });
}
export async function readMessages(id: string, before: string | null = null): Promise<ChatMessage[]> {
  const messages: ChatMessage[] = ((await rpc("read_trainer_messages", { p_conversation: id, p_before: before })) ?? []).reverse();
  const replies = messages.filter((message) => message.reply_to_message_id);
  if (!replies.length) return messages;
  const contexts: ReplyContext[] = (await rpc("read_trainer_reply_contexts", { p_conversation: id, p_messages: replies.map((message) => message.id) })) ?? [];
  const byId = new Map(contexts.map((context) => [context.id, context]));
  return messages.map((message) => ({ ...message, reply: byId.get(message.reply_to_message_id ?? "") ?? null }));
}
export async function sendMessage(id: string, body: string, replyTo?: string | null): Promise<ChatMessage> {
  const text = body.trim();
  if (!text || text.length > MAX_MESSAGE_LENGTH) throw new Error("Write a message of 1–2,000 characters.");
  const data = replyTo ? await rpc("reply_to_trainer_message", { p_conversation: id, p_body: text, p_reply_to: replyTo })
    : await rpc("send_trainer_message", { p_conversation: id, p_body: text });
  return Array.isArray(data) ? data[0] : data;
}
export async function editMessage(id: string, body: string): Promise<ChatMessage> {
  const text = body.trim();
  if (!id) throw new Error("Choose a message to edit.");
  if (!text || text.length > MAX_MESSAGE_LENGTH) throw new Error("Write a message of 1–2,000 characters.");
  const client = getSupabase();
  if (!client) throw new Error("Sign in to use messages.");
  const { data, error } = await client.from("trainer_messages").update({ body: text }).eq("id", id).select("*").single();
  if (error || !data) throw new Error("Unable to edit this message. Refresh the conversation and try again.");
  return data as ChatMessage;
}
export async function searchMessages(id: string, query: string, before: string | null = null): Promise<ChatMessage[]> {
  const text = query.trim();
  if (text.length < 2 || text.length > 100) throw new Error("Search with 2–100 characters.");
  return (await rpc("search_trainer_messages", { p_conversation: id, p_query: text, p_before: before })) ?? [];
}
export async function readMessageContext(conversationId: string, messageId: string): Promise<ChatMessage[]> {
  return (await rpc("read_trainer_message_context", { p_conversation: conversationId, p_message: messageId })) ?? [];
}
export async function markConversationRead(id: string, messageId: string) {
  await rpc("mark_trainer_conversation_read", { p_conversation: id, p_message: messageId });
}
export function watchMessages(userId: string, onChange: () => void) {
  // Debounce the message + conversation events generated by one send.
  let timer;
  const invalidate = () => { clearTimeout(timer); timer = setTimeout(onChange, 150); };
  const client = getSupabase();
  if (!client) return () => {};
  // Message events are filtered by the participants-only SELECT policy.
  const channel = client.channel(`trainer-inbox-${userId}-${crypto.randomUUID()}`);
  for (const event of ["INSERT", "UPDATE"] as const) {
    channel.on("postgres_changes", { event, schema: "public", table: "trainer_messages" }, invalidate);
  }
  // Subscribe only to events that honor row-level SELECT authorization.
  for (const event of ["INSERT", "UPDATE"] as const) for (const participant of ["initiator_id", "recipient_id"]) {
    channel.on("postgres_changes", { event, schema: "public", table: "trainer_conversations", filter: `${participant}=eq.${userId}` }, invalidate);
  }
  channel.subscribe((status) => { if (status === "SUBSCRIBED") invalidate(); });
  return () => { clearTimeout(timer); void client.removeChannel(channel); };
}
