import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockHasMobileOAuthCookie = vi.fn();
const mockMaybeRedirectMobileOAuth = vi.fn();
vi.mock("../../../../lib/mobileAuthRedirect", () => ({
  hasMobileOAuthCookie: (...a: unknown[]) => mockHasMobileOAuthCookie(...a),
  maybeRedirectMobileOAuth: (...a: unknown[]) => mockMaybeRedirectMobileOAuth(...a),
}));

const mockBuildMfaChallengeUrl = vi.fn();
const mockSessionNeedsMfaStepUp = vi.fn();
vi.mock("../../../../lib/mfa", () => ({
  buildMfaChallengeUrl: (...a: unknown[]) => mockBuildMfaChallengeUrl(...a),
  sessionNeedsMfaStepUp: (...a: unknown[]) => mockSessionNeedsMfaStepUp(...a),
}));

const mockHasValidMfaStepUpProof = vi.fn();
vi.mock("../../../../lib/mfaStepUpProof", () => ({
  hasValidMfaStepUpProof: (...a: unknown[]) => mockHasValidMfaStepUpProof(...a),
}));

function makeContext(): APIContext {
  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));
  return {
    cookies: {},
    request: new Request("https://example.com/api/auth/companion/complete"),
    site: new URL("https://example.com"),
    redirect,
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "at", refresh_token: "rt" },
    user: { id: "user-1" },
  });
  mockHasMobileOAuthCookie.mockReset().mockReturnValue(true);
  mockSessionNeedsMfaStepUp.mockReset().mockResolvedValue(false);
  mockHasValidMfaStepUpProof.mockReset().mockResolvedValue(true);
  mockBuildMfaChallengeUrl.mockReset().mockReturnValue("/signin/mfa?next=%2Fapi%2Fauth%2Fcompanion%2Fcomplete");
  mockMaybeRedirectMobileOAuth.mockReset().mockResolvedValue(null);
});

describe("GET /api/auth/companion/complete", () => {
  it("redirects to signin when there's no usable session", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./complete");
    const context = makeContext();

    await GET(context);

    expect(context.redirect).toHaveBeenCalledWith(
      "/signin?next=%2Fapi%2Fauth%2Fcompanion%2Fcomplete",
    );
  });

  it("redirects with a companion_session error when the mobile cookie is missing", async () => {
    mockHasMobileOAuthCookie.mockReturnValue(false);
    const { GET } = await import("./complete");
    const context = makeContext();

    await GET(context);

    expect(context.redirect).toHaveBeenCalledWith("/apps?error=companion_session");
  });

  it("redirects to the MFA challenge when step-up is needed and there's no valid proof", async () => {
    mockSessionNeedsMfaStepUp.mockResolvedValue(true);
    mockHasValidMfaStepUpProof.mockResolvedValue(false);
    const { GET } = await import("./complete");
    const context = makeContext();

    await GET(context);

    expect(mockBuildMfaChallengeUrl).toHaveBeenCalledWith("/api/auth/companion/complete");
    expect(context.redirect).toHaveBeenCalledWith(
      "/signin/mfa?next=%2Fapi%2Fauth%2Fcompanion%2Fcomplete",
    );
  });

  it("proceeds past MFA when a valid step-up proof exists", async () => {
    mockSessionNeedsMfaStepUp.mockResolvedValue(true);
    mockHasValidMfaStepUpProof.mockResolvedValue(true);
    const { GET } = await import("./complete");
    const context = makeContext();

    await GET(context);

    expect(mockMaybeRedirectMobileOAuth).toHaveBeenCalled();
  });

  it("returns the mobile handoff response when one is produced", async () => {
    const handoff = new Response(null, { status: 302, headers: { Location: "myapp://done" } });
    mockMaybeRedirectMobileOAuth.mockResolvedValue(handoff);
    const { GET } = await import("./complete");

    const response = await GET(makeContext());

    expect(response).toBe(handoff);
  });

  it("redirects to /dashboard when there's no handoff", async () => {
    const { GET } = await import("./complete");
    const context = makeContext();

    await GET(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard");
  });
});
