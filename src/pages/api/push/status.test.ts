import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("../../../lib/entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

const mockCountFcmTokens = vi.fn();
const mockIsFcmConfigured = vi.fn();
vi.mock("../../../lib/fcm", () => ({
  countFcmTokens: (...a: unknown[]) => mockCountFcmTokens(...a),
  isFcmConfigured: () => mockIsFcmConfigured(),
}));

const mockGetAlertSettingsForUser = vi.fn();
vi.mock("../../../lib/notify", () => ({
  getAlertSettingsForUser: (...a: unknown[]) => mockGetAlertSettingsForUser(...a),
}));

const mockCountPushSubscriptions = vi.fn();
const mockIsVapidConfigured = vi.fn();
vi.mock("../../../lib/webPush", () => ({
  countPushSubscriptions: (...a: unknown[]) => mockCountPushSubscriptions(...a),
  isVapidConfigured: () => mockIsVapidConfigured(),
}));

function makeContext(): APIContext {
  return { cookies: {} } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    user: { id: "user-1", user_metadata: {} },
  });
  mockGetUserEntitlements.mockReset().mockResolvedValue({ canUsePush: true });
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue({ channelPush: true });
  mockCountPushSubscriptions.mockReset().mockResolvedValue(1);
  mockCountFcmTokens.mockReset().mockResolvedValue(0);
  mockIsVapidConfigured.mockReset().mockReturnValue(true);
  mockIsFcmConfigured.mockReset().mockReturnValue(false);
});

describe("GET /api/push/status", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ user: null });
    const { GET } = await import("./status");

    const response = await GET(makeContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("reports ready=true when entitled, enabled, has a device, and a provider is configured", async () => {
    const { GET } = await import("./status");

    const response = await GET(makeContext());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      canUsePush: true,
      vapidConfigured: true,
      fcmConfigured: false,
      channelEnabled: true,
      subscriptionCount: 1,
      fcmTokenCount: 0,
      deviceCount: 1,
      ready: true,
    });
  });

  it("reports ready=false when the plan doesn't include push", async () => {
    mockGetUserEntitlements.mockResolvedValue({ canUsePush: false });
    const { GET } = await import("./status");

    const json = (await (await GET(makeContext())).json()) as Record<string, unknown>;

    expect(json.ready).toBe(false);
  });

  it("reports ready=false when the push channel is disabled in settings", async () => {
    mockGetAlertSettingsForUser.mockResolvedValue({ channelPush: false });
    const { GET } = await import("./status");

    const json = (await (await GET(makeContext())).json()) as Record<string, unknown>;

    expect(json.ready).toBe(false);
  });

  it("reports ready=false when there are no registered devices", async () => {
    mockCountPushSubscriptions.mockResolvedValue(0);
    mockCountFcmTokens.mockResolvedValue(0);
    const { GET } = await import("./status");

    const json = (await (await GET(makeContext())).json()) as Record<string, unknown>;

    expect(json.deviceCount).toBe(0);
    expect(json.ready).toBe(false);
  });

  it("reports ready=false when neither VAPID nor FCM is configured", async () => {
    mockIsVapidConfigured.mockReturnValue(false);
    mockIsFcmConfigured.mockReturnValue(false);
    const { GET } = await import("./status");

    const json = (await (await GET(makeContext())).json()) as Record<string, unknown>;

    expect(json.ready).toBe(false);
  });

  it("sums web push subscriptions and FCM tokens into deviceCount", async () => {
    mockCountPushSubscriptions.mockResolvedValue(2);
    mockCountFcmTokens.mockResolvedValue(3);
    const { GET } = await import("./status");

    const json = (await (await GET(makeContext())).json()) as Record<string, unknown>;

    expect(json.deviceCount).toBe(5);
  });
});
