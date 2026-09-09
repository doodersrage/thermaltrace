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

const mockGetAlertSettingsForUser = vi.fn();
const mockSaveAlertSettingsForUser = vi.fn();
vi.mock("../../../lib/notify", () => ({
  getAlertSettingsForUser: (...a: unknown[]) => mockGetAlertSettingsForUser(...a),
  saveAlertSettingsForUser: (...a: unknown[]) => mockSaveAlertSettingsForUser(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
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
    user: { id: "user-1", user_metadata: {} },
  });
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/settings");
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue({
    dataRetentionDays: 90,
  });
  mockGetUserEntitlements.mockReset().mockResolvedValue({
    historyDays: 365,
    tier: "pro",
  });
  mockSaveAlertSettingsForUser.mockReset().mockResolvedValue({ error: null });
});

describe("POST /api/user/retention", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./retention");
    const context = makeContext();

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
    expect(response.status).toBe(302);
  });

  it("saves a clamped retention window for pro users", async () => {
    const { POST } = await import("./retention");
    const context = makeContext({ data_retention_days: "9999" });

    const response = await POST(context);

    expect(mockSaveAlertSettingsForUser).toHaveBeenCalledWith("user-1", {
      dataRetentionDays: 730,
    });
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/settings?retention_saved=1");
    expect(response.status).toBe(302);
  });

  it("clears retention when entitlements history is under 90 days", async () => {
    mockGetUserEntitlements.mockResolvedValue({ historyDays: 30, tier: "basic" });
    const { POST } = await import("./retention");
    const context = makeContext({ data_retention_days: "60" });

    await POST(context);

    expect(mockSaveAlertSettingsForUser).toHaveBeenCalledWith("user-1", {
      dataRetentionDays: null,
    });
  });

  it("redirects with retention_error when save fails", async () => {
    mockSaveAlertSettingsForUser.mockResolvedValue({ error: { message: "fail" } });
    const { POST } = await import("./retention");
    const context = makeContext({ data_retention_days: "90" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/settings?retention_error=1");
  });
});
