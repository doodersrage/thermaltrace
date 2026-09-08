import type { Session, SupabaseClient, User } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";
import type { Database } from "../types/supabase";
import { sanitizeNextPath } from "./siteUrl";
import { createAuthClient } from "./supabase";
import { userHasYubiKeyOtpEnrolled } from "./yubikeyOtpMetadata";

export const MFA_REQUIRED_COOKIE = "sb-mfa-required";

export type AalLevel = "aal1" | "aal2";

export type AssuranceLevels = {
  currentLevel: AalLevel | null;
  nextLevel: AalLevel | null;
};

/** Re-exported so existing "from ./mfa" imports keep working unchanged. */
export { createAuthClient };

export function decodeAccessTokenPayload(
  accessToken: string,
): Record<string, unknown> | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getAalClaim(accessToken: string): AalLevel | null {
  const payload = decodeAccessTokenPayload(accessToken);
  const aal = payload?.aal;
  if (aal === "aal1" || aal === "aal2") return aal;
  return null;
}

export async function getAssuranceLevels(
  client: SupabaseClient<Database>,
): Promise<AssuranceLevels | null> {
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error || !data) return null;
  return {
    currentLevel: (data.currentLevel as AalLevel | null) ?? null,
    nextLevel: (data.nextLevel as AalLevel | null) ?? null,
  };
}

/** True when password/OAuth succeeded but a verified TOTP factor still needs entry. */
export function needsMfaStepUp(levels: AssuranceLevels | null | undefined): boolean {
  return levels?.currentLevel === "aal1" && levels?.nextLevel === "aal2";
}

export async function sessionNeedsMfaStepUp(
  accessToken: string,
  refreshToken: string,
  user?: User | null,
): Promise<boolean> {
  if (getAalClaim(accessToken) === "aal2") return false;

  const client = createAuthClient();
  const { data, error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error || !data.session) {
    return user ? userHasYubiKeyOtpEnrolled(user) : false;
  }

  const levels = await getAssuranceLevels(client);
  if (needsMfaStepUp(levels)) return true;
  return user ? userHasYubiKeyOtpEnrolled(user) : false;
}

/** True when the account already has at least one usable MFA factor. */
export async function userHasAnyMfaEnrolled(
  client: SupabaseClient<Database>,
  user?: User | null,
): Promise<boolean> {
  if (userHasYubiKeyOtpEnrolled(user)) return true;

  const { data, error } = await client.auth.mfa.listFactors();
  if (error || !data) {
    const levels = await getAssuranceLevels(client);
    return levels?.nextLevel === "aal2" || levels?.currentLevel === "aal2";
  }

  const verifiedTotp = (data.totp ?? []).some((f) => f.status === "verified");
  const verifiedWebauthn = (data.webauthn ?? []).some(
    (f) => f.status === "verified",
  );
  return verifiedTotp || verifiedWebauthn;
}

export function setMfaRequiredCookie(
  cookies: AstroCookies,
  required: boolean | "clear",
): void {
  if (required === "clear") {
    cookies.delete(MFA_REQUIRED_COOKIE, { path: "/" });
    return;
  }

  cookies.set(MFA_REQUIRED_COOKIE, required ? "1" : "0", {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    // Remember "not required" longer so aal1 sessions without MFA stay cheap.
    maxAge: required ? 60 * 15 : 60 * 60 * 24,
  });
}

export function isMfaRequiredCookieSet(cookies: AstroCookies): boolean {
  return cookies.get(MFA_REQUIRED_COOKIE)?.value === "1";
}

export function isMfaCheckedNotRequired(cookies: AstroCookies): boolean {
  return cookies.get(MFA_REQUIRED_COOKIE)?.value === "0";
}

export function buildMfaChallengeUrl(next?: string | null): string {
  const safeNext = sanitizeNextPath(next ?? undefined);
  if (!safeNext || safeNext === "/dashboard") return "/signin/mfa";
  return `/signin/mfa?next=${encodeURIComponent(safeNext)}`;
}

export async function applySessionCookiesAfterAuth(
  cookies: AstroCookies,
  session: Session,
  nextPath?: string | null,
): Promise<{ redirectTo: string }> {
  const { setAuthCookies } = await import("./auth");
  setAuthCookies(cookies, session.access_token, session.refresh_token);

  const client = createAuthClient();
  await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  const levels = await getAssuranceLevels(client);
  const { data: userData } = await client.auth.getUser();
  const stepUp =
    needsMfaStepUp(levels) ||
    (getAalClaim(session.access_token) !== "aal2" &&
      userHasYubiKeyOtpEnrolled(userData.user));
  setMfaRequiredCookie(cookies, stepUp);

  const safeNext = sanitizeNextPath(nextPath ?? undefined) ?? "/dashboard";
  return {
    redirectTo: stepUp ? buildMfaChallengeUrl(safeNext) : safeNext,
  };
}

/** Restore cookie session onto an ephemeral auth client for MFA admin APIs. */
export async function createAuthClientFromSession(
  accessToken: string,
  refreshToken: string,
): Promise<{ client: SupabaseClient<Database>; error: string | null }> {
  const client = createAuthClient();
  const { data, error } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error || !data.session) {
    return { client, error: error?.message ?? "Session expired" };
  }
  return { client, error: null };
}

/** Refresh MFA-required cookie from the live assurance level (not just JWT claim). */
export async function syncMfaRequiredCookieFromClient(
  cookies: AstroCookies,
  client: SupabaseClient<Database>,
  accessToken?: string,
): Promise<void> {
  if (accessToken && getAalClaim(accessToken) === "aal2") {
    setMfaRequiredCookie(cookies, false);
    return;
  }
  const levels = await getAssuranceLevels(client);
  setMfaRequiredCookie(cookies, needsMfaStepUp(levels));
}
