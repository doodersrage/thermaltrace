import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockBuildSignInRedirectUrl = vi.fn();
const mockMapSignInError = vi.fn();
vi.mock("../../../lib/signInErrors", () => ({
  buildSignInRedirectUrl: (...a: unknown[]) => mockBuildSignInRedirectUrl(...a),
  mapSignInError: (...a: unknown[]) => mockMapSignInError(...a),
}));

const mockApplySessionCookiesAfterAuth = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockCreateAuthClient = vi.fn();
vi.mock("../../../lib/mfa", () => ({
  applySessionCookiesAfterAuth: (...a: unknown[]) => mockApplySessionCookiesAfterAuth(...a),
  createAuthClient: () => mockCreateAuthClient(),
}));

vi.mock("../../../lib/oauthCallbackErrors", () => ({
  mapOAuthCallbackError: vi.fn(),
  sanitizeOAuthErrorDetail: vi.fn(),
}));

const mockSignInWithOAuth = vi.fn();
const mockCreateOAuthAuthClient = vi.fn();
vi.mock("../../../lib/oauthAuthClient", () => ({
  createOAuthAuthClient: (...a: unknown[]) => mockCreateOAuthAuthClient(...a),
}));

const mockSanitizeNextPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  buildGitHubOAuthCallbackUrl: () => "https://example.com/api/auth/github/callback",
  buildOAuthCallbackUrl: () => "https://example.com/api/auth/callback",
  GITHUB_OAUTH_STATE_COOKIE: "github_oauth_state",
  OAUTH_NEXT_COOKIE: "oauth_next",
  OAUTH_REF_COOKIE: "oauth_ref",
  sanitizeNextPath: (...a: unknown[]) => mockSanitizeNextPath(...a),
}));

const mockBuildGitHubAuthorizeUrl = vi.fn();
const mockIsGitHubOAuthConfigured = vi.fn();
vi.mock("../../../lib/githubOAuth", () => ({
  buildGitHubAuthorizeUrl: (...a: unknown[]) => mockBuildGitHubAuthorizeUrl(...a),
  isGitHubOAuthConfigured: () => mockIsGitHubOAuthConfigured(),
}));

const mockGetTurnstileToken = vi.fn();
const mockVerifyTurnstileToken = vi.fn();
vi.mock("../../../lib/turnstile", () => ({
  getTurnstileToken: (...a: unknown[]) => mockGetTurnstileToken(...a),
  verifyTurnstileToken: (...a: unknown[]) => mockVerifyTurnstileToken(...a),
}));

const mockCheckSigninRateLimit = vi.fn();
const mockClearSigninFailures = vi.fn();
const mockRecordSigninFailure = vi.fn();
vi.mock("../../../lib/signinLimits", () => ({
  checkSigninRateLimit: (...a: unknown[]) => mockCheckSigninRateLimit(...a),
  clearSigninFailures: (...a: unknown[]) => mockClearSigninFailures(...a),
  recordSigninFailure: (...a: unknown[]) => mockRecordSigninFailure(...a),
}));

function makeCookies() {
  const store = new Map<string, string>();
  return {
    get: (name: string) => (store.has(name) ? { value: store.get(name)! } : undefined),
    set: vi.fn((name: string, value: string) => store.set(name, value)),
    delete: vi.fn((name: string) => store.delete(name)),
  };
}

function makeContext(form: Record<string, string>): APIContext {
  const formData = new FormData();
  for (const [k, v] of Object.entries(form)) formData.set(k, v);
  const request = { formData: async () => formData } as unknown as Request;
  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));
  return {
    request,
    cookies: makeCookies(),
    redirect,
    clientAddress: "127.0.0.1",
    site: new URL("https://example.com"),
  } as unknown as APIContext;
}

beforeEach(() => {
  mockBuildSignInRedirectUrl.mockReset().mockImplementation((code: string) => `/signin?error=${code}`);
  mockMapSignInError.mockReset().mockReturnValue("invalid_credentials");
  mockApplySessionCookiesAfterAuth.mockReset().mockResolvedValue({ redirectTo: "/dashboard" });
  mockSignInWithPassword.mockReset().mockResolvedValue({
    data: { session: { access_token: "at", refresh_token: "rt" } },
    error: null,
  });
  mockCreateAuthClient.mockReset().mockReturnValue({
    auth: { signInWithPassword: (...a: unknown[]) => mockSignInWithPassword(...a) },
  });
  mockSignInWithOAuth.mockReset().mockResolvedValue({ data: { url: "https://provider.example.com/authorize" }, error: null });
  mockCreateOAuthAuthClient.mockReset().mockReturnValue({
    auth: { signInWithOAuth: (...a: unknown[]) => mockSignInWithOAuth(...a) },
  });
  mockSanitizeNextPath.mockReset().mockImplementation((v: string | null | undefined) => v || null);
  mockBuildGitHubAuthorizeUrl.mockReset().mockReturnValue("https://github.com/login/oauth/authorize?state=abc");
  mockIsGitHubOAuthConfigured.mockReset().mockReturnValue(false);
  mockGetTurnstileToken.mockReset().mockReturnValue("token");
  mockVerifyTurnstileToken.mockReset().mockResolvedValue({ success: true });
  mockCheckSigninRateLimit.mockReset().mockReturnValue({ ok: true });
  mockClearSigninFailures.mockReset();
  mockRecordSigninFailure.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("POST /api/auth/signin — OAuth", () => {
  it("starts a google OAuth flow and redirects to the provider URL", async () => {
    const { POST } = await import("./signin");
    const context = makeContext({ provider: "google" });

    const response = await POST(context);

    expect(response.headers.get("Location")).toBe("https://provider.example.com/authorize");
  });

  it("redirects to oauth_failed when signInWithOAuth errors", async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: { url: null }, error: { message: "boom" } });
    const { POST } = await import("./signin");
    const context = makeContext({ provider: "discord" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin?error=oauth_failed");
  });

  it("redirects to oauth_failed when there's no redirect URL", async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: { url: null }, error: null });
    const { POST } = await import("./signin");
    const context = makeContext({ provider: "google" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin?error=oauth_failed");
  });

  it("uses the GitHub authorize flow directly when configured", async () => {
    mockIsGitHubOAuthConfigured.mockReturnValue(true);
    const { POST } = await import("./signin");
    const context = makeContext({ provider: "github" });

    const response = await POST(context);

    expect(response.headers.get("Location")).toBe(
      "https://github.com/login/oauth/authorize?state=abc",
    );
  });

  it("redirects to oauth_failed when the GitHub authorize URL can't be built", async () => {
    mockIsGitHubOAuthConfigured.mockReturnValue(true);
    mockBuildGitHubAuthorizeUrl.mockReturnValue(null);
    const { POST } = await import("./signin");
    const context = makeContext({ provider: "github" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin?error=oauth_failed");
  });

  it("does not treat provider as OAuth when a password is also present", async () => {
    const { POST } = await import("./signin");
    const context = makeContext({ provider: "google", email: "a@example.com", password: "password1" });

    await POST(context);

    expect(mockSignInWithOAuth).not.toHaveBeenCalled();
    expect(mockSignInWithPassword).toHaveBeenCalled();
  });
});

describe("POST /api/auth/signin — email/password", () => {
  it("redirects with turnstile_failed when verification fails", async () => {
    mockVerifyTurnstileToken.mockResolvedValue({ success: false });
    const { POST } = await import("./signin");
    const context = makeContext({ email: "a@example.com", password: "password1" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin?error=turnstile_failed");
  });

  it("redirects with missing_fields when email or password is absent", async () => {
    const { POST } = await import("./signin");
    const context = makeContext({ email: "a@example.com" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin?error=missing_fields");
  });

  it("redirects with rate_limited when the rate limit is exceeded", async () => {
    mockCheckSigninRateLimit.mockReturnValue({ ok: false });
    const { POST } = await import("./signin");
    const context = makeContext({ email: "a@example.com", password: "password1" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin?error=rate_limited");
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("records a failure and redirects on invalid credentials", async () => {
    mockSignInWithPassword.mockResolvedValue({ data: { session: null }, error: { message: "invalid" } });
    const { POST } = await import("./signin");
    const context = makeContext({ email: "a@example.com", password: "wrong" });

    await POST(context);

    expect(mockRecordSigninFailure).toHaveBeenCalledWith("a@example.com");
    expect(context.redirect).toHaveBeenCalledWith("/signin?error=invalid_credentials");
  });

  it("clears failures and redirects to the session's redirectTo on success", async () => {
    const { POST } = await import("./signin");
    const context = makeContext({ email: "a@example.com", password: "password1" });

    const response = await POST(context);

    expect(mockClearSigninFailures).toHaveBeenCalledWith("a@example.com");
    expect(response.headers.get("Location")).toBe("/dashboard");
  });
});
