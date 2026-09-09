import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
const mockSetAuthCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
  setAuthCookies: (...a: unknown[]) => mockSetAuthCookies(...a),
}));

const mockCreateAuthClient = vi.fn();
const mockGetAssuranceLevels = vi.fn();
const mockGetAalClaim = vi.fn();
const mockNeedsMfaStepUp = vi.fn();
const mockSetMfaRequiredCookie = vi.fn();
vi.mock("../../../lib/mfa", () => ({
  createAuthClient: () => mockCreateAuthClient(),
  getAssuranceLevels: (...a: unknown[]) => mockGetAssuranceLevels(...a),
  getAalClaim: (...a: unknown[]) => mockGetAalClaim(...a),
  needsMfaStepUp: (...a: unknown[]) => mockNeedsMfaStepUp(...a),
  setMfaRequiredCookie: (...a: unknown[]) => mockSetMfaRequiredCookie(...a),
}));

const mockCreateMfaStepUpProof = vi.fn();
const mockSetMfaStepUpCookie = vi.fn();
vi.mock("../../../lib/mfaStepUpProof", () => ({
  createMfaStepUpProof: (...a: unknown[]) => mockCreateMfaStepUpProof(...a),
  setMfaStepUpCookie: (...a: unknown[]) => mockSetMfaStepUpCookie(...a),
}));

const mockSanitizeNextPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  sanitizeNextPath: (...a: unknown[]) => mockSanitizeNextPath(...a),
}));

const mockCheckMfaVerifyRateLimit = vi.fn();
const mockClearMfaVerifyFailures = vi.fn();
const mockRecordMfaVerifyFailure = vi.fn();
vi.mock("../../../lib/mfaVerifyLimits", () => ({
  checkMfaVerifyRateLimit: (...a: unknown[]) => mockCheckMfaVerifyRateLimit(...a),
  clearMfaVerifyFailures: (...a: unknown[]) => mockClearMfaVerifyFailures(...a),
  recordMfaVerifyFailure: (...a: unknown[]) => mockRecordMfaVerifyFailure(...a),
}));

const mockChallengeWebAuthnFactor = vi.fn();
const mockVerifyWebAuthnFactor = vi.fn();
vi.mock("../../../lib/webauthnMfaApi", () => ({
  challengeWebAuthnFactor: (...a: unknown[]) => mockChallengeWebAuthnFactor(...a),
  verifyWebAuthnFactor: (...a: unknown[]) => mockVerifyWebAuthnFactor(...a),
}));

const mockResolveWebAuthnRp = vi.fn();
vi.mock("../../../lib/webauthnRp", () => ({
  resolveWebAuthnRp: (...a: unknown[]) => mockResolveWebAuthnRp(...a),
}));

const mockGetYubiKeyPublicIdsFromUser = vi.fn();
const mockIsYubiKeyOtpConfigured = vi.fn();
const mockUserHasYubiKeyOtpEnrolled = vi.fn();
const mockVerifyYubiKeyOtpWithYubiCloud = vi.fn();
vi.mock("../../../lib/yubikeyOtp", () => ({
  getYubiKeyPublicIdsFromUser: (...a: unknown[]) => mockGetYubiKeyPublicIdsFromUser(...a),
  isYubiKeyOtpConfigured: () => mockIsYubiKeyOtpConfigured(),
  userHasYubiKeyOtpEnrolled: (...a: unknown[]) => mockUserHasYubiKeyOtpEnrolled(...a),
  verifyYubiKeyOtpWithYubiCloud: (...a: unknown[]) => mockVerifyYubiKeyOtpWithYubiCloud(...a),
}));

const mockMaybeRedirectMobileOAuth = vi.fn();
vi.mock("../../../lib/mobileAuthRedirect", () => ({
  maybeRedirectMobileOAuth: (...a: unknown[]) => mockMaybeRedirectMobileOAuth(...a),
}));

function makeClient() {
  return {
    auth: {
      setSession: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      mfa: {
        listFactors: vi.fn().mockResolvedValue({
          data: { totp: [{ id: "t1", status: "verified" }], webauthn: [{ id: "w1", status: "verified" }] },
          error: null,
        }),
        challengeAndVerify: vi.fn().mockResolvedValue({
          data: { access_token: "new-at", refresh_token: "new-rt" },
          error: null,
        }),
      },
    },
  };
}

let client: ReturnType<typeof makeClient>;

function makeContext(options: {
  json?: boolean;
  body?: Record<string, unknown> | string;
} = {}): APIContext {
  const { json = false, body = {} } = options;
  const url = new URL("https://example.com/api/auth/mfa-verify");
  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));

  let request: Request;
  if (json) {
    const payload = typeof body === "string" ? body : JSON.stringify(body);
    request = new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });
  } else {
    const formData = new FormData();
    if (typeof body === "object") {
      for (const [k, v] of Object.entries(body)) formData.set(k, String(v));
    }
    request = { formData: async () => formData, headers: new Headers() } as unknown as Request;
  }

  return { request, cookies: {}, redirect, url } as unknown as APIContext;
}

beforeEach(() => {
  client = makeClient();
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "at", refresh_token: "rt" },
    user: { id: "user-1" },
  });
  mockSetAuthCookies.mockReset();
  mockCreateAuthClient.mockReset().mockReturnValue(client);
  mockGetAssuranceLevels.mockReset().mockResolvedValue({});
  mockGetAalClaim.mockReset().mockReturnValue("aal1");
  mockNeedsMfaStepUp.mockReset().mockReturnValue(true);
  mockSetMfaRequiredCookie.mockReset();
  mockCreateMfaStepUpProof.mockReset().mockResolvedValue("stepup-token");
  mockSetMfaStepUpCookie.mockReset();
  mockSanitizeNextPath.mockReset().mockImplementation((v: string | null | undefined) => v || null);
  mockCheckMfaVerifyRateLimit.mockReset().mockReturnValue({ ok: true });
  mockClearMfaVerifyFailures.mockReset();
  mockRecordMfaVerifyFailure.mockReset();
  mockChallengeWebAuthnFactor.mockReset();
  mockVerifyWebAuthnFactor.mockReset();
  mockResolveWebAuthnRp.mockReset().mockReturnValue({ id: "example.com", name: "ThermalTrace" });
  mockGetYubiKeyPublicIdsFromUser.mockReset().mockReturnValue([]);
  mockIsYubiKeyOtpConfigured.mockReset().mockReturnValue(true);
  mockUserHasYubiKeyOtpEnrolled.mockReset().mockReturnValue(false);
  mockVerifyYubiKeyOtpWithYubiCloud.mockReset();
  mockMaybeRedirectMobileOAuth.mockReset().mockResolvedValue(null);
});

describe("POST /api/auth/mfa-verify — auth and setup", () => {
  it("returns 401 JSON when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./mfa-verify");

    const response = await POST(makeContext({ json: true, body: { code: "123456" } }));

    expect(response.status).toBe(401);
  });

  it("redirects to signin when not authenticated on a form request", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./mfa-verify");
    const context = makeContext({ body: { code: "123456" } });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin?error=generic");
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("./mfa-verify");

    const response = await POST(makeContext({ json: true, body: "not json" }));

    expect(response.status).toBe(400);
  });

  it("redirects to generic when setSession fails", async () => {
    client.auth.setSession.mockResolvedValue({ error: { message: "boom" } });
    const { POST } = await import("./mfa-verify");
    const context = makeContext({ body: { code: "123456" } });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin?error=generic");
  });
});

describe("POST /api/auth/mfa-verify — already satisfied", () => {
  it("returns an ok JSON payload with a step-up proof when no step-up is needed", async () => {
    mockNeedsMfaStepUp.mockReturnValue(false);
    mockGetAalClaim.mockReturnValue("aal2");
    const { POST } = await import("./mfa-verify");

    const json = (await (
      await POST(makeContext({ json: true, body: { code: "123456" } }))
    ).json()) as Record<string, unknown>;

    expect(json).toMatchObject({ ok: true, aal: "aal2", mfa_stepup: "stepup-token" });
  });

  it("redirects to the safe next path when no step-up is needed on a form request", async () => {
    mockNeedsMfaStepUp.mockReturnValue(false);
    const { POST } = await import("./mfa-verify");
    const context = makeContext({ body: { next: "/dashboard/alerts" } });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/alerts");
  });

  it("returns the mobile handoff response when no step-up is needed and mobile applies", async () => {
    mockNeedsMfaStepUp.mockReturnValue(false);
    const handoff = new Response(null, { status: 302, headers: { Location: "myapp://done" } });
    mockMaybeRedirectMobileOAuth.mockResolvedValue(handoff);
    const { POST } = await import("./mfa-verify");

    const response = await POST(makeContext({}));

    expect(response).toBe(handoff);
  });
});

describe("POST /api/auth/mfa-verify — webauthn (JSON)", () => {
  it("returns a challenge payload for webauthn_challenge", async () => {
    mockChallengeWebAuthnFactor.mockResolvedValue({
      challenge: { factorId: "w1", challengeId: "c1", ceremonyType: "request", publicKey: {} },
      error: null,
    });
    const { POST } = await import("./mfa-verify");

    const json = (await (
      await POST(makeContext({ json: true, body: { action: "webauthn_challenge" } }))
    ).json()) as Record<string, unknown>;

    expect(json).toMatchObject({ ok: true, factorId: "w1", challengeId: "c1" });
  });

  it("returns no_factor when there's no webauthn factor to challenge", async () => {
    client.auth.mfa.listFactors.mockResolvedValue({ data: { totp: [], webauthn: [] }, error: null });
    const { POST } = await import("./mfa-verify");

    const response = await POST(
      makeContext({ json: true, body: { action: "webauthn_challenge" } }),
    );
    const json = await response.json();

    expect(json).toEqual({ error: "no_factor" });
  });

  it("rate-limits webauthn_verify", async () => {
    mockCheckMfaVerifyRateLimit.mockReturnValue({ ok: false });
    const { POST } = await import("./mfa-verify");

    const response = await POST(
      makeContext({ json: true, body: { action: "webauthn_verify" } }),
    );

    expect(response.status).toBe(429);
  });

  it("returns invalid_code for webauthn_verify with a missing payload", async () => {
    const { POST } = await import("./mfa-verify");

    const response = await POST(
      makeContext({ json: true, body: { action: "webauthn_verify" } }),
    );
    const json = await response.json();

    expect(json).toEqual({ error: "invalid_code" });
    expect(mockRecordMfaVerifyFailure).toHaveBeenCalledWith("user-1");
  });

  it("verifies webauthn and returns tokens with a step-up proof", async () => {
    mockVerifyWebAuthnFactor.mockResolvedValue({
      result: { accessToken: "wat", refreshToken: "wrt" },
      error: null,
    });
    const { POST } = await import("./mfa-verify");

    const json = (await (
      await POST(
        makeContext({
          json: true,
          body: {
            action: "webauthn_verify",
            factorId: "w1",
            challengeId: "c1",
            ceremonyType: "request",
            credentialResponse: { id: "cred" },
          },
        }),
      )
    ).json()) as Record<string, unknown>;

    expect(mockSetAuthCookies).toHaveBeenCalledWith(expect.anything(), "wat", "wrt");
    expect(json).toMatchObject({ ok: true, access_token: "wat", aal: "aal2" });
  });
});

describe("POST /api/auth/mfa-verify — yubikey OTP", () => {
  it("rate-limits yubikey otp submission", async () => {
    mockCheckMfaVerifyRateLimit.mockReturnValue({ ok: false });
    const { POST } = await import("./mfa-verify");

    const response = await POST(makeContext({ body: { yubikey_otp: "cccc" } }));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("error=rate_limited");
  });

  it("redirects with generic error when yubikey OTP isn't configured", async () => {
    mockIsYubiKeyOtpConfigured.mockReturnValue(false);
    const { POST } = await import("./mfa-verify");
    const context = makeContext({ body: { yubikey_otp: "cccc" } });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(expect.stringContaining("error=generic"));
  });

  it("returns no_factor when the user has no yubikeys enrolled", async () => {
    const { POST } = await import("./mfa-verify");

    const response = await POST(
      makeContext({ json: true, body: { yubikey_otp: "cccc" } }),
    );
    const json = await response.json();

    expect(json).toEqual({ error: "no_factor" });
  });

  it("reports a replayed OTP distinctly from an invalid one", async () => {
    mockGetYubiKeyPublicIdsFromUser.mockReturnValue(["ccccccexisting"]);
    mockVerifyYubiKeyOtpWithYubiCloud.mockResolvedValue({ ok: false, error: "OTP already used" });
    const { POST } = await import("./mfa-verify");

    const json = (await (
      await POST(makeContext({ json: true, body: { yubikey_otp: "cccc" } }))
    ).json()) as Record<string, unknown>;

    expect(json).toEqual({ error: "replayed_otp" });
  });

  it("rejects an OTP for a yubikey not enrolled on this account", async () => {
    mockGetYubiKeyPublicIdsFromUser.mockReturnValue(["ccccccexisting"]);
    mockVerifyYubiKeyOtpWithYubiCloud.mockResolvedValue({ ok: true, publicId: "ccccccother" });
    const { POST } = await import("./mfa-verify");

    const json = (await (
      await POST(makeContext({ json: true, body: { yubikey_otp: "cccc" } }))
    ).json()) as Record<string, unknown>;

    expect(json).toEqual({ error: "yubikey_not_enrolled" });
  });

  it("verifies a matching yubikey OTP and returns tokens with a step-up proof", async () => {
    mockGetYubiKeyPublicIdsFromUser.mockReturnValue(["ccccccexisting"]);
    mockVerifyYubiKeyOtpWithYubiCloud.mockResolvedValue({ ok: true, publicId: "ccccccexisting" });
    mockGetAalClaim.mockReturnValue("aal1");
    const { POST } = await import("./mfa-verify");

    const json = (await (
      await POST(makeContext({ json: true, body: { yubikey_otp: "cccc" } }))
    ).json()) as Record<string, unknown>;

    expect(mockClearMfaVerifyFailures).toHaveBeenCalledWith("user-1");
    expect(json).toMatchObject({ ok: true, mfa_stepup: "stepup-token" });
  });

  it("returns generic error when step-up proof cannot be minted after yubikey success", async () => {
    mockGetYubiKeyPublicIdsFromUser.mockReturnValue(["ccccccexisting"]);
    mockVerifyYubiKeyOtpWithYubiCloud.mockResolvedValue({ ok: true, publicId: "ccccccexisting" });
    mockGetAalClaim.mockReturnValue("aal1");
    mockCreateMfaStepUpProof.mockResolvedValue(null);
    const { POST } = await import("./mfa-verify");

    const response = await POST(
      makeContext({ json: true, body: { yubikey_otp: "cccc" } }),
    );
    const json = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(503);
    expect(json).toEqual({ error: "generic" });
    expect(mockSetMfaStepUpCookie).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/mfa-verify — totp code", () => {
  it("rate-limits totp submission", async () => {
    mockCheckMfaVerifyRateLimit.mockReturnValue({ ok: false });
    const { POST } = await import("./mfa-verify");

    const response = await POST(
      makeContext({ json: true, body: { code: "123456" } }),
    );

    expect(response.status).toBe(429);
  });

  it("returns invalid_code for a malformed code", async () => {
    const { POST } = await import("./mfa-verify");

    const json = (await (
      await POST(makeContext({ json: true, body: { code: "abc" } }))
    ).json()) as Record<string, unknown>;

    expect(json).toEqual({ error: "invalid_code" });
  });

  it("returns no_factor when step-up isn't actually needed", async () => {
    // Supabase step-up isn't needed, but a yubikey-only user without an OTP
    // in the request still reaches the totp code path and finds no factor.
    mockNeedsMfaStepUp.mockReturnValue(false);
    mockUserHasYubiKeyOtpEnrolled.mockReturnValue(true);
    mockGetAalClaim.mockReturnValue("aal1");
    const { POST } = await import("./mfa-verify");

    const json = (await (
      await POST(makeContext({ json: true, body: { code: "123456" } }))
    ).json()) as Record<string, unknown>;

    expect(json).toEqual({ error: "no_factor" });
  });

  it("returns no_factor when there is no verified totp factor", async () => {
    client.auth.mfa.listFactors.mockResolvedValue({ data: { totp: [], webauthn: [] }, error: null });
    const { POST } = await import("./mfa-verify");

    const json = (await (
      await POST(makeContext({ json: true, body: { code: "123456" } }))
    ).json()) as Record<string, unknown>;

    expect(json).toEqual({ error: "no_factor" });
  });

  it("returns invalid_code when challengeAndVerify fails", async () => {
    client.auth.mfa.challengeAndVerify.mockResolvedValue({ data: null, error: { message: "bad" } });
    const { POST } = await import("./mfa-verify");

    const json = (await (
      await POST(makeContext({ json: true, body: { code: "123456" } }))
    ).json()) as Record<string, unknown>;

    expect(json).toEqual({ error: "invalid_code" });
    expect(mockRecordMfaVerifyFailure).toHaveBeenCalledWith("user-1");
  });

  it("verifies a valid totp code and returns tokens with aal2", async () => {
    const { POST } = await import("./mfa-verify");

    const json = (await (
      await POST(makeContext({ json: true, body: { code: "123456" } }))
    ).json()) as Record<string, unknown>;

    expect(mockSetAuthCookies).toHaveBeenCalledWith(expect.anything(), "new-at", "new-rt");
    expect(json).toMatchObject({ ok: true, access_token: "new-at", aal: "aal2" });
  });

  it("redirects to the safe next path after a successful form-based totp verify", async () => {
    const { POST } = await import("./mfa-verify");
    const context = makeContext({ body: { code: "123456", next: "/dashboard/alerts" } });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/alerts");
  });
});
