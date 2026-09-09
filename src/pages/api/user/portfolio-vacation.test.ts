import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockApplyVacationForHouseholdMembers = vi.fn();
const mockClearVacationForHouseholdMembers = vi.fn();
vi.mock("../../../lib/alertSnoozeTokens", () => ({
  applyVacationForHouseholdMembers: (...a: unknown[]) =>
    mockApplyVacationForHouseholdMembers(...a),
  clearVacationForHouseholdMembers: (...a: unknown[]) =>
    mockClearVacationForHouseholdMembers(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("../../../lib/entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

const mockListUserHouseholds = vi.fn();
const mockCanEditHousehold = vi.fn();
vi.mock("../../../lib/households", () => ({
  listUserHouseholds: (...a: unknown[]) => mockListUserHouseholds(...a),
  canEditHousehold: (...a: unknown[]) => mockCanEditHousehold(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeContext(options: {
  body?: Record<string, string | number> | string;
  json?: boolean;
} = {}): APIContext {
  const { body, json = false } = options;
  const headers: Record<string, string> = {};
  if (json) headers["content-type"] = "application/json";

  let request: Request;
  if (json) {
    const payload = typeof body === "string" ? body : JSON.stringify(body ?? {});
    request = new Request("https://example.com/api/user/portfolio-vacation", {
      method: "POST",
      headers,
      body: payload,
    });
  } else {
    const formData = new FormData();
    if (body && typeof body === "object") {
      for (const [key, value] of Object.entries(body)) formData.set(key, String(value));
    }
    request = { formData: async () => formData, headers: new Headers(headers) } as unknown as Request;
  }

  const redirect = vi.fn(fakeRedirect);
  return { request, cookies: {}, redirect } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1" },
  });
  mockGetUserEntitlements.mockReset().mockResolvedValue({ canUsePortfolio: true });
  mockListUserHouseholds.mockReset().mockResolvedValue({
    households: [
      { household_id: "house-1", role: "owner" },
      { household_id: "house-2", role: "viewer" },
    ],
    error: null,
  });
  mockCanEditHousehold.mockReset().mockImplementation((role: string) => role === "owner");
  mockApplyVacationForHouseholdMembers.mockReset().mockResolvedValue(2);
  mockClearVacationForHouseholdMembers.mockReset().mockResolvedValue(1);
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/portfolio");
});

describe("POST /api/user/portfolio-vacation (form)", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./portfolio-vacation");
    const context = makeContext({ body: { action: "vacation", days: "7" } });

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
    expect(response.status).toBe(302);
  });

  it("redirects to plans when portfolio is not entitled", async () => {
    mockGetUserEntitlements.mockResolvedValue({ canUsePortfolio: false });
    const { POST } = await import("./portfolio-vacation");
    const context = makeContext({ body: { action: "vacation" } });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/plans");
  });

  it("applies vacation across editable households and redirects", async () => {
    const { POST } = await import("./portfolio-vacation");
    const context = makeContext({ body: { action: "vacation", days: "10" } });

    const response = await POST(context);

    expect(mockApplyVacationForHouseholdMembers).toHaveBeenCalledWith("house-1", 10);
    expect(mockApplyVacationForHouseholdMembers).toHaveBeenCalledTimes(1);
    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/portfolio?portfolio_vacation=1&days=10&properties=1",
    );
    expect(response.status).toBe(302);
  });
});

describe("POST /api/user/portfolio-vacation (JSON)", () => {
  it("returns 401 JSON when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./portfolio-vacation");
    const context = makeContext({ json: true, body: { action: "vacation" } });

    const response = await POST(context);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("./portfolio-vacation");
    const context = makeContext({ json: true, body: "not json" });

    const response = await POST(context);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON" });
  });

  it("returns 403 when there are no editable properties", async () => {
    mockCanEditHousehold.mockReturnValue(false);
    const { POST } = await import("./portfolio-vacation");
    const context = makeContext({ json: true, body: { action: "vacation" } });

    const response = await POST(context);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "No editable properties" });
  });

  it("returns ok JSON for vacation and clear_vacation", async () => {
    const { POST } = await import("./portfolio-vacation");

    const vacation = await POST(
      makeContext({ json: true, body: { action: "vacation_7", days: 7 } }),
    );
    expect(await vacation.json()).toEqual({
      ok: true,
      action: "vacation",
      days: 7,
      properties: 1,
      members: 2,
    });

    const cleared = await POST(
      makeContext({ json: true, body: { action: "clear_vacation" } }),
    );
    expect(await cleared.json()).toEqual({
      ok: true,
      action: "clear_vacation",
      properties: 1,
      members: 1,
    });
    expect(mockClearVacationForHouseholdMembers).toHaveBeenCalledWith("house-1");
  });

  it("returns 400 for an unknown action", async () => {
    const { POST } = await import("./portfolio-vacation");
    const context = makeContext({ json: true, body: { action: "bogus" } });

    const response = await POST(context);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Unknown action" });
  });
});
