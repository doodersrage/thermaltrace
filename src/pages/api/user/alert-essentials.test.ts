import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockRequireHouseholdEditor = vi.fn();
const mockRedirectUnlessEditor = vi.fn();
vi.mock("../../../lib/householdAuth", () => ({
  requireHouseholdEditor: (...a: unknown[]) => mockRequireHouseholdEditor(...a),
  redirectUnlessEditor: (...a: unknown[]) => mockRedirectUnlessEditor(...a),
}));

const mockGetAlertSettingsForUser = vi.fn();
const mockSaveAlertSettingsForUser = vi.fn();
const mockNotifyUser = vi.fn();
const mockMarkCooldown = vi.fn();
vi.mock("../../../lib/notify", () => ({
  getAlertSettingsForUser: (...a: unknown[]) => mockGetAlertSettingsForUser(...a),
  saveAlertSettingsForUser: (...a: unknown[]) => mockSaveAlertSettingsForUser(...a),
  notifyUser: (...a: unknown[]) => mockNotifyUser(...a),
  markCooldown: (...a: unknown[]) => mockMarkCooldown(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

const mockRecordHouseholdActivity = vi.fn();
vi.mock("../../../lib/householdActivity", () => ({
  recordHouseholdActivity: (...a: unknown[]) => mockRecordHouseholdActivity(...a),
}));

const mockGetUserHouseholdId = vi.fn();
vi.mock("../../../lib/households", () => ({
  getUserHouseholdId: (...a: unknown[]) => mockGetUserHouseholdId(...a),
}));

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeContext(body: Record<string, string> = {}): APIContext {
  const formData = new FormData();
  for (const [key, value] of Object.entries(body)) formData.set(key, value);
  const request = { formData: async () => formData } as unknown as Request;
  const redirect = vi.fn(fakeRedirect);
  return { request, cookies: {}, redirect } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1", email: "user@example.com", user_metadata: {} },
  });
  mockRequireHouseholdEditor.mockReset().mockResolvedValue({ ok: true, ctx: {} });
  mockRedirectUnlessEditor.mockReset().mockReturnValue(null);
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/devices");
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue({
    enabled: false,
    channelEmail: false,
    email: null,
    freezeThresholdF: 35,
    outageHours: 0,
  });
  mockSaveAlertSettingsForUser.mockReset().mockResolvedValue({ error: null });
  mockGetUserHouseholdId.mockReset().mockResolvedValue("house-1");
  mockRecordHouseholdActivity.mockReset().mockResolvedValue(undefined);
  mockNotifyUser.mockReset().mockResolvedValue({ sent: ["email"], skipped: [] });
  mockMarkCooldown.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/user/alert-essentials", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./alert-essentials");
    const context = makeContext();

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
    expect(response.status).toBe(302);
  });

  it("returns the editor-guard redirect when blocked", async () => {
    const blocked = fakeRedirect("/dashboard/devices?error=viewer");
    mockRequireHouseholdEditor.mockResolvedValue({ ok: false, error: "viewer" });
    mockRedirectUnlessEditor.mockReturnValue(blocked);
    const { POST } = await import("./alert-essentials");
    const context = makeContext();

    const response = await POST(context);

    expect(response).toBe(blocked);
    expect(mockSaveAlertSettingsForUser).not.toHaveBeenCalled();
  });

  it("enables essentials and redirects with alert_saved", async () => {
    const { POST } = await import("./alert-essentials");
    const context = makeContext({
      freeze_threshold_f: "32",
      alert_email: "alerts@example.com",
    });

    const response = await POST(context);

    expect(mockSaveAlertSettingsForUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        enabled: true,
        channelEmail: true,
        email: "alerts@example.com",
        freezeThresholdF: 32,
        outageHours: 2,
      }),
    );
    expect(mockRecordHouseholdActivity).toHaveBeenCalledWith({
      householdId: "house-1",
      userId: "user-1",
      action: "alert_settings_saved",
      detail: "essentials from devices",
    });
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/devices?alert_saved=1");
    expect(response.status).toBe(302);
  });

  it("redirects with alert_error when save fails", async () => {
    mockSaveAlertSettingsForUser.mockResolvedValue({ error: { message: "fail" } });
    const { POST } = await import("./alert-essentials");
    const context = makeContext();

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/devices?alert_error=1");
  });

  it("sends a test alert when also_test is set", async () => {
    const { POST } = await import("./alert-essentials");
    const context = makeContext({ also_test: "1" });

    await POST(context);

    expect(mockNotifyUser).toHaveBeenCalled();
    expect(mockMarkCooldown).toHaveBeenCalledWith("user-1", "last_alert_sent_at");
    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/devices?alert_saved=1&test_sent=1&sent=email",
    );
  });

  it("redirects with test_error when no channels deliver", async () => {
    mockNotifyUser.mockResolvedValue({ sent: [], skipped: ["sms"] });
    const { POST } = await import("./alert-essentials");
    const context = makeContext({ also_test: "1" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/devices?alert_saved=1&test_error=1&test_reason=incomplete",
    );
  });
});
