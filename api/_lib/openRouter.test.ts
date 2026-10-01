import { describe, expect, it, vi } from "vitest";
import {
  createOpenRouterCompletion,
  DEFAULT_OPENROUTER_MODEL,
} from "./openRouter";

describe("createOpenRouterCompletion", () => {
  it("keeps the key, model and system prompt under server control", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        model: "openai/gpt-6-luna",
        choices: [{ message: { content: "Use Thunderbolt." } }],
        usage: {
          prompt_tokens: 24,
          completion_tokens: 6,
          total_tokens: 30,
        },
      }),
    });

    const result = await createOpenRouterCompletion({
      apiKey: "server-secret",
      messages: [{ role: "user", content: "Help with Pikachu" }],
      groundingContext: {
        kind: "pokemon",
        pokemon: { id: 25, name: "pikachu", types: ["electric"] },
      },
      fetchImpl,
    });

    const [url, options] = fetchImpl.mock.calls[0];
    const body = JSON.parse(options.body);

    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(options.headers.Authorization).toBe("Bearer server-secret");
    expect(body.model).toBe(DEFAULT_OPENROUTER_MODEL);
    expect(body.max_completion_tokens).toBe(4_000);
    expect(body.reasoning).toEqual({ max_tokens: 256 });
    expect(body).not.toHaveProperty("max_tokens");
    expect(body.messages[0]).toMatchObject({ role: "system" });
    expect(body.messages[0].content).toContain("Never ask follow-up questions");
    expect(body.messages[0].content).toContain("Never end with an offer");
    expect(body.messages[0].content).toContain("recommended Pokémon that is not present");
    expect(body.messages[0].content).toContain("chat has no text-filtering feature");
    expect(body.messages[0].content).not.toContain("under 250 words");
    expect(body.messages[1].content).toContain("APPLICATION CONTEXT");
    expect(body.messages[1].content).toContain('"name":"pikachu"');
    expect(body.messages.at(-1)).toEqual({
      role: "user",
      content: "Help with Pikachu",
    });
    expect(result).toEqual({
      answer: "Use Thunderbolt.",
      model: "openai/gpt-6-luna",
      usage: { promptTokens: 24, completionTokens: 6, totalTokens: 30 },
    });
  });

  it("fails safely when no server key is configured", async () => {
    await expect(
      createOpenRouterCompletion({
        apiKey: "",
        messages: [{ role: "user", content: "Hello" }],
        fetchImpl: vi.fn(),
      }),
    ).rejects.toMatchObject({ code: "AI_NOT_CONFIGURED", status: 503 });
  });

  it("preserves a provider rate limit without leaking its response", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 429 });

    await expect(
      createOpenRouterCompletion({
        apiKey: "server-secret",
        messages: [{ role: "user", content: "Hello" }],
        fetchImpl,
      }),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_ERROR", status: 429 });
  });

  it("returns a timeout error when the provider does not answer", async () => {
    const fetchImpl = vi.fn((_, options) =>
      new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
    );

    await expect(
      createOpenRouterCompletion({
        apiKey: "server-secret",
        messages: [{ role: "user", content: "Hello" }],
        fetchImpl,
        timeoutMs: 1,
      }),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_TIMEOUT", status: 504 });
  });

  it("keeps the timeout active while reading the provider response body", async () => {
    const fetchImpl = vi.fn((_, options) => Promise.resolve({
      ok: true,
      json: () => new Promise((_, reject) => {
        options.signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      }),
    }));

    await expect(
      createOpenRouterCompletion({
        apiKey: "server-secret",
        messages: [{ role: "user", content: "Hello" }],
        fetchImpl,
        timeoutMs: 1,
      }),
    ).rejects.toMatchObject({ code: "AI_PROVIDER_TIMEOUT", status: 504 });
  });

  it("normalizes providers that return text content parts", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        model: "test-model",
        choices: [{
          message: {
            content: [
              { type: "text", text: "First sentence. " },
              { type: "output_text", text: "Second sentence." },
            ],
          },
        }],
      }),
    });

    await expect(createOpenRouterCompletion({
      apiKey: "server-secret",
      messages: [{ role: "user", content: "Hello" }],
      fetchImpl,
    })).resolves.toMatchObject({
      answer: "First sentence. Second sentence.",
    });
  });

  it("automatically continues a usable answer that reaches the output limit", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            finish_reason: "length",
            message: { content: "The analysis starts here." },
          }],
          usage: { prompt_tokens: 20, completion_tokens: 40, total_tokens: 60 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            finish_reason: "stop",
            message: { content: "It now has a complete conclusion." },
          }],
          usage: { prompt_tokens: 55, completion_tokens: 15, total_tokens: 70 },
        }),
      });

    await expect(createOpenRouterCompletion({
      apiKey: "server-secret",
      messages: [{ role: "user", content: "Analyze this team" }],
      fetchImpl,
    })).resolves.toMatchObject({
      answer: "The analysis starts here.\n\nIt now has a complete conclusion.",
      continued: true,
      usage: { promptTokens: 75, completionTokens: 55, totalTokens: 130 },
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const continuationBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(continuationBody.reasoning).toEqual({ max_tokens: 64 });
    expect(continuationBody.max_completion_tokens).toBe(2_000);
    expect(continuationBody.messages.at(-2)).toEqual({
      role: "assistant",
      content: "The analysis starts here.",
    });
    expect(continuationBody.messages.at(-1).content).toContain(
      "Continue the preceding answer",
    );
  });

  it("returns the original text if automatic continuation fails", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            finish_reason: "length",
            message: { content: "The useful part already generated." },
          }],
        }),
      })
      .mockRejectedValueOnce(new Error("network unavailable"));

    await expect(createOpenRouterCompletion({
      apiKey: "server-secret",
      messages: [{ role: "user", content: "Analyze this team" }],
      fetchImpl,
    })).resolves.toMatchObject({
      answer: "The useful part already generated.",
      truncated: true,
    });
  });

  it("retries with minimal reasoning when the provider spends the limit without an answer", async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            finish_reason: "length",
            message: { content: "", reasoning: "unfinished internal work" },
          }],
          usage: { prompt_tokens: 20, completion_tokens: 4000, total_tokens: 4020 },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          choices: [{
            finish_reason: "stop",
            message: { content: "Use a Ground-type defensive pivot." },
          }],
          usage: { prompt_tokens: 25, completion_tokens: 12, total_tokens: 37 },
        }),
      });

    await expect(createOpenRouterCompletion({
      apiKey: "server-secret",
      messages: [{ role: "user", content: "Analyze this team" }],
      fetchImpl,
    })).resolves.toMatchObject({
      answer: "Use a Ground-type defensive pivot.",
      recovered: true,
      usage: { promptTokens: 45, completionTokens: 4012, totalTokens: 4057 },
    });

    const recoveryBody = JSON.parse(fetchImpl.mock.calls[1][1].body);
    expect(recoveryBody.reasoning).toEqual({ max_tokens: 64 });
    expect(recoveryBody.max_completion_tokens).toBe(2_000);
    expect(recoveryBody.messages[1].content).toContain("request immediately");
  });
});
