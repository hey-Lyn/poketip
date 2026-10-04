import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Conversation } from "../services/messages";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), list: vi.fn(), read: vi.fn(), respond: vi.fn(), send: vi.fn(), markRead: vi.fn(), watch: vi.fn() }));
vi.mock("../hooks/useAuth", () => ({ useAuth: mocks.auth }));
vi.mock("../services/messages", async (original) => ({ ...await original<typeof import("../services/messages")>(), listConversations: mocks.list, readMessages: mocks.read, respondConversation: mocks.respond, sendMessage: mocks.send, markConversationRead: mocks.markRead, watchMessages: mocks.watch }));
import MessagesPage from "./MessagesPage";
const incoming: Conversation = { id: "c1", initiator_id: "misty", recipient_id: "me", status: "pending", blocked_by: null, updated_at: "2026-10-04T12:00:00Z", peer_id: "misty", peer_username: "misty", peer_name: "Misty", peer_avatar: null, last_body: null, unread_count: 0 };
function page(path = "/messages/c1") {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/messages" element={<MessagesPage />} /><Route path="/messages/:conversationId" element={<MessagesPage />} /></Routes></MemoryRouter>);
}
describe("messages inbox", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.auth.mockReturnValue({ user: { id: "me" }, loading: false }); mocks.list.mockResolvedValue([incoming]); mocks.read.mockResolvedValue([]); mocks.watch.mockReturnValue(() => {}); mocks.markRead.mockResolvedValue(undefined); });
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
    await waitFor(() => expect(input).toHaveValue("")); expect(screen.getByText("<script>hello</script>")).toBeInTheDocument();
    expect(document.querySelector(".chatHistory script")).toBeNull();
  });
  it("blocks a conversation while keeping its history visible", async () => {
    const user = userEvent.setup(); mocks.list.mockResolvedValue([{ ...incoming, status: "accepted" }]); mocks.read.mockResolvedValue([{ id: "m1", conversation_id: "c1", sender_id: "misty", body: "Hello", created_at: "2026-10-04T12:00:00Z" }]);
    mocks.respond.mockImplementation(async () => { mocks.list.mockResolvedValue([{ ...incoming, status: "blocked", blocked_by: "me" }]); });
    page(); await screen.findByText("Hello"); await user.click(screen.getByRole("button", { name: "Block" }));
    expect(mocks.respond).not.toHaveBeenCalled(); await user.click(screen.getByRole("button", { name: "Confirm block" }));
    await waitFor(() => expect(screen.queryByRole("textbox", { name: "Message Misty" })).not.toBeInTheDocument()); expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});
