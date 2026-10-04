import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSupabase: vi.fn() }));
vi.mock("./auth", () => ({ getSupabase: mocks.getSupabase }));
import { listConversations, readMessages, sendMessage } from "./messages";
describe("trainer messaging service", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.getSupabase.mockReturnValue({ rpc: mocks.rpc }); mocks.rpc.mockResolvedValue({ data: [], error: null }); });
  it("validates messages before writing and accepts PostgREST's composite row response", async () => {
    await expect(sendMessage("c1", "  ")).rejects.toThrow(/Write/u);
    await expect(sendMessage("c1", "x".repeat(2001))).rejects.toThrow(/2,000/u);
    expect(mocks.rpc).not.toHaveBeenCalled();
    const message = { id: "m1", body: "Hello" };
    mocks.rpc.mockResolvedValue({ data: [message], error: null });
    await expect(sendMessage("c1", " Hello ")).resolves.toEqual(message);
    expect(mocks.rpc).toHaveBeenCalledWith("send_trainer_message", { p_conversation: "c1", p_body: "Hello" });
  });
  it("maps missing setup and rejected requests into useful errors", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "PGRST202" } });
    await expect(listConversations()).rejects.toThrow(/database setup/u);
    mocks.rpc.mockResolvedValue({ error: { message: "CONVERSATION_UNAVAILABLE", code: "42501" } });
    await expect(sendMessage("c1", "Hello")).rejects.toThrow(/accepted/u);
  });
  it("returns history in chronological order and passes an older-message cursor", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ id: "new" }, { id: "old" }] });
    await expect(readMessages("c1", "before")).resolves.toEqual([{ id: "old" }, { id: "new" }]);
    expect(mocks.rpc).toHaveBeenCalledWith("read_trainer_messages", { p_conversation: "c1", p_before: "before" });
  });
});
