import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("../../../lib/entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

const mockReleasePushSubscriptionFromOtherUsers = vi.fn();
vi.mock("../../../lib/webPush", () => ({
  releasePushSubscriptionFromOtherUsers: (...a: unknown[]) =>
    mockReleasePushSubscriptionFromOtherUsers(...a),
}));

const mockUpsert = vi.fn();
const mockDeleteEq2 = vi.fn();
const mockDeleteEq1 = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn();
const mockCreateAdminClient = vi.fn();
vi.mock("../../../lib/supabase", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

function makeRequest(body: unknown | string): Request {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("https://example.com/api/push/subscribe", {
    method: "POST",
    body: payload,
  });
}

function makeContext(body: unknown | string): APIContext {
  return { request: makeRequest(body), cookies: {} } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({ user: { id: "user-1" } });
  mockGetUserEntitlements.mockReset().mockResolvedValue({ canUsePush: true });
  mockReleasePushSubscriptionFromOtherUsers.mockReset().mockResolvedValue(undefined);
  mockUpsert.mockReset().mockResolvedValue({ error: null });
  mockDeleteEq2.mockReset().mockResolvedValue({ error: null });
  mockDeleteEq1.mockReset().mockReturnValue({ eq: mockDeleteEq2 });
  mockDelete.mockReset().mockReturnValue({ eq: mockDeleteEq1 });
  mockFrom.mockReset().mockReturnValue({ upsert: mockUpsert, delete: mockDelete });
  mockCreateAdminClient.mockReset().mockReturnValue({ from: mockFrom });
});

const validSubscription = {
  endpoint: "https://push.example.com/abc",
  keys: { p256dh: "p256dh-key", auth: "auth-key" },
};

describe("POST /api/push/subscribe", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ user: null });
    const { POST } = await import("./subscribe");

    const response = await POST(makeContext(validSubscription));

    expect(response.status).toBe(401);
  });

  it("returns 403 when the plan doesn't include push", async () => {
    mockGetUserEntitlements.mockResolvedValue({ canUsePush: false });
    const { POST } = await import("./subscribe");

    const response = await POST(makeContext(validSubscription));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Pro plan required" });
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("./subscribe");

    const response = await POST(makeContext("not json"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON" });
  });

  it("returns 400 when required subscription fields are missing", async () => {
    const { POST } = await import("./subscribe");

    const response = await POST(makeContext({ endpoint: "https://push.example.com/abc" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid subscription" });
  });

  it("releases the endpoint from other users and upserts the subscription", async () => {
    const { POST } = await import("./subscribe");

    const response = await POST(makeContext(validSubscription));

    expect(mockReleasePushSubscriptionFromOtherUsers).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "https://push.example.com/abc",
    );
    expect(mockFrom).toHaveBeenCalledWith("push_subscriptions");
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        endpoint: "https://push.example.com/abc",
        p256dh: "p256dh-key",
        auth: "auth-key",
      },
      { onConflict: "user_id,endpoint" },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("returns 500 with the db error message when the upsert fails", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "db down" } });
    const { POST } = await import("./subscribe");

    const response = await POST(makeContext(validSubscription));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "db down" });
  });
});

describe("DELETE /api/push/subscribe", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ user: null });
    const { DELETE } = await import("./subscribe");

    const response = await DELETE(makeContext({ endpoint: "https://push.example.com/abc" }));

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const { DELETE } = await import("./subscribe");

    const response = await DELETE(makeContext("not json"));

    expect(response.status).toBe(400);
  });

  it("returns 400 when the endpoint is missing", async () => {
    const { DELETE } = await import("./subscribe");

    const response = await DELETE(makeContext({}));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing endpoint" });
  });

  it("deletes the subscription scoped to the user and endpoint", async () => {
    const { DELETE } = await import("./subscribe");

    const response = await DELETE(makeContext({ endpoint: "https://push.example.com/abc" }));

    expect(mockFrom).toHaveBeenCalledWith("push_subscriptions");
    expect(mockDeleteEq1).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockDeleteEq2).toHaveBeenCalledWith("endpoint", "https://push.example.com/abc");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
