import type { AstroCookies } from "astro";
import { getAalClaim } from "./mfa";
import { timingSafeEqual } from "./timingSafeEqual";

/** HttpOnly cookie proving YubiKey (or other aal1) MFA step-up completed. */
export const MFA_STEPUP_COOKIE = "sb-mfa-stepup";

/** Companion header carrying the same proof token. */
export const MFA_STEPUP_HEADER = "x-sb-mfa-stepup";

const STEP_UP_TTL_MS = 12 * 60 * 60 * 1000;

type StepUpPayload = {
  userId: string;
  exp: number;
};

/**
 * Prefer dedicated MFA_STEPUP_SECRET; fall back to CRON_SECRET.
 * Uses import.meta.env (not cloudflare:workers) so middleware stays prerender-safe.
 */
function getSecret(): string | null {
  const dedicated = import.meta.env.MFA_STEPUP_SECRET?.trim();
  if (dedicated) return dedicated;
  const fallback = import.meta.env.CRON_SECRET?.trim();
  return fallback || null;
}

function base64UrlEncode(data: string): string {
  const bytes = new TextEncoder().encode(data);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(data: string): string | null {
  try {
    const padded = data.replace(/-/g, "+").replace(/_/g, "/");
    const pad =
      padded.length % 4 === 0 ? padded : padded + "=".repeat(4 - (padded.length % 4));
    const binary = atob(pad);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(sig)));
}

async function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expected = await sign(payload, secret);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(expected, signature);
}

/** HMAC-signed proof that this user completed MFA step-up. Fails closed without a signing secret. */
export async function createMfaStepUpProof(userId: string): Promise<string | null> {
  const secret = getSecret();
  if (!secret || !userId) return null;

  const payload: StepUpPayload = {
    userId,
    exp: Date.now() + STEP_UP_TTL_MS,
  };
  const payloadStr = JSON.stringify(payload);
  const signature = await sign(payloadStr, secret);
  return `${base64UrlEncode(payloadStr)}.${signature}`;
}

export async function verifyMfaStepUpProof(
  token: string | null | undefined,
  userId: string,
): Promise<boolean> {
  const secret = getSecret();
  if (!secret || !token || !userId) return false;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;

  const payloadEncoded = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  const payloadStr = base64UrlDecode(payloadEncoded);
  if (!payloadStr) return false;

  const valid = await verifySignature(payloadStr, signature, secret);
  if (!valid) return false;

  let payload: StepUpPayload;
  try {
    payload = JSON.parse(payloadStr) as StepUpPayload;
  } catch {
    return false;
  }

  if (!payload.userId || !payload.exp || payload.exp < Date.now()) return false;
  return timingSafeEqual(payload.userId, userId);
}

export function setMfaStepUpCookie(cookies: AstroCookies, token: string): void {
  cookies.set(MFA_STEPUP_COOKIE, token, {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    maxAge: Math.floor(STEP_UP_TTL_MS / 1000),
  });
}

export function clearMfaStepUpCookie(cookies: AstroCookies): void {
  cookies.delete(MFA_STEPUP_COOKIE, { path: "/" });
}

export function readMfaStepUpCookie(cookies: AstroCookies): string | null {
  return cookies.get(MFA_STEPUP_COOKIE)?.value?.trim() || null;
}

/** Cookie or companion header proof for this user. */
export async function hasValidMfaStepUpProof(
  request: Request | null | undefined,
  cookies: AstroCookies,
  userId: string,
): Promise<boolean> {
  const fromHeader = request?.headers.get(MFA_STEPUP_HEADER)?.trim() || null;
  const token = fromHeader || readMfaStepUpCookie(cookies);
  return verifyMfaStepUpProof(token, userId);
}

/** Supabase aal2 JWT claim or a valid MFA step-up proof cookie/header. */
export async function hasElevatedAuth(
  request: Request | null | undefined,
  cookies: AstroCookies,
  accessToken: string,
  userId: string,
): Promise<boolean> {
  if (getAalClaim(accessToken) === "aal2") return true;
  return hasValidMfaStepUpProof(request, cookies, userId);
}
