import { afterEach, describe, expect, it, vi } from "vitest";

const supabaseMocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@supabase/supabase-js", () => supabaseMocks);

import { checkIpUsageLimit, checkUsageLimit, readClientIp } from "./rateLimit";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.clearAllMocks();
});

function setSupabaseEnv() {
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key";
}

function mockClient(incrementResult, creditResult) {
  const rpc = vi.fn((name) => {
    if (name === "increment_ai_usage") return Promise.resolve(incrementResult);
    if (name === "consume_ai_credit") return Promise.resolve(creditResult);
    return Promise.resolve({ data: null, error: { message: "unknown rpc" } });
  });
  supabaseMocks.createClient.mockReturnValue({ rpc });
  return rpc;
}

describe("checkUsageLimit", () => {
  it("allows usage below the daily limit without spending credits", async () => {
    setSupabaseEnv();
    const rpc = mockClient({ data: 5, error: null }, { data: 50, error: null });

    await expect(checkUsageLimit("u1")).resolves.toEqual({
      source: "daily",
      creditsRemaining: null,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("increment_ai_usage", expect.any(Object));
  });

  it("spends credits once the daily limit is reached", async () => {
    setSupabaseEnv();
    process.env.AI_DAILY_LIMIT = "60";
    process.env.AI_CREDIT_COST = "2";
    const rpc = mockClient({ data: 61, error: null }, { data: 8, error: null });

    await expect(checkUsageLimit("u1")).resolves.toEqual({
      source: "credits",
      creditsRemaining: 8,
    });
    expect(rpc).toHaveBeenCalledWith("consume_ai_credit", {
      p_user_id: "u1",
      p_amount: 2,
    });
  });

  it("rejects when the daily limit is reached and no credits remain", async () => {
    setSupabaseEnv();
    mockClient(
      { data: 61, error: null },
      { data: null, error: { message: "INSUFFICIENT_CREDITS" } },
    );

    await expect(checkUsageLimit("u1"))
      .rejects.toMatchObject({ code: "RATE_LIMITED", status: 429 });
  });

  it("fails closed when usage tracking errors", async () => {
    setSupabaseEnv();
    mockClient({ data: null, error: { message: "function does not exist" } }, null);

    await expect(checkUsageLimit("u1"))
      .rejects.toMatchObject({ code: "USAGE_TRACKING_UNAVAILABLE", status: 503 });
  });

  it("fails closed when credit spending errors unexpectedly", async () => {
    setSupabaseEnv();
    mockClient(
      { data: 61, error: null },
      { data: null, error: { message: "connection reset" } },
    );

    await expect(checkUsageLimit("u1"))
      .rejects.toMatchObject({ code: "USAGE_TRACKING_UNAVAILABLE", status: 503 });
  });

  it("fails closed when usage tracking is not configured", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    supabaseMocks.createClient.mockReturnValue(null);

    await expect(checkUsageLimit("u1"))
      .rejects.toMatchObject({ code: "USAGE_TRACKING_NOT_CONFIGURED", status: 503 });
  });
});

describe("readClientIp", () => {
  it("uses the first x-forwarded-for address", () => {
    expect(readClientIp({ headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } }))
      .toBe("203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    expect(readClientIp({ headers: { "x-real-ip": "198.51.100.4" } }))
      .toBe("198.51.100.4");
  });

  it("falls back to the socket address", () => {
    expect(readClientIp({ headers: {}, socket: { remoteAddress: "127.0.0.1" } }))
      .toBe("127.0.0.1");
  });

  it("uses an unknown bucket when nothing is available", () => {
    expect(readClientIp({})).toBe("unknown");
  });
});

describe("checkIpUsageLimit", () => {
  it("allows requests below the ip limit", async () => {
    setSupabaseEnv();
    const rpc = vi.fn().mockResolvedValue({ data: 3, error: null });
    supabaseMocks.createClient.mockReturnValue({ rpc });

    await expect(
      checkIpUsageLimit({ headers: { "x-forwarded-for": "203.0.113.7" } }),
    ).resolves.toEqual({ ip: "203.0.113.7", usedToday: 3 });
    expect(rpc).toHaveBeenCalledWith("increment_ip_usage", {
      p_ip: "203.0.113.7",
      p_date: expect.any(String),
    });
  });

  it("rejects once the ip limit is exceeded", async () => {
    setSupabaseEnv();
    process.env.AI_IP_DAILY_LIMIT = "2";
    supabaseMocks.createClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: 3, error: null }),
    });

    await expect(
      checkIpUsageLimit({ headers: { "x-forwarded-for": "203.0.113.7" } }),
    ).rejects.toMatchObject({ code: "IP_RATE_LIMITED", status: 429 });
  });

  it("fails closed when ip tracking errors", async () => {
    setSupabaseEnv();
    supabaseMocks.createClient.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
    });

    await expect(checkIpUsageLimit({ headers: {} }))
      .rejects.toMatchObject({ code: "USAGE_TRACKING_UNAVAILABLE", status: 503 });
  });

  it("fails closed when ip tracking is not configured", async () => {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    supabaseMocks.createClient.mockReturnValue(null);

    await expect(checkIpUsageLimit({ headers: {} }))
      .rejects.toMatchObject({ code: "USAGE_TRACKING_NOT_CONFIGURED", status: 503 });
  });
});
