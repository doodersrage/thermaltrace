import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockConfirmStatusSubscription = vi.fn();
vi.mock("../../../lib/statusSubscriptions", () => ({
  confirmStatusSubscription: (...a: unknown[]) => mockConfirmStatusSubscription(...a),
}));

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeContext(query: string): APIContext {
  const url = new URL(`https://example.com/api/status/confirm${query}`);
  return { url, redirect: fakeRedirect } as unknown as APIContext;
}

beforeEach(() => {
  mockConfirmStatusSubscription.mockReset();
});

describe("GET /api/status/confirm", () => {
  it("redirects with invalid_token when there is no token", async () => {
    const { GET } = await import("./confirm");

    const response = await GET(makeContext(""));

    expect(response.headers.get("Location")).toBe("/system-status?status_error=invalid_token");
    expect(mockConfirmStatusSubscription).not.toHaveBeenCalled();
  });

  it("redirects with invalid_token when the token is only whitespace", async () => {
    const { GET } = await import("./confirm");

    const response = await GET(makeContext("?token=%20%20"));

    expect(response.headers.get("Location")).toBe("/system-status?status_error=invalid_token");
  });

  it("redirects as confirmed when the token is valid", async () => {
    mockConfirmStatusSubscription.mockResolvedValue({ ok: true, message: "confirmed" });
    const { GET } = await import("./confirm");

    const response = await GET(makeContext("?token=abc123"));

    expect(mockConfirmStatusSubscription).toHaveBeenCalledWith("abc123");
    expect(response.headers.get("Location")).toBe("/system-status?confirmed=1");
  });

  it("redirects with invalid_token when confirmation fails", async () => {
    mockConfirmStatusSubscription.mockResolvedValue({ ok: false, message: "expired" });
    const { GET } = await import("./confirm");

    const response = await GET(makeContext("?token=abc123"));

    expect(response.headers.get("Location")).toBe("/system-status?status_error=invalid_token");
  });
});
