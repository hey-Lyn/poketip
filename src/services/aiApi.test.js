import { afterEach, describe, expect, it, vi } from "vitest";
import { sendAiMessage } from "./aiApi.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sendAiMessage", () => {
  it("sends the current message and history to the server endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ answer: "Try a defensive set." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendAiMessage("Help with my team", {
      history: [{ role: "assistant", content: "What format?" }],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/chat",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          message: "Help with my team",
          history: [{ role: "assistant", content: "What format?" }],
        }),
      }),
    );
    expect(result.answer).toBe("Try a defensive set.");
  });

  it("shows the server's safe error message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({
          error: { message: "The AI service is not configured yet." },
        }),
      }),
    );

    await expect(sendAiMessage("Hello")).rejects.toThrow(
      "The AI service is not configured yet.",
    );
  });

  it("attaches the session token as a bearer header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ answer: "ok" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendAiMessage("Hello", { token: "jwt-token" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/chat",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer jwt-token",
        }),
      }),
    );
  });
});
