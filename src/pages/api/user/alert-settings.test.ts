import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
}));

const mockUpdateUserAlertSettings = vi.fn();
vi.mock("../../../lib/alertNotifications", () => ({
  updateUserAlertSettings: (...a: unknown[]) => mockUpdateUserAlertSettings(...a),
}));

const mockAlertChannelsIncomplete = vi.fn();
const mockBuildAlertSettingsFromFormData = vi.fn();
const mockFindInvalidAlertWebhookUrl = vi.fn();
const mockIsWeakTelegramSecret = vi.fn();
vi.mock("../../../lib/alertSettingsForm", () => ({
  alertChannelsIncomplete: (...a: unknown[]) => mockAlertChannelsIncomplete(...a),
  buildAlertSettingsFromFormData: (...a: unknown[]) =>
    mockBuildAlertSettingsFromFormData(...a),
  findInvalidAlertWebhookUrl: (...a: unknown[]) => mockFindInvalidAlertWebhookUrl(...a),
  isWeakTelegramSecret: (...a: unknown[]) => mockIsWeakTelegramSecret(...a),
}));

const mockGetAlertSettingsForUser = vi.fn();
vi.mock("../../../lib/notify", () => ({
  getAlertSettingsForUser: (...a: unknown[]) => mockGetAlertSettingsForUser(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("../../../lib/entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

const mockRequireHouseholdEditor = vi.fn();
const mockRedirectUnlessEditor = vi.fn();
vi.mock("../../../lib/householdAuth", () => ({
  requireHouseholdEditor: (...a: unknown[]) => mockRequireHouseholdEditor(...a),
  redirectUnlessEditor: (...a: unknown[]) => mockRedirectUnlessEditor(...a),
}));

const mockRecordHouseholdActivity = vi.fn();
vi.mock("../../../lib/householdActivity", () => ({
  recordHouseholdActivity: (...a: unknown[]) => mockRecordHouseholdActivity(...a),
}));

const mockGetUserHouseholdId = vi.fn();
vi.mock("../../../lib/households", () => ({
  getUserHouseholdId: (...a: unknown[]) => mockGetUserHouseholdId(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../lib/siteUrl", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/siteUrl")>();
  return {
    ...actual,
    formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
  };
});

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeContext(body: Record<string, string> = {}): APIContext {
  const formData = new FormData();
  for (const [key, value] of Object.entries(body)) formData.set(key, value);
  return {
    request: { formData: async () => formData } as unknown as Request,
    cookies: {},
    redirect: vi.fn(fakeRedirect),
  } as unknown as APIContext;
}

const settings = { enabled: true, telegramCommandSecret: "strong-secret" };

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({
    session: { access_token: "at", refresh_token: "rt" },
    user: { id: "user-1", user_metadata: {} },
  });
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/alerts");
  mockRequireHouseholdEditor.mockReset().mockResolvedValue({ ok: true, ctx: {} });
  mockRedirectUnlessEditor.mockReset().mockReturnValue(null);
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue({ enabled: false });
  mockGetUserEntitlements.mockReset().mockResolvedValue({ canUseSms: true });
  mockBuildAlertSettingsFromFormData.mockReset().mockReturnValue(settings);
  mockFindInvalidAlertWebhookUrl.mockReset().mockReturnValue(null);
  mockIsWeakTelegramSecret.mockReset().mockReturnValue(false);
  mockUpdateUserAlertSettings.mockReset().mockResolvedValue({ error: null });
  mockGetUserHouseholdId.mockReset().mockResolvedValue("house-1");
  mockRecordHouseholdActivity.mockReset().mockResolvedValue(undefined);
  mockAlertChannelsIncomplete.mockReset().mockReturnValue(false);
});

describe("POST /api/user/alert-settings", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./alert-settings");
    const context = makeContext();

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
    expect(response.status).toBe(302);
  });

  it("returns the editor-guard redirect when blocked", async () => {
    const blocked = fakeRedirect("/dashboard/alerts?error=viewer");
    mockRequireHouseholdEditor.mockResolvedValue({ ok: false });
    mockRedirectUnlessEditor.mockReturnValue(blocked);
    const { POST } = await import("./alert-settings");
    const context = makeContext();

    const response = await POST(context);

    expect(response).toBe(blocked);
    expect(mockUpdateUserAlertSettings).not.toHaveBeenCalled();
  });

  it("redirects with invalid_webhook_url when a webhook fails validation", async () => {
    mockFindInvalidAlertWebhookUrl.mockReturnValue("https://bad.example");
    const { POST } = await import("./alert-settings");
    const context = makeContext();

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/alerts?alert_error=invalid_webhook_url",
    );
  });

  it("saves settings and records household activity", async () => {
    const { POST } = await import("./alert-settings");
    const context = makeContext();

    const response = await POST(context);

    expect(mockUpdateUserAlertSettings).toHaveBeenCalledWith(
      "at",
      "rt",
      "user-1",
      settings,
    );
    expect(mockRecordHouseholdActivity).toHaveBeenCalledWith({
      householdId: "house-1",
      userId: "user-1",
      action: "alert_settings_saved",
      detail: "alerts on",
    });
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/alerts?alert_saved=1");
    expect(response.status).toBe(302);
  });
});
