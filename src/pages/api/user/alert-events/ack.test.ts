import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
vi.mock("../../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
}));

const mockExecuteAlertAckPlaybook = vi.fn();
vi.mock("../../../../lib/alertAckPlaybook", () => ({
  executeAlertAckPlaybook: (...a: unknown[]) => mockExecuteAlertAckPlaybook(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

const mockGetSiteUrl = vi.fn();
vi.mock("../../../../lib/stripe", () => ({
  getSiteUrl: (...a: unknown[]) => mockGetSiteUrl(...a),
}));

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeJsonContext(body: unknown | string): APIContext {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return {
    request: new Request("https://example.com/api/user/alert-events/ack", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: payload,
    }),
    cookies: {},
    redirect: vi.fn(fakeRedirect),
  } as unknown as APIContext;
}

function makeFormContext(body: Record<string, string> = {}): APIContext {
  const formData = new FormData();
  for (const [key, value] of Object.entries(body)) formData.set(key, value);
  return {
    request: {
      formData: async () => formData,
      headers: new Headers({ "Content-Type": "application/x-www-form-urlencoded" }),
    } as unknown as Request,
    cookies: {},
    redirect: vi.fn(fakeRedirect),
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1", email: "user@example.com" },
  });
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/alerts");
  mockGetSiteUrl.mockReset().mockReturnValue("https://example.com/");
  mockExecuteAlertAckPlaybook.mockReset().mockResolvedValue({
    ok: true,
    message: "Acknowledged",
  });
});

describe("POST /api/user/alert-events/ack", () => {
  it("returns 401 JSON when not authenticated and JSON is requested", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./ack");

    const response = await POST(makeJsonContext({ event_id: 1 }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("redirects to signin for form clients when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./ack");
    const context = makeFormContext({ event_id: "1" });

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
    expect(response.status).toBe(302);
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("./ack");

    const response = await POST(makeJsonContext("not json"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON" });
  });

  it("executes the ack playbook and returns JSON success", async () => {
    const { POST } = await import("./ack");

    const response = await POST(
      makeJsonContext({ event_id: 12, action: "snooze_1h" }),
    );

    expect(mockExecuteAlertAckPlaybook).toHaveBeenCalledWith({
      userId: "user-1",
      userEmail: "user@example.com",
      eventId: 12,
      action: "snooze_1h",
      siteUrl: "https://example.com",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      event_id: 12,
      action: "snooze_1h",
      message: "Acknowledged",
    });
  });

  it("redirects with ack_ok for form submissions", async () => {
    const { POST } = await import("./ack");
    const context = makeFormContext({ event_id: "9", action: "ack" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/alerts?ack_ok=1&ack_msg=Acknowledged",
    );
  });
});
