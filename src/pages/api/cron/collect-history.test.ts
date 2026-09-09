import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockCollectHistoryForAllUsers = vi.fn();
vi.mock("../../../lib/collectHistory", () => ({
  collectHistoryForAllUsers: (...a: unknown[]) => mockCollectHistoryForAllUsers(...a),
}));

const mockCheckCronRateLimit = vi.fn();
vi.mock("../../../lib/cronLimits", () => ({
  checkCronRateLimit: (...a: unknown[]) => mockCheckCronRateLimit(...a),
}));

const mockTimingSafeEqual = vi.fn();
vi.mock("../../../lib/timingSafeEqual", () => ({
  timingSafeEqual: (...a: unknown[]) => mockTimingSafeEqual(...a),
}));

// import.meta.env is a Proxy that stringifies assigned values, so setting a
// key to `undefined` stores the literal string "undefined" rather than
// clearing it. Always `delete` a key to represent "unset".
const env = import.meta.env as unknown as Record<string, string | undefined>;
const savedSecret = env.CRON_SECRET;

function makeContext(authHeader?: string): APIContext {
  const request = new Request("https://example.com/api/cron/collect-history", {
    method: "POST",
    headers: authHeader ? { authorization: authHeader } : {},
  });
  return { request, clientAddress: "127.0.0.1" } as unknown as APIContext;
}

beforeEach(() => {
  mockCollectHistoryForAllUsers.mockReset().mockResolvedValue({ processed: 3, errors: [] });
  mockCheckCronRateLimit.mockReset().mockReturnValue({ ok: true });
  mockTimingSafeEqual.mockReset().mockReturnValue(true);
  env.CRON_SECRET = "topsecret";
});

afterEach(() => {
  if (savedSecret === undefined) delete env.CRON_SECRET;
  else env.CRON_SECRET = savedSecret;
});

describe("POST /api/cron/collect-history", () => {
  it("returns 429 with a Retry-After header when rate-limited", async () => {
    mockCheckCronRateLimit.mockReturnValue({ ok: false, error: "rate limited", retryAfterSec: 30 });
    const { POST } = await import("./collect-history");

    const response = await POST(makeContext());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("30");
  });

  it("returns 429 without a Retry-After header when none is given", async () => {
    mockCheckCronRateLimit.mockReturnValue({ ok: false, error: "rate limited" });
    const { POST } = await import("./collect-history");

    const response = await POST(makeContext());

    expect(response.headers.get("Retry-After")).toBeNull();
  });

  it("returns 401 when the CRON_SECRET is unset", async () => {
    delete env.CRON_SECRET;
    const { POST } = await import("./collect-history");

    const response = await POST(makeContext("Bearer topsecret"));

    expect(response.status).toBe(401);
  });

  it("returns 401 when the authorization header doesn't match", async () => {
    mockTimingSafeEqual.mockReturnValue(false);
    const { POST } = await import("./collect-history");

    const response = await POST(makeContext("Bearer wrong"));

    expect(response.status).toBe(401);
  });

  it("runs the collection job and returns its result on success", async () => {
    const { POST } = await import("./collect-history");

    const response = await POST(makeContext("Bearer topsecret"));

    expect(mockTimingSafeEqual).toHaveBeenCalledWith("Bearer topsecret", "Bearer topsecret");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processed: 3, errors: [] });
  });

  it("aliases GET to the same handler", async () => {
    const mod = await import("./collect-history");

    expect(mod.GET).toBe(mod.POST);
  });
});
