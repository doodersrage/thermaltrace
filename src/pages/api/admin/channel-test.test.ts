import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockIsUserAdmin = vi.fn();
vi.mock("../../../lib/adminAccess", () => ({
  isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a),
}));

const mockGetAlertSettingsForUser = vi.fn();
const mockIsTwilioConfigured = vi.fn();
const mockSendTwilioSms = vi.fn();
vi.mock("../../../lib/notify", () => ({
  getAlertSettingsForUser: (...a: unknown[]) => mockGetAlertSettingsForUser(...a),
  isTwilioConfigured: () => mockIsTwilioConfigured(),
  sendTwilioSms: (...a: unknown[]) => mockSendTwilioSms(...a),
}));

const mockIsVapidConfigured = vi.fn();
const mockSendWebPushToUser = vi.fn();
vi.mock("../../../lib/webPush", () => ({
  isVapidConfigured: () => mockIsVapidConfigured(),
  sendWebPushToUser: (...a: unknown[]) => mockSendWebPushToUser(...a),
}));

function makeContext(form: Record<string, string> | null): APIContext {
  const request = {
    formData: async () => {
      if (form === null) throw new Error("no form");
      const fd = new FormData();
      for (const [k, v] of Object.entries(form)) fd.set(k, v);
      return fd;
    },
  } as unknown as Request;
  return { request, cookies: {} } as unknown as APIContext;
}

function locationOf(response: Response): string | null {
  return response.headers.get("Location");
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1", user_metadata: {} },
  });
  mockIsUserAdmin.mockReset().mockResolvedValue(true);
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue({ smsPhone: null });
  mockIsTwilioConfigured.mockReset().mockReturnValue(true);
  mockSendTwilioSms.mockReset().mockResolvedValue(true);
  mockIsVapidConfigured.mockReset().mockReturnValue(true);
  mockSendWebPushToUser.mockReset().mockResolvedValue({ delivered: 1 });
});

describe("POST /api/admin/channel-test", () => {
  it("returns 403 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./channel-test");

    const response = await POST(makeContext({ kind: "sms" }));

    expect(response.status).toBe(403);
  });

  it("returns 403 when the user isn't an admin", async () => {
    mockIsUserAdmin.mockResolvedValue(false);
    const { POST } = await import("./channel-test");

    const response = await POST(makeContext({ kind: "sms" }));

    expect(response.status).toBe(403);
  });

  it("defaults to sms when the kind is missing", async () => {
    mockGetAlertSettingsForUser.mockResolvedValue({ smsPhone: "+15551234567" });
    const { POST } = await import("./channel-test");

    await POST(makeContext({}));

    expect(mockSendTwilioSms).toHaveBeenCalled();
  });

  it("redirects with sms_not_configured when Twilio isn't configured", async () => {
    mockIsTwilioConfigured.mockReturnValue(false);
    const { POST } = await import("./channel-test");

    const response = await POST(makeContext({ kind: "sms" }));

    expect(locationOf(response)).toBe("/dashboard/ops?channel_error=sms_not_configured");
  });

  it("redirects with sms_no_phone when neither the form nor settings has a phone", async () => {
    const { POST } = await import("./channel-test");

    const response = await POST(makeContext({ kind: "sms" }));

    expect(locationOf(response)).toBe("/dashboard/ops?channel_error=sms_no_phone");
  });

  it("uses the form phone over the settings phone and sends the sms", async () => {
    mockGetAlertSettingsForUser.mockResolvedValue({ smsPhone: "+15550000000" });
    const { POST } = await import("./channel-test");

    const response = await POST(makeContext({ kind: "sms", phone: " +15551234567 " }));

    expect(mockSendTwilioSms).toHaveBeenCalledWith(
      "+15551234567",
      expect.stringContaining("SMS channel smoke test"),
    );
    expect(locationOf(response)).toBe("/dashboard/ops?channel_test=1&channel_kind=sms");
  });

  it("redirects with sms_send_failed when sendTwilioSms returns false", async () => {
    mockGetAlertSettingsForUser.mockResolvedValue({ smsPhone: "+15551234567" });
    mockSendTwilioSms.mockResolvedValue(false);
    const { POST } = await import("./channel-test");

    const response = await POST(makeContext({ kind: "sms" }));

    expect(locationOf(response)).toBe("/dashboard/ops?channel_error=sms_send_failed");
  });

  it("redirects with push_not_configured when VAPID isn't configured", async () => {
    mockIsVapidConfigured.mockReturnValue(false);
    const { POST } = await import("./channel-test");

    const response = await POST(makeContext({ kind: "push" }));

    expect(locationOf(response)).toBe("/dashboard/ops?channel_error=push_not_configured");
  });

  it("redirects with the skipped reason when push delivery fails", async () => {
    mockSendWebPushToUser.mockResolvedValue({ delivered: 0, skippedReason: "no_subscriptions" });
    const { POST } = await import("./channel-test");

    const response = await POST(makeContext({ kind: "push" }));

    expect(locationOf(response)).toBe("/dashboard/ops?channel_error=no_subscriptions");
  });

  it("falls back to push_delivery_failed when there's no skipped reason", async () => {
    mockSendWebPushToUser.mockResolvedValue({ delivered: 0 });
    const { POST } = await import("./channel-test");

    const response = await POST(makeContext({ kind: "push" }));

    expect(locationOf(response)).toBe("/dashboard/ops?channel_error=push_delivery_failed");
  });

  it("redirects with success when push is delivered", async () => {
    const { POST } = await import("./channel-test");

    const response = await POST(makeContext({ kind: "push" }));

    expect(locationOf(response)).toBe("/dashboard/ops?channel_test=1&channel_kind=push");
  });

  it("redirects with unknown_kind for an unrecognized kind", async () => {
    const { POST } = await import("./channel-test");

    const response = await POST(makeContext({ kind: "carrier_pigeon" }));

    expect(locationOf(response)).toBe("/dashboard/ops?channel_error=unknown_kind");
  });
});
