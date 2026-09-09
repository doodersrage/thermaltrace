import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("../../../lib/entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

const mockReleaseFcmTokenFromOtherUsers = vi.fn();
vi.mock("../../../lib/fcm", () => ({
  releaseFcmTokenFromOtherUsers: (...a: unknown[]) => mockReleaseFcmTokenFromOtherUsers(...a),
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
  return new Request("https://example.com/api/push/fcm", { method: "POST", body: payload });
}

function makeContext(body: unknown | string): APIContext {
  return { request: makeRequest(body), cookies: {} } as unknown as APIContext;
}

const validToken = { token: "a".repeat(30), platform: "android", appId: "com.example.app" };

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({ user: { id: "user-1" } });
  mockGetUserEntitlements.mockReset().mockResolvedValue({ canUsePush: true });
  mockReleaseFcmTokenFromOtherUsers.mockReset().mockResolvedValue(undefined);
  mockUpsert.mockReset().mockResolvedValue({ error: null });
  mockDeleteEq2.mockReset().mockResolvedValue({ error: null });
  mockDeleteEq1.mockReset().mockReturnValue({ eq: mockDeleteEq2 });
  mockDelete.mockReset().mockReturnValue({ eq: mockDeleteEq1 });
  mockFrom.mockReset().mockReturnValue({ upsert: mockUpsert, delete: mockDelete });
  mockCreateAdminClient.mockReset().mockReturnValue({ from: mockFrom });
  vi.useFakeTimers();
  vi.setSystemTime("2024-06-15T12:00:00.000Z");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/push/fcm", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ user: null });
    const { POST } = await import("./fcm");

    const response = await POST(makeContext(validToken));

    expect(response.status).toBe(401);
  });

  it("returns 403 when the plan doesn't include push", async () => {
    mockGetUserEntitlements.mockResolvedValue({ canUsePush: false });
    const { POST } = await import("./fcm");

    const response = await POST(makeContext(validToken));

    expect(response.status).toBe(403);
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("./fcm");

    const response = await POST(makeContext("not json"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON" });
  });

  it("returns 400 when the token is missing or too short", async () => {
    const { POST } = await import("./fcm");

    expect((await POST(makeContext({}))).status).toBe(400);
    expect((await POST(makeContext({ token: "short" }))).status).toBe(400);
  });

  it("returns 400 for an unrecognized platform", async () => {
    const { POST } = await import("./fcm");

    const response = await POST(makeContext({ ...validToken, platform: "smartwatch" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid platform" });
  });

  it("defaults platform to android and lowercases a given platform", async () => {
    const { POST } = await import("./fcm");

    await POST(makeContext({ token: "a".repeat(30) }));
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ platform: "android" }),
      expect.anything(),
    );

    await POST(makeContext({ token: "a".repeat(30), platform: "IOS" }));
    expect(mockUpsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ platform: "ios" }),
      expect.anything(),
    );
  });

  it("releases the token from other users and upserts it with a null appId when omitted", async () => {
    const { POST } = await import("./fcm");

    const response = await POST(makeContext({ token: "a".repeat(30), platform: "web" }));

    expect(mockReleaseFcmTokenFromOtherUsers).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "a".repeat(30),
    );
    expect(mockFrom).toHaveBeenCalledWith("fcm_device_tokens");
    expect(mockUpsert).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        token: "a".repeat(30),
        platform: "web",
        app_id: null,
        updated_at: "2024-06-15T12:00:00.000Z",
      },
      { onConflict: "user_id,token" },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("trims a given appId", async () => {
    const { POST } = await import("./fcm");

    await POST(makeContext({ token: "a".repeat(30), appId: "  com.example.app  " }));

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ app_id: "com.example.app" }),
      expect.anything(),
    );
  });

  it("returns 500 with the db error message when the upsert fails", async () => {
    mockUpsert.mockResolvedValue({ error: { message: "db down" } });
    const { POST } = await import("./fcm");

    const response = await POST(makeContext(validToken));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "db down" });
  });
});

describe("DELETE /api/push/fcm", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ user: null });
    const { DELETE } = await import("./fcm");

    const response = await DELETE(makeContext({ token: "a".repeat(30) }));

    expect(response.status).toBe(401);
  });

  it("returns 400 when the token is missing or blank", async () => {
    const { DELETE } = await import("./fcm");

    expect((await DELETE(makeContext({}))).status).toBe(400);
    expect((await DELETE(makeContext({ token: "   " }))).status).toBe(400);
  });

  it("deletes the token scoped to the user, trimming it first", async () => {
    const { DELETE } = await import("./fcm");

    const response = await DELETE(makeContext({ token: `  ${"a".repeat(30)}  ` }));

    expect(mockFrom).toHaveBeenCalledWith("fcm_device_tokens");
    expect(mockDeleteEq1).toHaveBeenCalledWith("user_id", "user-1");
    expect(mockDeleteEq2).toHaveBeenCalledWith("token", "a".repeat(30));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
