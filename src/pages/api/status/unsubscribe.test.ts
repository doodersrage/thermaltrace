import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockUnsubscribeStatusSubscription = vi.fn();
vi.mock("../../../lib/statusSubscriptions", () => ({
  unsubscribeStatusSubscription: (...a: unknown[]) => mockUnsubscribeStatusSubscription(...a),
}));

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeContext(query: string): APIContext {
  const url = new URL(`https://example.com/api/status/unsubscribe${query}`);
  return { url, redirect: fakeRedirect } as unknown as APIContext;
}

beforeEach(() => {
  mockUnsubscribeStatusSubscription.mockReset();
});

describe("GET /api/status/unsubscribe", () => {
  it("redirects with invalid_token when there is no token", async () => {
    const { GET } = await import("./unsubscribe");

    const response = await GET(makeContext(""));

    expect(response.headers.get("Location")).toBe("/system-status?status_error=invalid_token");
    expect(mockUnsubscribeStatusSubscription).not.toHaveBeenCalled();
  });

  it("redirects as unsubscribed when the token is valid", async () => {
    mockUnsubscribeStatusSubscription.mockResolvedValue({ ok: true, message: "done" });
    const { GET } = await import("./unsubscribe");

    const response = await GET(makeContext("?token=abc123"));

    expect(mockUnsubscribeStatusSubscription).toHaveBeenCalledWith("abc123");
    expect(response.headers.get("Location")).toBe("/system-status?unsubscribed=1");
  });

  it("redirects with invalid_token when unsubscribing fails", async () => {
    mockUnsubscribeStatusSubscription.mockResolvedValue({ ok: false, message: "not found" });
    const { GET } = await import("./unsubscribe");

    const response = await GET(makeContext("?token=abc123"));

    expect(response.headers.get("Location")).toBe("/system-status?status_error=invalid_token");
  });
});
