import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockBuildSignInRedirectUrl = vi.fn();
vi.mock("../../../../lib/signInErrors", () => ({
  buildSignInRedirectUrl: (...a: unknown[]) => mockBuildSignInRedirectUrl(...a),
}));

const mockApplySessionCookiesAfterAuth = vi.fn();
const mockCreateAuthClient = vi.fn();
const mockGetAssuranceLevels = vi.fn();
const mockNeedsMfaStepUp = vi.fn();
const mockSetMfaRequiredCookie = vi.fn();
vi.mock("../../../../lib/mfa", () => ({
  applySessionCookiesAfterAuth: (...a: unknown[]) => mockApplySessionCookiesAfterAuth(...a),
  createAuthClient: () => mockCreateAuthClient(),
  getAssuranceLevels: (...a: unknown[]) => mockGetAssuranceLevels(...a),
  needsMfaStepUp: (...a: unknown[]) => mockNeedsMfaStepUp(...a),
  setMfaRequiredCookie: (...a: unknown[]) => mockSetMfaRequiredCookie(...a),
}));

const mockCompleteGitHubOAuth = vi.fn();
const mockEstablishSessionForGitHubProfile = vi.fn();
vi.mock("../../../../lib/githubOAuth", () => ({
  completeGitHubOAuth: (...a: unknown[]) => mockCompleteGitHubOAuth(...a),
  establishSessionForGitHubProfile: (...a: unknown[]) => mockEstablishSessionForGitHubProfile(...a),
}));

const mockSanitizeOAuthErrorDetail = vi.fn();
vi.mock("../../../../lib/oauthCallbackErrors", () => ({
  sanitizeOAuthErrorDetail: (...a: unknown[]) => mockSanitizeOAuthErrorDetail(...a),
}));

const mockApplyReferralForNewUser = vi.fn();
const mockIsLikelyNewUser = vi.fn();
vi.mock("../../../../lib/referrals", () => ({
  applyReferralForNewUser: (...a: unknown[]) => mockApplyReferralForNewUser(...a),
  isLikelyNewUser: (...a: unknown[]) => mockIsLikelyNewUser(...a),
}));

vi.mock("../../../../lib/registerUrl", () => ({
  REGISTER_NEXT_DEVICES: "/dashboard/devices",
}));

const mockSanitizeNextPath = vi.fn();
vi.mock("../../../../lib/siteUrl", () => ({
  buildGitHubOAuthCallbackUrl: () => "https://example.com/api/auth/github/callback",
  GITHUB_OAUTH_STATE_COOKIE: "github_oauth_state",
  OAUTH_NEXT_COOKIE: "oauth_next",
  OAUTH_REF_COOKIE: "oauth_ref",
  sanitizeNextPath: (...a: unknown[]) => mockSanitizeNextPath(...a),
}));

const mockHasMobileOAuthCookie = vi.fn();
const mockMaybeRedirectMobileOAuth = vi.fn();
vi.mock("../../../../lib/mobileAuthRedirect", () => ({
  hasMobileOAuthCookie: (...a: unknown[]) => mockHasMobileOAuthCookie(...a),
  maybeRedirectMobileOAuth: (...a: unknown[]) => mockMaybeRedirectMobileOAuth(...a),
}));

const mockSetAuthCookies = vi.fn();
vi.mock("../../../../lib/auth", () => ({
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
  const url = new URL("https://example.com/api/auth/github/callback");
  for (const [k, v] of Object.entries(options.search ?? {})) url.searchParams.set(k, v);
  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));
  return {
    url,
    cookies: makeCookies(options.cookies),
    redirect,
    request: new Request(url),
    site: new URL("https://example.com"),
  } as unknown as APIContext;
}

beforeEach(() => {
  mockBuildSignInRedirectUrl.mockReset().mockImplementation((code: string) => `/signin?error=${code}`);
  mockApplySessionCookiesAfterAuth.mockReset().mockResolvedValue({ redirectTo: "/dashboard" });
  mockCreateAuthClient.mockReset().mockReturnValue({ auth: { setSession: vi.fn().mockResolvedValue({}) } });
  mockGetAssuranceLevels.mockReset().mockResolvedValue({});
  mockNeedsMfaStepUp.mockReset().mockReturnValue(false);
  mockSetMfaRequiredCookie.mockReset();
  mockCompleteGitHubOAuth.mockReset().mockResolvedValue({ id: "gh-1", login: "octocat" });
  mockEstablishSessionForGitHubProfile.mockReset().mockResolvedValue({
    session: { access_token: "at", refresh_token: "rt" },
    user: { id: "user-1", created_at: "2020-01-01", app_metadata: {} },
  });
  mockSanitizeOAuthErrorDetail.mockReset().mockImplementation((d: string | null | undefined) => d ?? null);
  mockApplyReferralForNewUser.mockReset().mockResolvedValue(undefined);
  mockIsLikelyNewUser.mockReset().mockReturnValue(false);
  mockSanitizeNextPath.mockReset().mockImplementation((v: string | null | undefined) => v ?? null);
  mockHasMobileOAuthCookie.mockReset().mockReturnValue(false);
  mockMaybeRedirectMobileOAuth.mockReset().mockResolvedValue(null);
  mockSetAuthCookies.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("GET /api/auth/github/callback", () => {
  it("redirects with oauth_provider_failed when GitHub reports an error", async () => {
    const { GET } = await import("./callback");
    const context = makeContext({
      search: { error: "access_denied", error_description: "user cancelled" },
      cookies: { github_oauth_state: "state1" },
    });

    await GET(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin?error=oauth_provider_failed");
  });

  it("redirects to generic when the code or state is missing or mismatched", async () => {
    const { GET } = await import("./callback");

    await GET(makeContext({ search: {}, cookies: { github_oauth_state: "state1" } }));
    expect(mockBuildSignInRedirectUrl).toHaveBeenCalledWith("generic");

    mockBuildSignInRedirectUrl.mockClear();
    await GET(
      makeContext({
        search: { code: "abc", state: "wrong" },
        cookies: { github_oauth_state: "state1" },
      }),
    );
    expect(mockBuildSignInRedirectUrl).toHaveBeenCalledWith("generic");
  });

  it("applies a referral for a new user and redirects to the register-devices page", async () => {
    mockIsLikelyNewUser.mockReturnValue(true);
    mockSanitizeNextPath.mockReturnValue(null);
    const { GET } = await import("./callback");
    const context = makeContext({
      search: { code: "abc", state: "state1" },
      cookies: { github_oauth_state: "state1", oauth_ref: "REF1" },
    });

    await GET(context);

    expect(mockApplyReferralForNewUser).toHaveBeenCalledWith("user-1", "ref1", {});
    expect(mockApplySessionCookiesAfterAuth).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      "/dashboard/devices",
    );
  });

  it("hands off to mobile when the mobile OAuth cookie is present", async () => {
    mockHasMobileOAuthCookie.mockReturnValue(true);
    const handoff = new Response(null, { status: 302, headers: { Location: "myapp://done" } });
    mockMaybeRedirectMobileOAuth.mockResolvedValue(handoff);
    const { GET } = await import("./callback");
    const context = makeContext({
      search: { code: "abc", state: "state1" },
      cookies: { github_oauth_state: "state1" },
    });

    const response = await GET(context);

    expect(mockSetAuthCookies).toHaveBeenCalledWith(expect.anything(), "at", "rt");
    expect(response).toBe(handoff);
  });

  it("redirects normally when there's no mobile cookie", async () => {
    const { GET } = await import("./callback");
    const context = makeContext({
      search: { code: "abc", state: "state1" },
      cookies: { github_oauth_state: "state1" },
    });

    const response = await GET(context);

    expect(response.headers.get("Location")).toBe("/dashboard");
  });

  it("catches a thrown error from the OAuth exchange and redirects with the sanitized detail", async () => {
    mockCompleteGitHubOAuth.mockRejectedValue(new Error("github down"));
    const { GET } = await import("./callback");
    const context = makeContext({
      search: { code: "abc", state: "state1" },
      cookies: { github_oauth_state: "state1" },
    });

    await GET(context);

    expect(mockBuildSignInRedirectUrl).toHaveBeenCalledWith(
      "oauth_github_profile",
      undefined,
      "github down",
    );
  });
});
