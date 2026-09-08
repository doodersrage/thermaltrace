import { acknowledgeLatestUnackedAlert } from "./alertEvents";
import { getRuntimeEnv } from "./runtimeEnv";
import { timingSafeEqualHex } from "./timingSafeEqual";

function getAckSecret(): string | null {
  // Prefer a dedicated ack secret; fall back to CRON_SECRET. Never use the
  // service role key as an HMAC secret (too much blast radius if links leak).
  return getRuntimeEnv("ALERT_ACK_SECRET") || getRuntimeEnv("CRON_SECRET") || null;
}

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signAckPayload(userId: string, expMs: number): Promise<string> {
  const secret = getAckSecret();
  if (!secret) throw new Error("Ack signing secret not configured");
  return hmacSha256Hex(secret, `${userId}:${expMs}`);
}

export async function verifyAckPayload(
  userId: string,
  expMs: number,
  sig: string,
): Promise<boolean> {
  if (!userId || !Number.isFinite(expMs) || !sig) return false;
  if (expMs < Date.now()) return false;
  const secret = getAckSecret();
  if (!secret) return false;
  const expected = await hmacSha256Hex(secret, `${userId}:${expMs}`);
  return timingSafeEqualHex(expected, sig.toLowerCase());
}

export async function buildUserAckUrl(baseUrl: string, userId: string): Promise<string> {
  const exp = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const sig = await signAckPayload(userId, exp);
  const params = new URLSearchParams({
    uid: userId,
    exp: String(exp),
    sig,
  });
  return `${baseUrl.replace(/\/$/, "")}/api/alerts/ack?${params.toString()}`;
}

export async function applyAckToken(
  userId: string,
  expMs: number,
  sig: string,
): Promise<{ ok: boolean; message: string }> {
  const valid = await verifyAckPayload(userId, expMs, sig);
  if (!valid) {
    return { ok: false, message: "Invalid or expired acknowledgment link." };
  }

  const result = await acknowledgeLatestUnackedAlert(userId);
  if (!result.ok) {
    return { ok: false, message: result.error ?? "No unhandled alerts to acknowledge." };
  }

  return { ok: true, message: "Alert marked as handled." };
}
