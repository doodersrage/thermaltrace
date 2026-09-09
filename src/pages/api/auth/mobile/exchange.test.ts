import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockVerifyMobileExchangeToken = vi.fn();
vi.mock("../../../../lib/mobileAuthExchange", () => ({
  verifyMobileExchangeToken: (...a: unknown[]) => mockVerifyMobileExchangeToken(...a),
}));

function makeContext(body: unknown | string): APIContext {
  const request = {
    json: async () => {
      if (typeof body === "string") throw new Error("invalid");
      return body;
    },
  } as unknown as Request;
  return { request } as unknown as APIContext;
}

beforeEach(() => {
  mockVerifyMobileExchangeToken.mockReset().mockResolvedValue({
    access_token: "at",
    refresh_token: "rt",
  });
});

describe("POST /api/auth/mobile/exchange", () => {
  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("./exchange");

    const response = await POST(makeContext("not json"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON" });
  });

  it("returns 400 when exchange_token is missing or blank", async () => {
    const { POST } = await import("./exchange");

    expect((await POST(makeContext({}))).status).toBe(400);
    expect((await POST(makeContext({ exchange_token: "   " }))).status).toBe(400);
  });

  it("returns 400 when the token is invalid or expired", async () => {
    mockVerifyMobileExchangeToken.mockResolvedValue(null);
    const { POST } = await import("./exchange");

    const response = await POST(makeContext({ exchange_token: "tok" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid or expired exchange token" });
  });

  it("returns the exchanged tokens with a no-store header", async () => {
    const { POST } = await import("./exchange");

    const response = await POST(makeContext({ exchange_token: " tok " }));

    expect(mockVerifyMobileExchangeToken).toHaveBeenCalledWith("tok");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true, access_token: "at", refresh_token: "rt" });
  });
});
