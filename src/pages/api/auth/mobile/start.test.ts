import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockBuildSignInRedirectUrl = vi.fn();
vi.mock("../../../../lib/signInErrors", () => ({
  buildSignInRedirectUrl: (...a: unknown[]) => mockBuildSignInRedirectUrl(...a),
}));

const mockSignInWithOAuth = vi.fn();
const mockCreateOAuthAuthClient = vi.fn();
vi.mock("../../../../lib/oauthAuthClient", () => ({
  createOAuthAuthClient: (...a: unknown[]) => mockCreateOAuthAuthClient(...a),
}));

vi.mock("../../../../lib/siteUrl", () => ({
  buildGitHubOAuthCallbackUrl: () => "https://example.com/api/auth/github/callback",
  buildOAuthCallbackUrl: () => "https://example.com/api/auth/callback",
  GITHUB_OAUTH_STATE_COOKIE: "github_oauth_state",
  OAUTH_NEXT_COOKIE: "oauth_next",
  OAUTH_REF_COOKIE: "oauth_ref",
}));

const mockBuildGitHubAuthorizeUrl = vi.fn();
const mockIsGitHubOAuthConfigured = vi.fn();
vi.mock("../../../../lib/githubOAuth", () => ({
  buildGitHubAuthorizeUrl: (...a: unknown[]) => mockBuildGitHubAuthorizeUrl(...a),
  isGitHubOAuthConfigured: () => mockIsGitHubOAuthConfigured(),
}));

const mockSetMobileOAuthCookie = vi.fn();
vi.mock("../../../../lib/mobileAuthRedirect", () => ({
  setMobileOAuthCookie: (...a: unknown[]) => mockSetMobileOAuthCookie(...a),
}));

function makeCookies() {
  const store = new Map<string, string>();
  return {
    get: (name: string) => (store.has(name) ? { value: store.get(name)! } : undefined),
    set: vi.fn((name: string, value: string) => store.set(name, value)),
    delete: vi.fn((name: string) => store.delete(name)),
  };
}

function makeContext(search: Record<string, string> = {}): APIContext {
  const url = new URL("https://example.com/api/auth/mobile/start");
  for (const [k, v] of Object.entries(search)) url.searchParams.set(k, v);
  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));
  return {
    url,
    cookies: makeCookies(),
    redirect,
    request: new Request(url),
    site: new URL("https://example.com"),
  } as unknown as APIContext;
}

beforeEach(() => {
  mockBuildSignInRedirectUrl.mockReset().mockImplementation((code: string) => `/signin?error=${code}`);
  mockSignInWithOAuth.mockReset().mockResolvedValue({ data: { url: "https://provider.example.com/authorize" }, error: null });
  mockCreateOAuthAuthClient.mockReset().mockReturnValue({
    auth: { signInWithOAuth: (...a: unknown[]) => mockSignInWithOAuth(...a) },
  });
  mockBuildGitHubAuthorizeUrl.mockReset().mockReturnValue("https://github.com/login/oauth/authorize?state=abc");
  mockIsGitHubOAuthConfigured.mockReset().mockReturnValue(false);
  mockSetMobileOAuthCookie.mockReset();
});

describe("GET /api/auth/mobile/start", () => {
  it("redirects to oauth_failed for an unrecognized provider", async () => {
    const { GET } = await import("./start");

    const response = await GET(makeContext({ provider: "carrier_pigeon" }));

    expect(response.headers.get("Location")).toBe("/signin?error=oauth_failed");
  });

  it("starts a google OAuth flow and redirects to the provider URL", async () => {
    const { GET } = await import("./start");

    const response = await GET(makeContext({ provider: "google" }));

    expect(mockSetMobileOAuthCookie).toHaveBeenCalled();
    expect(response.headers.get("Location")).toBe("https://provider.example.com/authorize");
  });

  it("redirects to oauth_failed when signInWithOAuth errors", async () => {
    mockSignInWithOAuth.mockResolvedValue({ data: { url: null }, error: { message: "boom" } });
    const { GET } = await import("./start");

    const response = await GET(makeContext({ provider: "discord" }));

    expect(response.headers.get("Location")).toBe("/signin?error=oauth_failed");
  });

  it("uses the GitHub authorize flow directly when configured", async () => {
    mockIsGitHubOAuthConfigured.mockReturnValue(true);
    const { GET } = await import("./start");

    const response = await GET(makeContext({ provider: "github" }));

    expect(response.headers.get("Location")).toBe(
      "https://github.com/login/oauth/authorize?state=abc",
    );
  });

  it("redirects to oauth_failed when the GitHub authorize URL can't be built", async () => {
    mockIsGitHubOAuthConfigured.mockReturnValue(true);
    mockBuildGitHubAuthorizeUrl.mockReturnValue(null);
    const { GET } = await import("./start");

    const response = await GET(makeContext({ provider: "github" }));

    expect(response.headers.get("Location")).toBe("/signin?error=oauth_failed");
  });
});
