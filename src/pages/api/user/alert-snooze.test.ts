import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
}));

const mockGetAlertSettingsForUser = vi.fn();
const mockSaveAlertSettingsForUser = vi.fn();
vi.mock("../../../lib/notify", () => ({
  getAlertSettingsForUser: (...a: unknown[]) => mockGetAlertSettingsForUser(...a),
  saveAlertSettingsForUser: (...a: unknown[]) => mockSaveAlertSettingsForUser(...a),
}));

const mockSnoozeUntilFromHours = vi.fn();
const mockVacationUntilFromDays = vi.fn();
vi.mock("../../../lib/alertSnooze", () => ({
  snoozeUntilFromHours: (...a: unknown[]) => mockSnoozeUntilFromHours(...a),
  vacationUntilFromDays: (...a: unknown[]) => mockVacationUntilFromDays(...a),
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
  body?: Record<string, string> | string;
  json?: boolean;
} = {}): APIContext {
  const { body, json = false } = options;
  const headers: Record<string, string> = {};
  if (json) headers["content-type"] = "application/json";

  let request: Request;
  if (json) {
    const payload = typeof body === "string" ? body : JSON.stringify(body ?? {});
    request = new Request("https://example.com/api/user/alert-snooze", {
      method: "POST",
      headers,
      body: payload,
    });
  } else {
    const formData = new FormData();
    if (body && typeof body === "object") {
      for (const [key, value] of Object.entries(body)) formData.set(key, value);
    }
    request = { formData: async () => formData, headers: new Headers(headers) } as unknown as Request;
  }

  const redirect = vi.fn(fakeRedirect);
  return { request, cookies: {}, redirect } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1", user_metadata: {} },
  });
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue({ snoozeUntil: null, vacationUntil: null });
  mockSaveAlertSettingsForUser.mockReset().mockResolvedValue(undefined);
  mockSnoozeUntilFromHours.mockReset().mockReturnValue("2024-01-02T00:00:00.000Z");
  mockVacationUntilFromDays.mockReset().mockReturnValue("2024-01-08T00:00:00.000Z");
  mockRequireHouseholdEditor.mockReset().mockResolvedValue({ ok: true, ctx: {} });
  mockRedirectUnlessEditor.mockReset().mockReturnValue(null);
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/alerts");
});

describe("POST /api/user/alert-snooze (form requests)", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./alert-snooze");
    const context = makeContext({ body: { action: "snooze_24" } });

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
    expect(response.status).toBe(302);
  });

  it("returns the editor-guard redirect when the user isn't an editor", async () => {
    const blockedResponse = fakeRedirect("/dashboard/alerts?error=viewer");
    mockRequireHouseholdEditor.mockResolvedValue({ ok: false, error: "viewer" });
    mockRedirectUnlessEditor.mockReturnValue(blockedResponse);
    const { POST } = await import("./alert-snooze");
    const context = makeContext({ body: { action: "snooze_24" } });

    const response = await POST(context);

    expect(response).toBe(blockedResponse);
    expect(mockSaveAlertSettingsForUser).not.toHaveBeenCalled();
  });

  it("snoozes for 24 hours on snooze_24 and redirects with a query flag", async () => {
    const { POST } = await import("./alert-snooze");
    const context = makeContext({ body: { action: "snooze_24" } });

    const response = await POST(context);

    expect(mockSnoozeUntilFromHours).toHaveBeenCalledWith(24);
    expect(mockSaveAlertSettingsForUser).toHaveBeenCalledWith("user-1", {
      snoozeUntil: "2024-01-02T00:00:00.000Z",
      vacationUntil: null,
    });
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/alerts?snooze=1&hours=24");
    expect(response.status).toBe(302);
  });

  it("snoozes for a custom hour count, clamped to the max", async () => {
    const { POST } = await import("./alert-snooze");
    const context = makeContext({ body: { action: "snooze", hours: "9999" } });

    await POST(context);

    expect(mockSnoozeUntilFromHours).toHaveBeenCalledWith(168);
  });

  it("defaults a custom snooze to 24 hours when hours is missing or invalid", async () => {
    const { POST } = await import("./alert-snooze");

    await POST(makeContext({ body: { action: "snooze" } }));
    expect(mockSnoozeUntilFromHours).toHaveBeenLastCalledWith(24);

    await POST(makeContext({ body: { action: "snooze", hours: "not-a-number" } }));
    expect(mockSnoozeUntilFromHours).toHaveBeenLastCalledWith(24);
  });

  it("enables vacation mode for 7 days on vacation_7", async () => {
    const { POST } = await import("./alert-snooze");
    const context = makeContext({ body: { action: "vacation_7" } });

    const response = await POST(context);

    expect(mockVacationUntilFromDays).toHaveBeenCalledWith(7);
    expect(mockSaveAlertSettingsForUser).toHaveBeenCalledWith("user-1", {
      snoozeUntil: null,
      vacationUntil: "2024-01-08T00:00:00.000Z",
    });
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/alerts?vacation=1");
    expect(response.status).toBe(302);
  });

  it("enables vacation mode for a custom day count, clamped to the max", async () => {
    const { POST } = await import("./alert-snooze");
    const context = makeContext({ body: { action: "vacation", days: "9999" } });

    await POST(context);

    expect(mockVacationUntilFromDays).toHaveBeenCalledWith(30);
  });

  it("clears snooze on clear_snooze", async () => {
    mockGetAlertSettingsForUser.mockResolvedValue({ snoozeUntil: "future", vacationUntil: null });
    const { POST } = await import("./alert-snooze");
    const context = makeContext({ body: { action: "clear_snooze" } });

    const response = await POST(context);

    expect(mockSaveAlertSettingsForUser).toHaveBeenCalledWith("user-1", {
      snoozeUntil: null,
      vacationUntil: null,
    });
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/alerts?snooze_cleared=1");
    expect(response.status).toBe(302);
  });

  it("clears vacation on clear_vacation", async () => {
    mockGetAlertSettingsForUser.mockResolvedValue({ snoozeUntil: null, vacationUntil: "future" });
    const { POST } = await import("./alert-snooze");
    const context = makeContext({ body: { action: "clear_vacation" } });

    const response = await POST(context);

    expect(mockSaveAlertSettingsForUser).toHaveBeenCalledWith("user-1", {
      snoozeUntil: null,
      vacationUntil: null,
    });
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/alerts?vacation_cleared=1");
    expect(response.status).toBe(302);
  });

  it("redirects with no query flag for an unknown action", async () => {
    const { POST } = await import("./alert-snooze");
    const context = makeContext({ body: { action: "bogus" } });

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/alerts");
    expect(response.status).toBe(302);
    expect(mockSaveAlertSettingsForUser).not.toHaveBeenCalled();
  });
});

describe("POST /api/user/alert-snooze (JSON requests)", () => {
  it("returns 401 JSON when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./alert-snooze");
    const context = makeContext({ json: true, body: { action: "snooze_24" } });

    const response = await POST(context);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("./alert-snooze");
    const context = makeContext({ json: true, body: "not json" });

    const response = await POST(context);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON" });
  });

  it("returns 403 JSON when the editor guard blocks the request", async () => {
    mockRequireHouseholdEditor.mockResolvedValue({ ok: false, error: "viewer" });
    mockRedirectUnlessEditor.mockReturnValue(fakeRedirect("/dashboard/alerts?error=viewer"));
    const { POST } = await import("./alert-snooze");
    const context = makeContext({ json: true, body: { action: "snooze_24" } });

    const response = await POST(context);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("returns an ok JSON body for a successful snooze", async () => {
    const { POST } = await import("./alert-snooze");
    const context = makeContext({ json: true, body: { action: "snooze_24" } });

    const response = await POST(context);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toMatchObject({
      ok: true,
      kind: "snooze",
      message: "Alerts snoozed for 24 hours.",
    });
  });

  it("returns an ok JSON body for a successful vacation", async () => {
    const { POST } = await import("./alert-snooze");
    const context = makeContext({ json: true, body: { action: "vacation_7" } });

    const json = (await (await POST(context)).json()) as Record<string, unknown>;

    expect(json).toMatchObject({
      ok: true,
      kind: "vacation",
      message: "Vacation mode for 7 days.",
    });
  });

  it("returns 400 JSON for an unknown action", async () => {
    const { POST } = await import("./alert-snooze");
    const context = makeContext({ json: true, body: { action: "bogus" } });

    const response = await POST(context);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Unknown action" });
  });
});
