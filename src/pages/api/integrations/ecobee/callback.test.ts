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
  householdManagerCtx: (manager: { ok: boolean; ctx?: { householdId: string } }) => {
    if (!manager.ok) throw new Error("not a manager");
    return manager.ctx;
  },
}));

const mockExchangeEcobeeCode = vi.fn();
vi.mock("../../../../lib/thermostatOAuth", () => ({
  exchangeEcobeeCode: (...a: unknown[]) => mockExchangeEcobeeCode(...a),
}));

const mockGetRuntimeEnv = vi.fn();
vi.mock("../../../../lib/runtimeEnv", () => ({
  getRuntimeEnv: (...a: unknown[]) => mockGetRuntimeEnv(...a),
}));

const mockSaveConnection = vi.fn();
vi.mock("../../../../lib/thermostatConnections", () => ({
  saveConnection: (...a: unknown[]) => mockSaveConnection(...a),
}));

const mockBuildSiteUrl = vi.fn();
vi.mock("../../../../lib/siteUrl", () => ({
  buildSiteUrl: (...a: unknown[]) => mockBuildSiteUrl(...a),
  THERMOSTAT_OAUTH_STATE_COOKIE: "thermostat_oauth_state",
}));

function makeCookies(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: (name: string) => (store.has(name) ? { value: store.get(name)! } : undefined),
    delete: vi.fn((name: string) => store.delete(name)),
    set: vi.fn((name: string, value: string) => store.set(name, value)),
  };
}

function makeContext(options: {
  search?: Record<string, string>;
  cookies?: Record<string, string>;
} = {}): APIContext {
  const url = new URL("https://example.com/api/integrations/ecobee/callback");
  for (const [k, v] of Object.entries(options.search ?? {})) url.searchParams.set(k, v);
  const redirect = vi.fn(
    (path: string) => new Response(null, { status: 302, headers: { Location: path } }),
  );
  return {
    url,
    request: new Request(url),
    cookies: makeCookies(options.cookies),
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
  mockGetRuntimeEnv.mockReset().mockImplementation((key: string) => {
    if (key === "ECOBEE_CLIENT_ID") return "ecobee-client";
    return undefined;
  });
  mockBuildSiteUrl.mockReset().mockReturnValue("https://example.com");
  mockExchangeEcobeeCode.mockReset().mockResolvedValue({
    accessToken: "access",
    refreshToken: "refresh",
    expiresAtMs: Date.now() + 3600_000,
  });
  mockSaveConnection.mockReset().mockResolvedValue({ error: null });
});

describe("GET /api/integrations/ecobee/callback", () => {
  it("redirects to signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./callback");
    const context = makeContext({
      search: { code: "abc", state: "state1" },
      cookies: { thermostat_oauth_state: "state1" },
    });

    await GET(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
  });

  it("redirects with state_mismatch when state is missing or wrong", async () => {
    const { GET } = await import("./callback");
    const context = makeContext({
      search: { code: "abc", state: "wrong" },
      cookies: { thermostat_oauth_state: "state1" },
    });

    await GET(context);

    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/temperature?thermostat_error=state_mismatch",
    );
  });

  it("redirects with denied when the code is missing", async () => {
    const { GET } = await import("./callback");
    const context = makeContext({
      search: { state: "state1" },
      cookies: { thermostat_oauth_state: "state1" },
    });

    await GET(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?thermostat_error=denied");
  });

  it("redirects to plans when the plan cannot use thermostat integrations", async () => {
    mockGetUserEntitlements.mockResolvedValue({ canUseThermostatIntegration: false });
    const { GET } = await import("./callback");
    const context = makeContext({
      search: { code: "abc", state: "state1" },
      cookies: { thermostat_oauth_state: "state1" },
    });

    await GET(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/plans?upgrade=thermostat");
  });

  it("redirects with manager_required when the user is not a household manager", async () => {
    mockRequireHouseholdManager.mockResolvedValue({ ok: false, error: "manager_required" });
    const { GET } = await import("./callback");
    const context = makeContext({
      search: { code: "abc", state: "state1" },
      cookies: { thermostat_oauth_state: "state1" },
    });

    await GET(context);

    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/temperature?error=manager_required",
    );
  });

  it("redirects with not_configured when Ecobee client id is missing", async () => {
    mockGetRuntimeEnv.mockReturnValue(undefined);
    const { GET } = await import("./callback");
    const context = makeContext({
      search: { code: "abc", state: "state1" },
      cookies: { thermostat_oauth_state: "state1" },
    });

    await GET(context);

    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/temperature?thermostat_error=not_configured",
    );
  });

  it("redirects with exchange_failed when token exchange fails", async () => {
    mockExchangeEcobeeCode.mockResolvedValue(null);
    const { GET } = await import("./callback");
    const context = makeContext({
      search: { code: "abc", state: "state1" },
      cookies: { thermostat_oauth_state: "state1" },
    });

    await GET(context);

    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/temperature?thermostat_error=exchange_failed",
    );
  });

  it("redirects with save_failed when persisting the connection fails", async () => {
    mockSaveConnection.mockResolvedValue({ error: "db down" });
    const { GET } = await import("./callback");
    const context = makeContext({
      search: { code: "abc", state: "state1" },
      cookies: { thermostat_oauth_state: "state1" },
    });

    await GET(context);

    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/temperature?thermostat_error=save_failed",
    );
  });

  it("saves the connection and redirects on success", async () => {
    const { GET } = await import("./callback");
    const context = makeContext({
      search: { code: "abc", state: "state1" },
      cookies: { thermostat_oauth_state: "state1" },
    });

    await GET(context);

    expect(mockExchangeEcobeeCode).toHaveBeenCalledWith(
      "ecobee-client",
      "abc",
      "https://example.com/api/integrations/ecobee/callback",
    );
    expect(mockSaveConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        householdId: "house-1",
        provider: "ecobee",
        refreshToken: "refresh",
        accessToken: "access",
        connectedBy: "user-1",
      }),
    );
    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/temperature?thermostat_connected=ecobee",
    );
  });
});
