import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebAuthnRp } from "./webauthnRp";

const rp: WebAuthnRp = { rpId: "thermaltrace.dev", rpOrigins: ["https://thermaltrace.dev"] };

function jsonResponse(body: unknown, ok = true, status = ok ? 200 : 400) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function brokenJsonResponse(ok = false, status = 500) {
  return {
    ok,
    status,
    json: () => Promise.reject(new Error("not json")),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("enrollWebAuthnFactor", () => {
  it("posts to the Supabase factors endpoint and returns the new factor id", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: "factor-1" }));
    const { enrollWebAuthnFactor } = await import("./webauthnMfaApi");

    const result = await enrollWebAuthnFactor("token-abc", "My security key");

    expect(result).toEqual({ factorId: "factor-1", error: null });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://test.supabase.co/auth/v1/factors");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-abc");
    expect(init.headers.apikey).toBe("test-anon-key");
    expect(JSON.parse(init.body)).toEqual({
      factor_type: "webauthn",
      friendly_name: "My security key",
    });
  });

  it("surfaces the Supabase error_description on failure", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error_description: "Too many factors" }, false, 429),
    );
    const { enrollWebAuthnFactor } = await import("./webauthnMfaApi");

    expect(await enrollWebAuthnFactor("token-abc", "Key")).toEqual({
      factorId: "",
      error: "Too many factors",
    });
  });

  it("falls back to a generic message when the error body isn't JSON", async () => {
    fetchMock.mockResolvedValue(brokenJsonResponse(false, 503));
    const { enrollWebAuthnFactor } = await import("./webauthnMfaApi");

    expect(await enrollWebAuthnFactor("token-abc", "Key")).toEqual({
      factorId: "",
      error: "Supabase MFA request failed (503)",
    });
  });

  it("treats a 2xx response with no factor id as an error", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const { enrollWebAuthnFactor } = await import("./webauthnMfaApi");

    expect(await enrollWebAuthnFactor("token-abc", "Key")).toEqual({
      factorId: "",
      error: "Enrollment did not return a factor id",
    });
  });
});

describe("challengeWebAuthnFactor", () => {
  it("returns a well-formed challenge on success", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: "challenge-1",
        webauthn: { type: "request", credential_options: { publicKey: { rpId: "thermaltrace.dev" } } },
      }),
    );
    const { challengeWebAuthnFactor } = await import("./webauthnMfaApi");

    const result = await challengeWebAuthnFactor("token-abc", "factor-1", rp);

    expect(result).toEqual({
      challenge: {
        challengeId: "challenge-1",
        factorId: "factor-1",
        ceremonyType: "request",
        publicKey: { rpId: "thermaltrace.dev" },
      },
      error: null,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://test.supabase.co/auth/v1/factors/factor-1/challenge");
    expect(JSON.parse(init.body)).toEqual({
      webauthn: { rpId: rp.rpId, rpOrigins: rp.rpOrigins },
    });
  });

  it("rejects a response missing publicKey as an invalid challenge", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ id: "challenge-1", webauthn: { type: "request", credential_options: {} } }),
    );
    const { challengeWebAuthnFactor } = await import("./webauthnMfaApi");

    expect(await challengeWebAuthnFactor("token-abc", "factor-1", rp)).toEqual({
      challenge: null,
      error: "Invalid WebAuthn challenge from auth server",
    });
  });

  it("rejects an unrecognized ceremony type", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        id: "challenge-1",
        webauthn: { type: "unknown", credential_options: { publicKey: {} } },
      }),
    );
    const { challengeWebAuthnFactor } = await import("./webauthnMfaApi");

    expect(await challengeWebAuthnFactor("token-abc", "factor-1", rp)).toEqual({
      challenge: null,
      error: "Invalid WebAuthn challenge from auth server",
    });
  });

  it("surfaces the server error on a non-2xx response", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ msg: "Factor not found" }, false, 404));
    const { challengeWebAuthnFactor } = await import("./webauthnMfaApi");

    expect(await challengeWebAuthnFactor("token-abc", "factor-missing", rp)).toEqual({
      challenge: null,
      error: "Factor not found",
    });
  });
});

describe("verifyWebAuthnFactor", () => {
  it("returns the new session tokens on success", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ access_token: "access-1", refresh_token: "refresh-1" }),
    );
    const { verifyWebAuthnFactor } = await import("./webauthnMfaApi");

    const result = await verifyWebAuthnFactor(
      "token-abc",
      "factor-1",
      "challenge-1",
      "request",
      { id: "cred-1" },
      rp,
    );

    expect(result).toEqual({
      result: { accessToken: "access-1", refreshToken: "refresh-1" },
      error: null,
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      challenge_id: "challenge-1",
      webauthn: {
        type: "request",
        rpId: rp.rpId,
        rpOrigins: rp.rpOrigins,
        credential_response: { id: "cred-1" },
      },
    });
  });

  it("treats a 2xx response missing tokens as a failed verification", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));
    const { verifyWebAuthnFactor } = await import("./webauthnMfaApi");

    expect(
      await verifyWebAuthnFactor("token-abc", "factor-1", "challenge-1", "request", {}, rp),
    ).toEqual({
      result: null,
      error: "Verification succeeded but no session was returned",
    });
  });

  it("surfaces the server error when verification is rejected", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "Invalid signature" }, false, 400));
    const { verifyWebAuthnFactor } = await import("./webauthnMfaApi");

    expect(
      await verifyWebAuthnFactor("token-abc", "factor-1", "challenge-1", "request", {}, rp),
    ).toEqual({ result: null, error: "Invalid signature" });
  });
});
