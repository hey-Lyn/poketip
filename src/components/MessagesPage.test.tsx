import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "../services/messages";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), profile: vi.fn(), trainer: vi.fn(), list: vi.fn(), read: vi.fn(), respond: vi.fn(), send: vi.fn(), markRead: vi.fn(), watch: vi.fn() }));
vi.mock("../hooks/useAuth", () => ({ useAuth: mocks.auth }));
vi.mock("../hooks/useProfile", () => ({ useProfile: mocks.profile }));
vi.mock("../services/trainers", () => ({ getTrainerProfile: mocks.trainer }));
vi.mock("../services/messages", async (original) => ({ ...await original<typeof import("../services/messages")>(), listConversations: mocks.list, readMessages: mocks.read, respondConversation: mocks.respond, sendMessage: mocks.send, markConversationRead: mocks.markRead, watchMessages: mocks.watch }));
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
  it("shows the sender's own photo and opens both profile previews", async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([{ ...incoming, status: "accepted", peer_avatar: "/misty.png" }]);
    mocks.read.mockResolvedValue([{ id: "m1", conversation_id: "c1", sender_id: "me", body: "Hello", created_at: "2026-10-04T12:00:00Z" }]);
    page(); await screen.findByText("Hello");
    expect(document.querySelector('.chatMessage img')).toHaveAttribute("src", "/ash.png");
    await user.click(screen.getByRole("button", { name: "Preview Ash's profile" }));
    expect(screen.getByRole("dialog", { name: "Ash" })).toHaveTextContent("My team is ready.");
    await user.click(screen.getByRole("button", { name: "Close profile preview" }));
    await user.click(screen.getByRole("button", { name: "Preview Misty's profile" }));
    expect(await screen.findByText("Water trainer")).toBeInTheDocument();
    expect(mocks.trainer).toHaveBeenCalledWith("misty");
  });
  it("blocks a conversation while keeping its history visible", async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([{ ...incoming, status: "accepted" }]); mocks.read.mockResolvedValue([{ id: "m1", conversation_id: "c1", sender_id: "misty", body: "Hello", created_at: "2026-10-04T12:00:00Z" }]);
    mocks.respond.mockImplementation(async () => { mocks.list.mockResolvedValue([{ ...incoming, status: "blocked", blocked_by: "me" }]); });
    page(); await screen.findByText("Hello"); await user.click(screen.getByRole("button", { name: "Block" }));
    expect(mocks.respond).not.toHaveBeenCalled(); await user.click(screen.getByRole("button", { name: "Confirm block" }));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Message Misty" })).not.toBeInTheDocument()); expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
