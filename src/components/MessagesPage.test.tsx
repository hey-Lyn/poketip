import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "../services/messages";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), profile: vi.fn(), trainer: vi.fn(), list: vi.fn(), read: vi.fn(), respond: vi.fn(), send: vi.fn(), edit: vi.fn(), search: vi.fn(), context: vi.fn(), markRead: vi.fn(), watch: vi.fn(), callContext: vi.fn(), startCall: vi.fn() }));
vi.mock("../hooks/useAuth", () => ({ useAuth: mocks.auth }));
vi.mock("../hooks/useProfile", () => ({ useProfile: mocks.profile }));
vi.mock("../services/trainers", () => ({ getTrainerProfile: mocks.trainer }));
vi.mock("../contexts/CallContext", () => ({ useTrainerCall: mocks.callContext }));
vi.mock("../services/messages", async (original) => ({ ...await original<typeof import("../services/messages")>(), listConversations: mocks.list, readMessages: mocks.read, respondConversation: mocks.respond, sendMessage: mocks.send, editMessage: mocks.edit, searchMessages: mocks.search, readMessageContext: mocks.context, markConversationRead: mocks.markRead, watchMessages: mocks.watch }));
import MessagesPage from "./MessagesPage";
const incoming: Conversation = { id: "c1", initiator_id: "misty", recipient_id: "me", status: "pending", blocked_by: null, updated_at: "2026-10-04T12:00:00Z", peer_id: "misty", peer_username: "misty", peer_name: "Misty", peer_avatar: null, last_body: null, unread_count: 0 };
function page(path = "/messages/c1") {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/messages" element={<MessagesPage />} /><Route path="/messages/:conversationId" element={<MessagesPage />} /></Routes></MemoryRouter>);
}
describe("messages inbox", () => {
  beforeEach(() => {
    vi.clearAllMocks(); mocks.auth.mockReturnValue({ user: { id: "me" }, loading: false });
    mocks.profile.mockReturnValue({ profile: { display_name: "Ash", username: "ash", avatar_url: "/ash.png", bio: "My team is ready." } });
    mocks.trainer.mockResolvedValue({ display_name: "Misty", username: "misty", avatar_url: "/misty.png", bio: "Water trainer" });
    HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
    HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
    mocks.list.mockResolvedValue([incoming]); mocks.read.mockResolvedValue([]); mocks.watch.mockReturnValue(() => {}); mocks.markRead.mockResolvedValue(undefined);
    mocks.edit.mockResolvedValue({ id: "m1", conversation_id: "c1", sender_id: "me", body: "Updated message", created_at: "2026-10-04T12:00:00Z", edited_at: "2026-10-04T12:02:00Z" });
    mocks.search.mockResolvedValue([]); mocks.context.mockResolvedValue([]);
    mocks.callContext.mockReturnValue({ available: false, checking: false, busy: false, activeCall: null, calls: [], startCall: mocks.startCall });
  });
  it("requires sign-in without reading someone else's inbox", () => {
    mocks.auth.mockReturnValue({ user: null, loading: false }); page();
    expect(screen.getByRole("link", { name: "Sign in" })).toBeInTheDocument(); expect(mocks.list).not.toHaveBeenCalled();
  });
  it("accepts a received request before exposing the message composer", async () => {
    const user = userEvent.setup(); page(); await screen.findByText("Misty wants to chat");
    expect(screen.queryByRole("textbox", { name: "Message Misty" })).not.toBeInTheDocument();
    mocks.respond.mockImplementation(async () => { mocks.list.mockResolvedValue([{ ...incoming, status: "accepted" }]); });
    await user.click(screen.getByRole("button", { name: "Accept" }));
    expect(mocks.respond).toHaveBeenCalledWith("c1", "accept");
    expect(await screen.findByRole("textbox", { name: "Message Misty" })).toBeInTheDocument();
  });
  it("keeps outgoing requests locked and allows canceling them", async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([{ ...incoming, initiator_id: "me", recipient_id: "misty" }]); page();
    await screen.findByText("Request sent");
    expect(screen.queryByRole("button", { name: "Accept" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Message Misty" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel request" }));
    expect(mocks.respond).toHaveBeenCalledWith("c1", "cancel");
  });
  it("starts voice and video calls only when the service is available", async () => {
    const user = userEvent.setup();
    const conversation = { ...incoming, status: "accepted" };
    mocks.list.mockResolvedValue([conversation]);
    mocks.callContext.mockReturnValue({ available: true, checking: false, busy: false, activeCall: null, calls: [], startCall: mocks.startCall });
    page();
    await user.click(await screen.findByRole("button", { name: "Start voice call" }));
    expect(mocks.startCall).toHaveBeenCalledWith(conversation, "audio");
    await user.click(screen.getByRole("button", { name: "Start screen sharing call" }));
    expect(mocks.startCall).toHaveBeenCalledWith(conversation, "video");
  });
  it("shows real unavailability instead of starting a call without the service", async () => {
    mocks.list.mockResolvedValue([{ ...incoming, status: "accepted" }]);
    page();
    expect(await screen.findByRole("button", { name: "Start voice call" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Start screen sharing call" })).toBeDisabled();
    expect(screen.getByText("Voice calls and screen sharing are currently unavailable.")).toBeInTheDocument();
    expect(mocks.startCall).not.toHaveBeenCalled();
  });
  it("keeps an unsent draft after failure and renders messages as text", async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([{ ...incoming, status: "accepted" }]);
    mocks.send.mockRejectedValueOnce(new Error("Try again")).mockResolvedValueOnce({ id: "m1", conversation_id: "c1", sender_id: "me", body: "<script>hello</script>", created_at: "2026-10-04T12:00:00Z" });
    page(); const input = await screen.findByRole("textbox", { name: "Message Misty" });
    await user.type(input, "<script>hello</script>"); await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again"); expect(input).toHaveValue("<script>hello</script>");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(input).toHaveValue("")); expect(input).toHaveFocus(); expect(screen.getByText("<script>hello</script>")).toBeInTheDocument();
    expect(document.querySelector(".chatHistory script")).toBeNull();
  });
  it("keeps the next draft and the composer focus while a send is pending", async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([{ ...incoming, status: "accepted" }]);
    let complete;
    mocks.send.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    page(); const input = await screen.findByRole("textbox", { name: "Message Misty" });
    await user.type(input, "First{Enter}"); expect(input).toHaveFocus(); expect(input).toBeEnabled();
    await user.clear(input); await user.type(input, "Next draft");
    complete({ id: "m1", conversation_id: "c1", sender_id: "me", body: "First", created_at: "2026-10-04T12:00:00Z" });
    await screen.findByText("First"); expect(input).toHaveValue("Next draft"); expect(input).toHaveFocus();
    expect(screen.queryByText(/Shift \+ Enter for a new line/u)).not.toBeInTheDocument();
  });
  it("quotes a selected message and clears the reply after sending", async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([{ ...incoming, status: "accepted" }]);
    mocks.read.mockResolvedValue([{ id: "original", conversation_id: "c1", sender_id: "misty", body: "Which team?", created_at: "2026-10-04T12:00:00Z" }]);
    mocks.send.mockResolvedValue({ id: "answer", conversation_id: "c1", sender_id: "me", body: "Water!", reply_to_message_id: "original", created_at: "2026-10-04T12:01:00Z" });
    page(); await user.click(await screen.findByRole("button", { name: "Reply to message: Which team?" }));
    const input = screen.getByRole("textbox", { name: "Message Misty" }); expect(input).toHaveFocus();
    expect(screen.getByText("Replying to Misty")).toBeInTheDocument();
    await user.type(input, "Water!{Enter}");
    await screen.findByText("Water!"); expect(mocks.send).toHaveBeenCalledWith("c1", "Water!", "original");
    expect(document.querySelector(".chatQuote")).toHaveTextContent("Which team?");
    expect(screen.queryByRole("button", { name: "Cancel reply" })).not.toBeInTheDocument();
  });
  it("replies to an incoming message on double click and highlights the original", async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([{ ...incoming, status: "accepted" }]);
    mocks.read.mockResolvedValue([{ id: "original", conversation_id: "c1", sender_id: "misty", body: "Double click to reply", created_at: "2026-10-04T12:00:00Z" }]);
    page();
    await user.dblClick(await screen.findByText("Double click to reply"));
    expect(screen.getByText("Replying to Misty")).toBeInTheDocument();
    expect(document.querySelector('[data-message-id="original"]')).toHaveClass("isReplyTarget");
  });
  it("offers context actions and lets the sender edit their own message", async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([{ ...incoming, status: "accepted" }]);
    mocks.read.mockResolvedValue([{ id: "mine", conversation_id: "c1", sender_id: "me", body: "My original message", created_at: "2026-10-04T12:00:00Z" }]);
    page();
    const original = await screen.findByText("My original message");
    const editAction = screen.getByRole("button", { name: "Edit message: My original message" });
    expect(editAction).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reply to message: My original message" })).not.toBeInTheDocument();
    fireEvent.contextMenu(original.closest("article") as HTMLElement, { clientX: 120, clientY: 140 });
    expect(screen.getByRole("menuitem", { name: "Copy text" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Reply" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Edit message" }));
    const editor = screen.getByRole("textbox", { name: "Edit message" });
    expect(editor).toHaveValue("My original message");
    await user.clear(editor); await user.type(editor, "Updated message");
    await user.click(screen.getByRole("button", { name: "Save edited message" }));
    expect(mocks.edit).toHaveBeenCalledWith("mine", "Updated message");
    expect(await screen.findByText(/Updated message/u)).toBeInTheDocument();
  });
  it("searches the whole conversation and jumps to a matching message", async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([{ ...incoming, status: "accepted" }]);
    mocks.read.mockResolvedValue([{ id: "latest", conversation_id: "c1", sender_id: "misty", body: "Latest", created_at: "2026-10-04T12:00:00Z" }]);
    const match = { id: "match", conversation_id: "c1", sender_id: "misty", body: "Tournament battle plan", created_at: "2026-10-01T12:00:00Z" };
    mocks.search.mockResolvedValue([match]); mocks.context.mockResolvedValue([match]);
    page(); await user.click(await screen.findByRole("button", { name: "Search messages" }));
    await user.type(screen.getByRole("searchbox", { name: "Search messages in this conversation" }), "battle");
    const result = await screen.findByRole("button", { name: /Tournament battle plan/u });
    expect(mocks.search).toHaveBeenCalledWith("c1", "battle");
    await user.click(result);
    await waitFor(() => expect(document.querySelector('[data-message-id="match"]')).toHaveClass("isSearchTarget"));
    expect(mocks.context).toHaveBeenCalledWith("c1", "match");
  });
  it("shows the sender's own photo and opens both profile previews", async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([{ ...incoming, status: "accepted", peer_avatar: "/misty.png" }]);
    mocks.read.mockResolvedValue([{ id: "m1", conversation_id: "c1", sender_id: "me", body: "Hello", created_at: "2026-10-04T12:00:00Z" }]);
    page(); await screen.findByText("Hello");
    expect(document.querySelector('.chatMessage img')).toHaveAttribute("src", "/ash.png");
    await user.click(screen.getByRole("button", { name: "Preview Ash's profile" }));
    const profilePreview = screen.getByRole("dialog", { name: "Ash" });
    expect(profilePreview).toHaveTextContent("My team is ready.");
    expect(profilePreview.style.left).toMatch(/px$/u);
    await user.click(screen.getByRole("button", { name: "Close profile preview" }));
    await user.click(screen.getByRole("button", { name: "Preview Misty's profile" }));
    expect(await screen.findByText("Water trainer")).toBeInTheDocument();
    expect(mocks.trainer).toHaveBeenCalledWith("misty");
  });
  it("lets the blocker unblock and resume messaging without losing history", async () => {
    const user = userEvent.setup();
    mocks.list.mockResolvedValue([{ ...incoming, status: "blocked", blocked_by: "me" }]);
    mocks.read.mockResolvedValue([{ id: "m1", conversation_id: "c1", sender_id: "misty", body: "Preserved history", created_at: "2026-10-04T12:00:00Z" }]);
    mocks.respond.mockImplementation(async () => { mocks.list.mockResolvedValue([{ ...incoming, status: "accepted" }]); });
    page();
    await screen.findByText("Preserved history");
    expect(screen.queryByRole("textbox", { name: "Message Misty" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Unblock" }));
    expect(mocks.respond).toHaveBeenCalledWith("c1", "unblock");
    expect(await screen.findByRole("textbox", { name: "Message Misty" })).toBeInTheDocument();
    expect(screen.getByText("Preserved history")).toBeInTheDocument();
  });
  it("does not offer unblock to the trainer who was blocked", async () => {
    mocks.list.mockResolvedValue([{ ...incoming, status: "blocked", blocked_by: "misty" }]);
    page();
    await screen.findByText("This conversation was blocked by the other trainer. Its history is still available.");
    expect(screen.queryByRole("button", { name: "Unblock" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Message Misty" })).not.toBeInTheDocument();
  });
  it("keeps the conversation blocked if unblocking fails", async () => {
    const user = userEvent.setup();
    mocks.list.mockResolvedValue([{ ...incoming, status: "blocked", blocked_by: "me" }]);
    mocks.respond.mockRejectedValueOnce(new Error("Unable to unblock. Try again."));
    page();
    await user.click(await screen.findByRole("button", { name: "Unblock" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to unblock. Try again.");
    expect(screen.getByRole("button", { name: "Unblock" })).toBeEnabled();
    expect(screen.queryByRole("textbox", { name: "Message Misty" })).not.toBeInTheDocument();
  });
  it("blocks a conversation while keeping its history visible", async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([{ ...incoming, status: "accepted" }]); mocks.read.mockResolvedValue([{ id: "m1", conversation_id: "c1", sender_id: "misty", body: "Hello", created_at: "2026-10-04T12:00:00Z" }]);
    mocks.respond.mockImplementation(async () => { mocks.list.mockResolvedValue([{ ...incoming, status: "blocked", blocked_by: "me" }]); });
    page(); await screen.findByText("Hello"); await user.click(screen.getByRole("button", { name: "Block" }));
    expect(mocks.respond).not.toHaveBeenCalled(); await user.click(screen.getByRole("button", { name: "Confirm block" }));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Message Misty" })).not.toBeInTheDocument()); expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
