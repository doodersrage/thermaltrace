import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetTurnstileToken = vi.fn();
const mockVerifyTurnstileToken = vi.fn();
vi.mock("../../../lib/turnstile", () => ({
  getTurnstileToken: (...a: unknown[]) => mockGetTurnstileToken(...a),
  verifyTurnstileToken: (...a: unknown[]) => mockVerifyTurnstileToken(...a),
}));

const mockCheckStatusSubscribeRateLimit = vi.fn();
const mockIsStatusSubscribeHoneypotTriggered = vi.fn();
vi.mock("../../../lib/statusSubscribeLimits", () => ({
  STATUS_SUBSCRIBE_HONEYPOT_FIELD: "company",
  checkStatusSubscribeRateLimit: (...a: unknown[]) => mockCheckStatusSubscribeRateLimit(...a),
  isStatusSubscribeHoneypotTriggered: (...a: unknown[]) =>
    mockIsStatusSubscribeHoneypotTriggered(...a),
}));

const mockSubscribeToStatusUpdates = vi.fn();
vi.mock("../../../lib/statusSubscriptions", () => ({
  subscribeToStatusUpdates: (...a: unknown[]) => mockSubscribeToStatusUpdates(...a),
}));

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeContext(fields: Record<string, string>, clientAddress = "1.2.3.4"): APIContext {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const request = { formData: () => Promise.resolve(form) } as unknown as Request;
  return { request, redirect: fakeRedirect, clientAddress } as unknown as APIContext;
}

beforeEach(() => {
  mockIsStatusSubscribeHoneypotTriggered.mockReset().mockReturnValue(false);
  mockCheckStatusSubscribeRateLimit.mockReset().mockReturnValue({ ok: true });
  mockGetTurnstileToken.mockReset().mockReturnValue("token");
  mockVerifyTurnstileToken.mockReset().mockResolvedValue({ success: true });
  mockSubscribeToStatusUpdates.mockReset().mockResolvedValue({ ok: true });
});

describe("POST /api/status/subscribe", () => {
  it("redirects as subscribed without side effects when the honeypot is triggered", async () => {
    mockIsStatusSubscribeHoneypotTriggered.mockReturnValue(true);
    const { POST } = await import("./subscribe");

    const response = await POST(makeContext({ email: "a@example.com", company: "bot" }));

    expect(response.headers.get("Location")).toBe("/system-status?subscribed=1");
    expect(mockCheckStatusSubscribeRateLimit).not.toHaveBeenCalled();
    expect(mockSubscribeToStatusUpdates).not.toHaveBeenCalled();
  });

  it("redirects with rate_limited when over the limit", async () => {
    mockCheckStatusSubscribeRateLimit.mockReturnValue({ ok: false });
    const { POST } = await import("./subscribe");

    const response = await POST(makeContext({ email: "a@example.com" }));

    expect(response.headers.get("Location")).toBe("/system-status?status_error=rate_limited");
  });

  it("redirects with verification error when Turnstile fails", async () => {
    mockVerifyTurnstileToken.mockResolvedValue({ success: false });
    const { POST } = await import("./subscribe");

    const response = await POST(makeContext({ email: "a@example.com" }));

    expect(response.headers.get("Location")).toBe("/system-status?status_error=verification");
  });

  it("redirects with invalid_email when the subscription rejects the address", async () => {
    mockSubscribeToStatusUpdates.mockResolvedValue({ ok: false, error: "bad email" });
    const { POST } = await import("./subscribe");

    const response = await POST(makeContext({ email: "not-an-email" }));

    expect(response.headers.get("Location")).toBe("/system-status?status_error=invalid_email");
  });

  it("redirects as subscribed on success", async () => {
    const { POST } = await import("./subscribe");

    const response = await POST(makeContext({ email: "a@example.com" }));

    expect(response.headers.get("Location")).toBe("/system-status?subscribed=1");
    expect(mockSubscribeToStatusUpdates).toHaveBeenCalledWith("a@example.com");
  });

  it("treats a missing email field as an empty string", async () => {
    const { POST } = await import("./subscribe");

    await POST(makeContext({}));

    expect(mockSubscribeToStatusUpdates).toHaveBeenCalledWith("");
  });
});
