import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockBuildSignInRedirectUrl = vi.fn();
vi.mock("../../../lib/signInErrors", () => ({
  buildSignInRedirectUrl: (...a: unknown[]) => mockBuildSignInRedirectUrl(...a),
}));

const mockApplySessionCookiesAfterAuth = vi.fn();
const mockSetMfaRequiredCookie = vi.fn();
const mockNeedsMfaStepUp = vi.fn();
const mockGetAssuranceLevels = vi.fn();
const mockCreateAuthClient = vi.fn();
vi.mock("../../../lib/mfa", () => ({
  applySessionCookiesAfterAuth: (...a: unknown[]) => mockApplySessionCookiesAfterAuth(...a),
  setMfaRequiredCookie: (...a: unknown[]) => mockSetMfaRequiredCookie(...a),
  needsMfaStepUp: (...a: unknown[]) => mockNeedsMfaStepUp(...a),
  getAssuranceLevels: (...a: unknown[]) => mockGetAssuranceLevels(...a),
  createAuthClient: () => mockCreateAuthClient(),
}));

const mockMapOAuthCallbackError = vi.fn();
const mockSanitizeOAuthErrorDetail = vi.fn();
vi.mock("../../../lib/oauthCallbackErrors", () => ({
  mapOAuthCallbackError: (...a: unknown[]) => mockMapOAuthCallbackError(...a),
  sanitizeOAuthErrorDetail: (...a: unknown[]) => mockSanitizeOAuthErrorDetail(...a),
}));

const mockClearOAuthPkceCookie = vi.fn();
const mockExchangeCodeForSession = vi.fn();
const mockCreateOAuthAuthClient = vi.fn();
vi.mock("../../../lib/oauthAuthClient", () => ({
  clearOAuthPkceCookie: (...a: unknown[]) => mockClearOAuthPkceCookie(...a),
  createOAuthAuthClient: (...a: unknown[]) => mockCreateOAuthAuthClient(...a),
}));

const mockSanitizeNextPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  OAUTH_NEXT_COOKIE: "oauth_next",
  OAUTH_REF_COOKIE: "oauth_ref",
  sanitizeNextPath: (...a: unknown[]) => mockSanitizeNextPath(...a),
}));

const mockApplyReferralForNewUser = vi.fn();
const mockIsLikelyNewUser = vi.fn();
vi.mock("../../../lib/referrals", () => ({
  applyReferralForNewUser: (...a: unknown[]) => mockApplyReferralForNewUser(...a),
  isLikelyNewUser: (...a: unknown[]) => mockIsLikelyNewUser(...a),
}));

vi.mock("../../../lib/registerUrl", () => ({
  REGISTER_NEXT_DEVICES: "/dashboard/temperature",
}));

const mockHasMobileOAuthCookie = vi.fn();
const mockMaybeRedirectMobileOAuth = vi.fn();
vi.mock("../../../lib/mobileAuthRedirect", () => ({
  hasMobileOAuthCookie: (...a: unknown[]) => mockHasMobileOAuthCookie(...a),
  maybeRedirectMobileOAuth: (...a: unknown[]) => mockMaybeRedirectMobileOAuth(...a),
}));

const mockSetAuthCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  setAuthCookies: (...a: unknown[]) => mockSetAuthCookies(...a),
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
  const url = new URL("https://example.com/api/auth/callback");
  for (const [k, v] of Object.entries(options.search ?? {})) url.searchParams.set(k, v);
  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));
  return { url, cookies: makeCookies(options.cookies), redirect } as unknown as APIContext;
}

beforeEach(() => {
  mockBuildSignInRedirectUrl.mockReset().mockImplementation((code: string) => `/signin?error=${code}`);
  mockApplySessionCookiesAfterAuth.mockReset().mockResolvedValue({ redirectTo: "/dashboard" });
  mockSetMfaRequiredCookie.mockReset();
  mockNeedsMfaStepUp.mockReset().mockReturnValue(false);
  mockGetAssuranceLevels.mockReset().mockResolvedValue({});
  mockCreateAuthClient.mockReset().mockReturnValue({ auth: { setSession: vi.fn().mockResolvedValue({}) } });
  mockMapOAuthCallbackError.mockReset().mockReturnValue("oauth_provider_failed");
  mockSanitizeOAuthErrorDetail.mockReset().mockImplementation((d: string | null | undefined) => d ?? null);
  mockClearOAuthPkceCookie.mockReset();
  mockExchangeCodeForSession.mockReset().mockResolvedValue({
    data: { session: { access_token: "at", refresh_token: "rt" }, user: { id: "user-1", created_at: "2020-01-01" } },
    error: null,
  });
  mockCreateOAuthAuthClient.mockReset().mockReturnValue({
    auth: { exchangeCodeForSession: (...a: unknown[]) => mockExchangeCodeForSession(...a) },
  });
  mockSanitizeNextPath.mockReset().mockImplementation((v: string | null | undefined) => v ?? null);
  mockApplyReferralForNewUser.mockReset().mockResolvedValue(undefined);
  mockIsLikelyNewUser.mockReset().mockReturnValue(false);
  mockHasMobileOAuthCookie.mockReset().mockReturnValue(false);
  mockMaybeRedirectMobileOAuth.mockReset().mockResolvedValue(null);
  mockSetAuthCookies.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/auth/callback", () => {
  it("redirects with the mapped error and clears the pkce cookie when the provider returns an error", async () => {
    const { GET } = await import("./callback");
    const context = makeContext({ search: { error: "access_denied", error_description: "nope" } });

    await GET(context);

    expect(mockClearOAuthPkceCookie).toHaveBeenCalled();
    expect(mockMapOAuthCallbackError).toHaveBeenCalledWith("access_denied", "nope");
    expect(context.redirect).toHaveBeenCalledWith("/signin?error=oauth_provider_failed");
  });

  it("omits the detail when the mapped error code isn't oauth_provider_failed", async () => {
    mockMapOAuthCallbackError.mockReturnValue("generic");
    const { GET } = await import("./callback");
    const context = makeContext({ search: { error: "access_denied" } });

    await GET(context);

    expect(mockBuildSignInRedirectUrl).toHaveBeenCalledWith("generic", undefined, null);
  });

  it("redirects to generic when there's no auth code", async () => {
    const { GET } = await import("./callback");
    const context = makeContext();

    await GET(context);

    expect(mockClearOAuthPkceCookie).toHaveBeenCalled();
    expect(mockBuildSignInRedirectUrl).toHaveBeenCalledWith("generic");
  });

  it("redirects to oauth_exchange_failed when the exchange fails", async () => {
    mockExchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: { message: "bad code" } });
    const { GET } = await import("./callback");
    const context = makeContext({ search: { code: "abc" } });

    await GET(context);

    expect(mockBuildSignInRedirectUrl).toHaveBeenCalledWith("oauth_exchange_failed", undefined, "bad code");
  });

  it("applies a referral for a new user with a ref cookie", async () => {
    mockIsLikelyNewUser.mockReturnValue(true);
    const { GET } = await import("./callback");
    const context = makeContext({ search: { code: "abc" }, cookies: { oauth_ref: "REF1" } });

    await GET(context);

    expect(mockApplyReferralForNewUser).toHaveBeenCalledWith("user-1", "ref1", undefined);
  });

  it("does not apply a referral for a returning user", async () => {
    mockIsLikelyNewUser.mockReturnValue(false);
    const { GET } = await import("./callback");
    const context = makeContext({ search: { code: "abc" }, cookies: { oauth_ref: "ref1" } });

    await GET(context);

    expect(mockApplyReferralForNewUser).not.toHaveBeenCalled();
  });

  it("defaults new users to the register-devices page and returning users to /dashboard", async () => {
    mockIsLikelyNewUser.mockReturnValue(true);
    mockSanitizeNextPath.mockReturnValue(null);
    const { GET } = await import("./callback");

    await GET(makeContext({ search: { code: "abc" } }));

    expect(mockApplySessionCookiesAfterAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "/dashboard/temperature",
    );
  });

  it("hands off to the mobile flow when the mobile OAuth cookie is present", async () => {
    mockHasMobileOAuthCookie.mockReturnValue(true);
    mockMaybeRedirectMobileOAuth.mockResolvedValue(
      new Response(null, { status: 302, headers: { Location: "myapp://done" } }),
    );
    const { GET } = await import("./callback");

    const response = await GET(makeContext({ search: { code: "abc" } }));

    expect(mockSetAuthCookies).toHaveBeenCalledWith(expect.anything(), "at", "rt");
    expect(response.headers.get("Location")).toBe("myapp://done");
    expect(mockApplySessionCookiesAfterAuth).not.toHaveBeenCalled();
  });

  it("falls through to the normal redirect when the mobile flow doesn't hand off", async () => {
    mockHasMobileOAuthCookie.mockReturnValue(true);
    mockMaybeRedirectMobileOAuth.mockResolvedValue(null);
    const { GET } = await import("./callback");

    const response = await GET(makeContext({ search: { code: "abc" } }));

    expect(mockApplySessionCookiesAfterAuth).toHaveBeenCalled();
    expect(response.headers.get("Location")).toBe("/dashboard");
  });

  it("redirects using applySessionCookiesAfterAuth's redirectTo on the normal path", async () => {
    mockApplySessionCookiesAfterAuth.mockResolvedValue({ redirectTo: "/dashboard/temperature" });
    const { GET } = await import("./callback");

    const response = await GET(makeContext({ search: { code: "abc" } }));

    expect(response.headers.get("Location")).toBe("/dashboard/temperature");
  });
});
