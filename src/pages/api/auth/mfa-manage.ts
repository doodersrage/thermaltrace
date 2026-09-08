import type { APIRoute } from "astro";
import type { AstroCookies } from "astro";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "../../../types/supabase";
import { getAuthFromCookies, setAuthCookies } from "../../../lib/auth";
import {
  createAuthClientFromSession,
  getAalClaim,
  syncMfaRequiredCookieFromClient,
  userHasAnyMfaEnrolled,
} from "../../../lib/mfa";
import { hasElevatedAuth } from "../../../lib/mfaStepUpProof";
import {
  challengeWebAuthnFactor,
  enrollWebAuthnFactor,
  verifyWebAuthnFactor,
  type WebAuthnCredentialResponse,
} from "../../../lib/webauthnMfaApi";
import { resolveWebAuthnRp } from "../../../lib/webauthnRp";
import {
  buildYubiKeyMetadataRemove,
  buildYubiKeyMetadataUpdate,
  getYubiKeyPublicIdsFromUser,
  isYubiKeyOtpConfigured,
  verifyYubiKeyOtpWithYubiCloud,
} from "../../../lib/yubikeyOtp";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function requireSession(cookies: Parameters<typeof getAuthFromCookies>[0]) {
  const { session, user } = await getAuthFromCookies(cookies);
  if (!session || !user) return null;
  return { session, user };
}

/**
 * First-factor enroll stays available at aal1. Adding another factor after MFA
 * exists requires aal2 or a valid step-up proof (closes password-theft enroll bypass).
 */
async function requireElevatedForAdditionalEnroll(
  request: Request,
  cookies: AstroCookies,
  session: Session,
  user: User,
  client: SupabaseClient<Database>,
): Promise<Response | null> {
  const { data: userData } = await client.auth.getUser();
  const hasMfa = await userHasAnyMfaEnrolled(client, userData.user ?? user);
  if (!hasMfa) return null;

  if (await hasElevatedAuth(request, cookies, session.access_token, user.id)) {
    return null;
  }

  return json(
    { error: "Verify MFA before adding another authenticator" },
    401,
  );
}

/** List TOTP factors for the signed-in user (cookie session; no browser Supabase keys). */
export const GET: APIRoute = async ({ cookies }) => {
  const auth = await requireSession(cookies);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const { client, error } = await createAuthClientFromSession(
    auth.session.access_token,
    auth.session.refresh_token,
  );
  if (error) return json({ error }, 401);

  const { data, error: factorsError } = await client.auth.mfa.listFactors();
  if (factorsError) {
    return json({ error: factorsError.message }, 400);
  }

  const mapFactor = (factor: {
    id: string;
    friendly_name?: string | null;
    status: string;
  }) => ({
    id: factor.id,
    friendly_name: factor.friendly_name ?? null,
    status: factor.status,
  });

  const totp = (data?.totp ?? []).map(mapFactor);
  const webauthn = (data?.webauthn ?? []).map(mapFactor);
  const { data: userData } = await client.auth.getUser();
  const yubikeyPublicIds = getYubiKeyPublicIdsFromUser(userData.user ?? auth.user);

  return json({
    factors: totp,
    totp,
    webauthn,
    yubikeyPublicIds,
    yubikeyOtpConfigured: isYubiKeyOtpConfigured(),
  });
};

type ManageBody = {
  action?: string;
  factorId?: string;
  code?: string;
  friendlyName?: string;
  challengeId?: string;
  ceremonyType?: "create" | "request";
  credentialResponse?: WebAuthnCredentialResponse;
  otp?: string;
  publicId?: string;
};

/**
 * MFA enrollment management via HttpOnly cookies:
 * - enroll → QR + factor id
 * - verify → activate factor, refresh cookies to aal2 when possible
 * - unenroll → remove factor
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireSession(cookies);
  if (!auth) return json({ error: "Unauthorized" }, 401);

  let body: ManageBody;
  try {
    body = (await request.json()) as ManageBody;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = body.action?.trim();
  if (!action) return json({ error: "Missing action" }, 400);

  const { client, error } = await createAuthClientFromSession(
    auth.session.access_token,
    auth.session.refresh_token,
  );
  if (error) return json({ error }, 401);

  if (action === "enroll") {
    const blocked = await requireElevatedForAdditionalEnroll(
      request,
      cookies,
      auth.session,
      auth.user,
      client,
    );
    if (blocked) return blocked;

    const { data, error: enrollError } = await client.auth.mfa.enroll({
      factorType: "totp",
      friendlyName:
        body.friendlyName?.trim() ||
        `Authenticator ${new Date().toLocaleDateString()}`,
    });
    if (enrollError) return json({ error: enrollError.message }, 400);

    return json({
      factorId: data?.id ?? null,
      qrCode: data?.totp?.qr_code ?? null,
    });
  }

  if (action === "verify") {
    const factorId = body.factorId?.trim();
    const code = body.code?.trim() ?? "";
    if (!factorId || !/^\d{6}$/.test(code)) {
      return json({ error: "Enter a valid 6-digit code" }, 400);
    }

    const { data, error: verifyError } = await client.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (verifyError || !data?.access_token || !data.refresh_token) {
      return json({ error: verifyError?.message ?? "Verification failed" }, 400);
    }

    setAuthCookies(cookies, data.access_token, data.refresh_token);
    const refreshed = await createAuthClientFromSession(
      data.access_token,
      data.refresh_token,
    );
    if (!refreshed.error) {
      await syncMfaRequiredCookieFromClient(
        cookies,
        refreshed.client,
        data.access_token,
      );
    } else {
      await syncMfaRequiredCookieFromClient(cookies, client, data.access_token);
    }

    return json({ ok: true });
  }

  if (action === "webauthn_enroll") {
    const blocked = await requireElevatedForAdditionalEnroll(
      request,
      cookies,
      auth.session,
      auth.user,
      client,
    );
    if (blocked) return blocked;

    const friendlyName =
      body.friendlyName?.trim() ||
      `Security key ${new Date().toLocaleDateString()}`;
    const { factorId, error: enrollError } = await enrollWebAuthnFactor(
      auth.session.access_token,
      friendlyName,
    );
    if (enrollError) return json({ error: enrollError }, 400);
    return json({ factorId, friendlyName });
  }

  if (action === "webauthn_challenge") {
    const factorId = body.factorId?.trim();
    if (!factorId) return json({ error: "Missing factorId" }, 400);

    const rp = resolveWebAuthnRp(request);
    const { challenge, error: challengeError } = await challengeWebAuthnFactor(
      auth.session.access_token,
      factorId,
      rp,
    );
    if (challengeError || !challenge) {
      return json({ error: challengeError ?? "Challenge failed" }, 400);
    }

    return json({
      ok: true,
      factorId: challenge.factorId,
      challengeId: challenge.challengeId,
      ceremonyType: challenge.ceremonyType,
      publicKey: challenge.publicKey,
    });
  }

  if (action === "webauthn_verify") {
    const factorId = body.factorId?.trim();
    const challengeId = body.challengeId?.trim();
    const ceremonyType = body.ceremonyType;
    const credentialResponse = body.credentialResponse;

    if (
      !factorId ||
      !challengeId ||
      (ceremonyType !== "create" && ceremonyType !== "request") ||
      !credentialResponse ||
      typeof credentialResponse !== "object"
    ) {
      return json({ error: "Missing WebAuthn verification payload" }, 400);
    }

    const rp = resolveWebAuthnRp(request);
    const { result, error: verifyError } = await verifyWebAuthnFactor(
      auth.session.access_token,
      factorId,
      challengeId,
      ceremonyType,
      credentialResponse,
      rp,
    );
    if (verifyError || !result) {
      return json({ error: verifyError ?? "Verification failed" }, 400);
    }

    setAuthCookies(cookies, result.accessToken, result.refreshToken);
    const refreshed = await createAuthClientFromSession(
      result.accessToken,
      result.refreshToken,
    );
    if (!refreshed.error) {
      await syncMfaRequiredCookieFromClient(
        cookies,
        refreshed.client,
        result.accessToken,
      );
    }

    return json({ ok: true });
  }

  if (action === "yubikey_enroll") {
    if (!isYubiKeyOtpConfigured()) {
      return json({ error: "YubiKey OTP is not configured on this site" }, 503);
    }

    const blocked = await requireElevatedForAdditionalEnroll(
      request,
      cookies,
      auth.session,
      auth.user,
      client,
    );
    if (blocked) return blocked;

    const otp = body.otp?.trim() ?? "";
    if (!otp) return json({ error: "Tap your YubiKey in the OTP field" }, 400);

    const verified = await verifyYubiKeyOtpWithYubiCloud(otp);
    if (!verified.ok) return json({ error: verified.error }, 400);

    const { data: userData } = await client.auth.getUser();
    const existing = getYubiKeyPublicIdsFromUser(userData.user ?? auth.user);
    if (existing.includes(verified.publicId)) {
      return json({ error: "This YubiKey is already enrolled" }, 400);
    }
    if (existing.length >= 5) {
      return json({ error: "Maximum of 5 YubiKeys per account" }, 400);
    }

    const { error: updateError } = await client.auth.updateUser({
      data: buildYubiKeyMetadataUpdate(existing, verified.publicId),
    });
    if (updateError) return json({ error: updateError.message }, 400);

    const { data: sessionData } = await client.auth.getSession();
    if (sessionData.session) {
      setAuthCookies(
        cookies,
        sessionData.session.access_token,
        sessionData.session.refresh_token,
      );
    }

    return json({ ok: true, publicId: verified.publicId });
  }

  if (action === "yubikey_unenroll") {
    const publicId = body.publicId?.trim().toLowerCase() ?? "";
    const otp = body.otp?.trim() ?? "";
    if (!publicId) return json({ error: "Missing publicId" }, 400);

    const { data: userData } = await client.auth.getUser();
    const existing = getYubiKeyPublicIdsFromUser(userData.user ?? auth.user);
    if (!existing.includes(publicId)) {
      return json({ error: "YubiKey not found on this account" }, 400);
    }

    if (getAalClaim(auth.session.access_token) !== "aal2") {
      if (!isYubiKeyOtpConfigured()) {
        return json({ error: "Verify MFA again before removing YubiKeys" }, 401);
      }
      if (!otp) {
        return json({ error: "Tap the YubiKey you are removing to confirm" }, 400);
      }
      const verified = await verifyYubiKeyOtpWithYubiCloud(otp);
      if (!verified.ok || verified.publicId !== publicId) {
        return json({ error: "YubiKey confirmation failed" }, 400);
      }
    }

    const { error: updateError } = await client.auth.updateUser({
      data: buildYubiKeyMetadataRemove(existing, publicId),
    });
    if (updateError) return json({ error: updateError.message }, 400);

    return json({ ok: true });
  }

  if (action === "unenroll") {
    if (getAalClaim(auth.session.access_token) !== "aal2") {
      return json(
        { error: "Verify MFA again before removing authenticators" },
        401,
      );
    }

    const factorId = body.factorId?.trim();
    if (!factorId) return json({ error: "Missing factorId" }, 400);

    const { error: unenrollError } = await client.auth.mfa.unenroll({ factorId });
    if (unenrollError) return json({ error: unenrollError.message }, 400);

    // Refresh cookies if Supabase rotated the session; always recompute MFA gate.
    const { data: sessionData } = await client.auth.getSession();
    if (sessionData.session) {
      setAuthCookies(
        cookies,
        sessionData.session.access_token,
        sessionData.session.refresh_token,
      );
      await syncMfaRequiredCookieFromClient(
        cookies,
        client,
        sessionData.session.access_token,
      );
    } else {
      await syncMfaRequiredCookieFromClient(cookies, client);
    }

    return json({ ok: true });
  }

  return json({ error: "Unknown action" }, 400);
};
