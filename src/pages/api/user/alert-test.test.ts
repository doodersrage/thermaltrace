import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
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

const mockResolveAlertEmail = vi.fn();
vi.mock("../../../lib/alerts", () => ({
  resolveAlertEmail: (...a: unknown[]) => mockResolveAlertEmail(...a),
}));

const mockRequireHouseholdEditor = vi.fn();
const mockRedirectUnlessEditor = vi.fn();
vi.mock("../../../lib/householdAuth", () => ({
  requireHouseholdEditor: (...a: unknown[]) => mockRequireHouseholdEditor(...a),
  redirectUnlessEditor: (...a: unknown[]) => mockRedirectUnlessEditor(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeContext(options: {
  acceptJson?: boolean;
  form?: boolean;
  body?: Record<string, string>;
} = {}): APIContext {
  const { acceptJson = false, form = true, body = {} } = options;
  const headers = new Headers();
  if (acceptJson) headers.set("accept", "application/json");

  let request: Request;
  if (form) {
    headers.set("content-type", "application/x-www-form-urlencoded");
    const formData = new FormData();
    for (const [key, value] of Object.entries(body)) formData.set(key, value);
    request = {
      formData: async () => formData,
      headers,
    } as unknown as Request;
  } else {
    request = new Request("https://example.com/api/user/alert-test", {
      method: "POST",
      headers,
    });
  }

  const redirect = vi.fn(fakeRedirect);
  return { request, cookies: {}, redirect } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1", email: "user@example.com", user_metadata: {} },
  });
  mockRequireHouseholdEditor.mockReset().mockResolvedValue({ ok: true, ctx: {} });
  mockRedirectUnlessEditor.mockReset().mockReturnValue(null);
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/alerts");
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue({
    channelEmail: true,
    email: "alerts@example.com",
  });
  mockResolveAlertEmail.mockReset().mockReturnValue("alerts@example.com");
  mockSaveAlertSettingsForUser.mockReset().mockResolvedValue({ error: null });
  mockNotifyUser.mockReset().mockResolvedValue({ sent: ["email"], skipped: [] });
  mockMarkCooldown.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/user/alert-test (form)", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./alert-test");
    const context = makeContext();

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
    expect(response.status).toBe(302);
  });

  it("returns the editor-guard redirect when blocked", async () => {
    const blocked = fakeRedirect("/dashboard/alerts?error=viewer");
    mockRequireHouseholdEditor.mockResolvedValue({ ok: false, error: "viewer" });
    mockRedirectUnlessEditor.mockReturnValue(blocked);
    const { POST } = await import("./alert-test");
    const context = makeContext();

    const response = await POST(context);

    expect(response).toBe(blocked);
    expect(mockNotifyUser).not.toHaveBeenCalled();
  });

  it("sends a test alert and redirects with test_sent", async () => {
    const { POST } = await import("./alert-test");
    const context = makeContext();

    const response = await POST(context);

    expect(mockNotifyUser).toHaveBeenCalled();
    expect(mockMarkCooldown).toHaveBeenCalledWith("user-1", "last_alert_sent_at");
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/alerts?test_sent=1&sent=email");
    expect(response.status).toBe(302);
  });

  it("redirects with test_error when no channels deliver", async () => {
    mockNotifyUser.mockResolvedValue({ sent: [], skipped: [] });
    const { POST } = await import("./alert-test");
    const context = makeContext();

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/alerts?test_error=1&test_reason=none",
    );
  });
});

describe("POST /api/user/alert-test (JSON accept)", () => {
  it("returns 401 JSON when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./alert-test");
    const context = makeContext({ acceptJson: true, form: false });

    const response = await POST(context);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 JSON when editor role is required", async () => {
    mockRequireHouseholdEditor.mockResolvedValue({ ok: false, error: "viewer" });
    const { POST } = await import("./alert-test");
    const context = makeContext({ acceptJson: true, form: false });

    const response = await POST(context);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Editor role required" });
  });

  it("returns ok JSON when channels deliver", async () => {
    const { POST } = await import("./alert-test");
    const context = makeContext({ acceptJson: true, form: false });

    const response = await POST(context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, sent: ["email"], skipped: [] });
  });

  it("returns 400 JSON when no channels deliver", async () => {
    mockNotifyUser.mockResolvedValue({ sent: [], skipped: ["push"] });
    const { POST } = await import("./alert-test");
    const context = makeContext({ acceptJson: true, form: false });

    const response = await POST(context);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      ok: false,
      error: "No channels delivered",
      reason: "incomplete",
      skipped: ["push"],
    });
  });

  it("returns 500 JSON when notify throws", async () => {
    mockNotifyUser.mockRejectedValue(new Error("boom"));
    const { POST } = await import("./alert-test");
    const context = makeContext({ acceptJson: true, form: false });

    const response = await POST(context);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Test alert failed" });
  });
});
