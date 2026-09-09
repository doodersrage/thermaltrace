import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
const mockSetAuthCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
  setAuthCookies: (...a: unknown[]) => mockSetAuthCookies(...a),
}));

const mockCreateAuthClientFromSession = vi.fn();
const mockGetAalClaim = vi.fn();
const mockSyncMfaRequiredCookieFromClient = vi.fn();
const mockUserHasAnyMfaEnrolled = vi.fn();
vi.mock("../../../lib/mfa", () => ({
  createAuthClientFromSession: (...a: unknown[]) => mockCreateAuthClientFromSession(...a),
  getAalClaim: (...a: unknown[]) => mockGetAalClaim(...a),
  syncMfaRequiredCookieFromClient: (...a: unknown[]) => mockSyncMfaRequiredCookieFromClient(...a),
  userHasAnyMfaEnrolled: (...a: unknown[]) => mockUserHasAnyMfaEnrolled(...a),
}));

const mockHasElevatedAuth = vi.fn();
vi.mock("../../../lib/mfaStepUpProof", () => ({
  hasElevatedAuth: (...a: unknown[]) => mockHasElevatedAuth(...a),
}));

const mockChallengeWebAuthnFactor = vi.fn();
const mockEnrollWebAuthnFactor = vi.fn();
const mockVerifyWebAuthnFactor = vi.fn();
vi.mock("../../../lib/webauthnMfaApi", () => ({
  challengeWebAuthnFactor: (...a: unknown[]) => mockChallengeWebAuthnFactor(...a),
  enrollWebAuthnFactor: (...a: unknown[]) => mockEnrollWebAuthnFactor(...a),
  verifyWebAuthnFactor: (...a: unknown[]) => mockVerifyWebAuthnFactor(...a),
}));

const mockResolveWebAuthnRp = vi.fn();
vi.mock("../../../lib/webauthnRp", () => ({
  resolveWebAuthnRp: (...a: unknown[]) => mockResolveWebAuthnRp(...a),
}));

const mockBuildYubiKeyMetadataRemove = vi.fn();
const mockBuildYubiKeyMetadataUpdate = vi.fn();
const mockGetYubiKeyPublicIdsFromUser = vi.fn();
const mockIsYubiKeyOtpConfigured = vi.fn();
const mockVerifyYubiKeyOtpWithYubiCloud = vi.fn();
vi.mock("../../../lib/yubikeyOtp", () => ({
  buildYubiKeyMetadataRemove: (...a: unknown[]) => mockBuildYubiKeyMetadataRemove(...a),
  buildYubiKeyMetadataUpdate: (...a: unknown[]) => mockBuildYubiKeyMetadataUpdate(...a),
  getYubiKeyPublicIdsFromUser: (...a: unknown[]) => mockGetYubiKeyPublicIdsFromUser(...a),
  isYubiKeyOtpConfigured: () => mockIsYubiKeyOtpConfigured(),
  verifyYubiKeyOtpWithYubiCloud: (...a: unknown[]) => mockVerifyYubiKeyOtpWithYubiCloud(...a),
}));

function makeClient() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      updateUser: vi.fn().mockResolvedValue({ error: null }),
      mfa: {
        listFactors: vi.fn().mockResolvedValue({ data: { totp: [], webauthn: [] }, error: null }),
        enroll: vi.fn().mockResolvedValue({ data: { id: "factor-1", totp: { qr_code: "qr" } }, error: null }),
        challengeAndVerify: vi.fn().mockResolvedValue({
          data: { access_token: "new-at", refresh_token: "new-rt" },
          error: null,
        }),
        unenroll: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  };
}

function makeGetContext(): APIContext {
  return { cookies: {} } as unknown as APIContext;
}

function makePostContext(body: unknown | string): APIContext {
  const request = {
    json: async () => {
      if (typeof body === "string") throw new Error("invalid json");
      return body;
    },
  } as unknown as Request;
  return { request, cookies: {} } as unknown as APIContext;
}

let client: ReturnType<typeof makeClient>;

beforeEach(() => {
  client = makeClient();
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "at", refresh_token: "rt" },
    user: { id: "user-1" },
  });
  mockSetAuthCookies.mockReset();
  mockCreateAuthClientFromSession.mockReset().mockResolvedValue({ client, error: null });
  mockGetAalClaim.mockReset().mockReturnValue("aal2");
  mockSyncMfaRequiredCookieFromClient.mockReset().mockResolvedValue(undefined);
  mockUserHasAnyMfaEnrolled.mockReset().mockResolvedValue(false);
  mockHasElevatedAuth.mockReset().mockResolvedValue(true);
  mockChallengeWebAuthnFactor.mockReset();
  mockEnrollWebAuthnFactor.mockReset();
  mockVerifyWebAuthnFactor.mockReset();
  mockResolveWebAuthnRp.mockReset().mockReturnValue({ id: "example.com", name: "ThermalTrace" });
  mockBuildYubiKeyMetadataRemove.mockReset();
  mockBuildYubiKeyMetadataUpdate.mockReset();
  mockGetYubiKeyPublicIdsFromUser.mockReset().mockReturnValue([]);
  mockIsYubiKeyOtpConfigured.mockReset().mockReturnValue(true);
  mockVerifyYubiKeyOtpWithYubiCloud.mockReset();
});

describe("GET /api/auth/mfa-manage", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./mfa-manage");

    const response = await GET(makeGetContext());

    expect(response.status).toBe(401);
  });

  it("returns 401 when the session client couldn't be created", async () => {
    mockCreateAuthClientFromSession.mockResolvedValue({ client: null, error: "bad session" });
    const { GET } = await import("./mfa-manage");

    const response = await GET(makeGetContext());

    expect(response.status).toBe(401);
  });

  it("returns 400 when listFactors errors", async () => {
    client.auth.mfa.listFactors.mockResolvedValue({ data: null, error: { message: "boom" } });
    const { GET } = await import("./mfa-manage");

    const response = await GET(makeGetContext());

    expect(response.status).toBe(400);
  });

  it("lists totp and webauthn factors plus yubikey public ids", async () => {
    client.auth.mfa.listFactors.mockResolvedValue({
      data: {
        totp: [{ id: "t1", friendly_name: "Phone", status: "verified" }],
        webauthn: [{ id: "w1", friendly_name: null, status: "verified" }],
      },
      error: null,
    });
    mockGetYubiKeyPublicIdsFromUser.mockReturnValue(["ccccccvfbcde"]);
    const { GET } = await import("./mfa-manage");

    const json = (await (await GET(makeGetContext())).json()) as Record<string, unknown>;

    expect(json.totp).toEqual([{ id: "t1", friendly_name: "Phone", status: "verified" }]);
    expect(json.webauthn).toEqual([{ id: "w1", friendly_name: null, status: "verified" }]);
    expect(json.yubikeyPublicIds).toEqual(["ccccccvfbcde"]);
  });
});

describe("POST /api/auth/mfa-manage — basics", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "enroll" }));

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext("not json"));

    expect(response.status).toBe(400);
  });

  it("returns 400 when action is missing", async () => {
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({}));

    expect(response.status).toBe(400);
  });

  it("returns 400 for an unknown action", async () => {
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "teleport" }));

    expect(response.status).toBe(400);
  });
});

describe("POST /api/auth/mfa-manage — enroll", () => {
  it("blocks enroll when the user already has MFA and lacks elevated auth", async () => {
    mockUserHasAnyMfaEnrolled.mockResolvedValue(true);
    mockHasElevatedAuth.mockResolvedValue(false);
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "enroll" }));

    expect(response.status).toBe(401);
    expect(client.auth.mfa.enroll).not.toHaveBeenCalled();
  });

  it("enrolls a totp factor and returns the QR code", async () => {
    const { POST } = await import("./mfa-manage");

    const json = (await (await POST(makePostContext({ action: "enroll" }))).json()) as Record<
      string,
      unknown
    >;

    expect(json).toEqual({ factorId: "factor-1", qrCode: "qr" });
  });

  it("returns 400 when enroll fails", async () => {
    client.auth.mfa.enroll.mockResolvedValue({ data: null, error: { message: "enroll failed" } });
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "enroll" }));

    expect(response.status).toBe(400);
  });
});

describe("POST /api/auth/mfa-manage — verify", () => {
  it("returns 400 for a malformed code", async () => {
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "verify", factorId: "f1", code: "abc" }));

    expect(response.status).toBe(400);
  });

  it("verifies a valid code and sets refreshed auth cookies", async () => {
    const { POST } = await import("./mfa-manage");

    const response = await POST(
      makePostContext({ action: "verify", factorId: "f1", code: "123456" }),
    );

    expect(mockSetAuthCookies).toHaveBeenCalledWith(expect.anything(), "new-at", "new-rt");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("returns 400 when challengeAndVerify fails", async () => {
    client.auth.mfa.challengeAndVerify.mockResolvedValue({ data: null, error: { message: "bad code" } });
    const { POST } = await import("./mfa-manage");

    const response = await POST(
      makePostContext({ action: "verify", factorId: "f1", code: "123456" }),
    );

    expect(response.status).toBe(400);
  });
});

describe("POST /api/auth/mfa-manage — webauthn", () => {
  it("blocks webauthn_enroll when additional-factor guard fails", async () => {
    mockUserHasAnyMfaEnrolled.mockResolvedValue(true);
    mockHasElevatedAuth.mockResolvedValue(false);
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "webauthn_enroll" }));

    expect(response.status).toBe(401);
  });

  it("enrolls a webauthn factor", async () => {
    mockEnrollWebAuthnFactor.mockResolvedValue({ factorId: "w1", error: null });
    const { POST } = await import("./mfa-manage");

    const json = (await (
      await POST(makePostContext({ action: "webauthn_enroll", friendlyName: "Key" }))
    ).json()) as Record<string, unknown>;

    expect(json).toEqual({ factorId: "w1", friendlyName: "Key" });
  });

  it("returns 400 when webauthn_challenge is missing factorId", async () => {
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "webauthn_challenge" }));

    expect(response.status).toBe(400);
  });

  it("returns a challenge payload for webauthn_challenge", async () => {
    mockChallengeWebAuthnFactor.mockResolvedValue({
      challenge: { factorId: "w1", challengeId: "c1", ceremonyType: "request", publicKey: {} },
      error: null,
    });
    const { POST } = await import("./mfa-manage");

    const json = (await (
      await POST(makePostContext({ action: "webauthn_challenge", factorId: "w1" }))
    ).json()) as Record<string, unknown>;

    expect(json).toMatchObject({ ok: true, factorId: "w1", challengeId: "c1" });
  });

  it("returns 400 for webauthn_verify with a missing payload", async () => {
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "webauthn_verify" }));

    expect(response.status).toBe(400);
  });

  it("verifies webauthn and sets refreshed auth cookies", async () => {
    mockVerifyWebAuthnFactor.mockResolvedValue({
      result: { accessToken: "wat", refreshToken: "wrt" },
      error: null,
    });
    const { POST } = await import("./mfa-manage");

    const response = await POST(
      makePostContext({
        action: "webauthn_verify",
        factorId: "w1",
        challengeId: "c1",
        ceremonyType: "request",
        credentialResponse: { id: "cred" },
      }),
    );

    expect(mockSetAuthCookies).toHaveBeenCalledWith(expect.anything(), "wat", "wrt");
    expect(await response.json()).toEqual({ ok: true });
  });
});

describe("POST /api/auth/mfa-manage — yubikey", () => {
  it("returns 503 when yubikey OTP isn't configured for enroll", async () => {
    mockIsYubiKeyOtpConfigured.mockReturnValue(false);
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "yubikey_enroll", otp: "cccc" }));

    expect(response.status).toBe(503);
  });

  it("returns 400 when yubikey_enroll otp is missing", async () => {
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "yubikey_enroll" }));

    expect(response.status).toBe(400);
  });

  it("returns 400 when the yubikey otp fails verification", async () => {
    mockVerifyYubiKeyOtpWithYubiCloud.mockResolvedValue({ ok: false, error: "bad otp" });
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "yubikey_enroll", otp: "cccc" }));

    expect(response.status).toBe(400);
  });

  it("returns 400 when the yubikey is already enrolled", async () => {
    mockVerifyYubiKeyOtpWithYubiCloud.mockResolvedValue({ ok: true, publicId: "ccccccexisting" });
    mockGetYubiKeyPublicIdsFromUser.mockReturnValue(["ccccccexisting"]);
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "yubikey_enroll", otp: "cccc" }));

    expect(response.status).toBe(400);
  });

  it("returns 400 when 5 yubikeys are already enrolled", async () => {
    mockVerifyYubiKeyOtpWithYubiCloud.mockResolvedValue({ ok: true, publicId: "ccccccnewkey" });
    mockGetYubiKeyPublicIdsFromUser.mockReturnValue(["a", "b", "c", "d", "e"]);
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "yubikey_enroll", otp: "cccc" }));

    expect(response.status).toBe(400);
  });

  it("enrolls a new yubikey and refreshes cookies from the session", async () => {
    mockVerifyYubiKeyOtpWithYubiCloud.mockResolvedValue({ ok: true, publicId: "ccccccnewkey" });
    mockGetYubiKeyPublicIdsFromUser.mockReturnValue([]);
    client.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "sat", refresh_token: "srt" } },
    });
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "yubikey_enroll", otp: "cccc" }));

    expect(mockSetAuthCookies).toHaveBeenCalledWith(expect.anything(), "sat", "srt");
    expect(await response.json()).toEqual({ ok: true, publicId: "ccccccnewkey" });
  });

  it("returns 400 when yubikey_unenroll is missing publicId", async () => {
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "yubikey_unenroll" }));

    expect(response.status).toBe(400);
  });

  it("returns 400 when the yubikey to unenroll isn't found", async () => {
    mockGetYubiKeyPublicIdsFromUser.mockReturnValue([]);
    const { POST } = await import("./mfa-manage");

    const response = await POST(
      makePostContext({ action: "yubikey_unenroll", publicId: "ccccccmissing" }),
    );

    expect(response.status).toBe(400);
  });

  it("unenrolls a yubikey without OTP confirmation when already aal2", async () => {
    mockGetYubiKeyPublicIdsFromUser.mockReturnValue(["ccccccexisting"]);
    mockGetAalClaim.mockReturnValue("aal2");
    const { POST } = await import("./mfa-manage");

    const response = await POST(
      makePostContext({ action: "yubikey_unenroll", publicId: "ccccccexisting" }),
    );

    expect(mockVerifyYubiKeyOtpWithYubiCloud).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ ok: true });
  });

  it("requires OTP confirmation to unenroll when not aal2", async () => {
    mockGetYubiKeyPublicIdsFromUser.mockReturnValue(["ccccccexisting"]);
    mockGetAalClaim.mockReturnValue("aal1");
    const { POST } = await import("./mfa-manage");

    const response = await POST(
      makePostContext({ action: "yubikey_unenroll", publicId: "ccccccexisting" }),
    );

    expect(response.status).toBe(400);
  });

  it("unenrolls a yubikey after a matching OTP confirmation", async () => {
    mockGetYubiKeyPublicIdsFromUser.mockReturnValue(["ccccccexisting"]);
    mockGetAalClaim.mockReturnValue("aal1");
    mockVerifyYubiKeyOtpWithYubiCloud.mockResolvedValue({ ok: true, publicId: "ccccccexisting" });
    const { POST } = await import("./mfa-manage");

    const response = await POST(
      makePostContext({ action: "yubikey_unenroll", publicId: "ccccccexisting", otp: "cccc" }),
    );

    expect(await response.json()).toEqual({ ok: true });
  });
});

describe("POST /api/auth/mfa-manage — unenroll", () => {
  it("requires aal2 to unenroll a totp/webauthn factor", async () => {
    mockGetAalClaim.mockReturnValue("aal1");
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "unenroll", factorId: "f1" }));

    expect(response.status).toBe(401);
  });

  it("returns 400 when factorId is missing", async () => {
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "unenroll" }));

    expect(response.status).toBe(400);
  });

  it("returns 400 when unenroll fails", async () => {
    client.auth.mfa.unenroll.mockResolvedValue({ error: { message: "boom" } });
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "unenroll", factorId: "f1" }));

    expect(response.status).toBe(400);
  });

  it("unenrolls and refreshes cookies when the session rotated", async () => {
    client.auth.getSession.mockResolvedValue({
      data: { session: { access_token: "sat", refresh_token: "srt" } },
    });
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "unenroll", factorId: "f1" }));

    expect(mockSetAuthCookies).toHaveBeenCalledWith(expect.anything(), "sat", "srt");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("unenrolls without rotating cookies when the session doesn't change", async () => {
    client.auth.getSession.mockResolvedValue({ data: { session: null } });
    const { POST } = await import("./mfa-manage");

    const response = await POST(makePostContext({ action: "unenroll", factorId: "f1" }));

    expect(mockSetAuthCookies).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ ok: true });
  });
});
