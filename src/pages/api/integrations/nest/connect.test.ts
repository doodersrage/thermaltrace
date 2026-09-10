import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("../../../../lib/entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

const mockRequireHouseholdManager = vi.fn();
vi.mock("../../../../lib/householdAuth", () => ({
  requireHouseholdManager: (...a: unknown[]) => mockRequireHouseholdManager(...a),
  redirectUnlessManager: (
    manager: { ok: boolean; error?: string },
    redirectTo: string,
    redirect: (url: string) => Response,
  ) => {
    if (manager.ok) return null;
    return redirect(
      `${redirectTo}?error=${manager.error === "manager_required" ? "manager_required" : "1"}`,
    );
  },
}));

const mockBuildNestAuthorizeUrl = vi.fn();
vi.mock("../../../../lib/thermostatOAuth", () => ({
  buildNestAuthorizeUrl: (...a: unknown[]) => mockBuildNestAuthorizeUrl(...a),
}));

const mockBuildSiteUrl = vi.fn();
vi.mock("../../../../lib/siteUrl", () => ({
  buildSiteUrl: (...a: unknown[]) => mockBuildSiteUrl(...a),
  THERMOSTAT_OAUTH_STATE_COOKIE: "thermostat_oauth_state",
}));

function makeCookies() {
  return {
    get: vi.fn(),
    delete: vi.fn(),
    set: vi.fn(),
  };
}

function makeContext(): APIContext {
  const url = new URL("https://example.com/api/integrations/nest/connect");
  const cookies = makeCookies();
  const redirect = vi.fn(
    (path: string) => new Response(null, { status: 302, headers: { Location: path } }),
  );
  return {
    request: new Request(url),
    cookies,
    redirect,
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "at" },
    user: { id: "user-1" },
  });
  mockGetUserEntitlements.mockReset().mockResolvedValue({ canUseThermostatIntegration: true });
  mockRequireHouseholdManager.mockReset().mockResolvedValue({
    ok: true,
    ctx: { householdId: "house-1", role: "owner" },
  });
  mockBuildSiteUrl.mockReset().mockReturnValue("https://example.com");
  mockBuildNestAuthorizeUrl.mockReset().mockReturnValue(
    "https://nest.example/authorize?state=abc",
  );
});

describe("GET /api/integrations/nest/connect", () => {
  it("redirects to signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./connect");
    const context = makeContext();

    await GET(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
  });

  it("redirects to plans when the plan cannot use thermostat integrations", async () => {
    mockGetUserEntitlements.mockResolvedValue({ canUseThermostatIntegration: false });
    const { GET } = await import("./connect");
    const context = makeContext();

    await GET(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/plans?upgrade=thermostat");
  });

  it("redirects with manager_required when the user is not a household manager", async () => {
    mockRequireHouseholdManager.mockResolvedValue({ ok: false, error: "manager_required" });
    const { GET } = await import("./connect");
    const context = makeContext();

    await GET(context);

    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/devices?error=manager_required",
    );
  });

  it("redirects with not_configured when Nest OAuth is not configured", async () => {
    mockBuildNestAuthorizeUrl.mockReturnValue(null);
    const { GET } = await import("./connect");
    const context = makeContext();

    await GET(context);

    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/devices?thermostat_error=not_configured",
    );
  });

  it("sets the OAuth state cookie and redirects to Nest authorize", async () => {
    const { GET } = await import("./connect");
    const context = makeContext();

    await GET(context);

    expect(context.cookies.set).toHaveBeenCalledWith(
      "thermostat_oauth_state",
      expect.any(String),
      expect.objectContaining({ path: "/", httpOnly: true, sameSite: "lax", maxAge: 600 }),
    );
    expect(mockBuildNestAuthorizeUrl).toHaveBeenCalledWith(
      expect.any(String),
      "https://example.com/api/integrations/nest/callback",
    );
    expect(context.redirect).toHaveBeenCalledWith("https://nest.example/authorize?state=abc");
  });
});
