import type { APIRoute } from "astro";
import { getAuthFromCookies } from "../../../lib/auth";
import { decryptStoredIngestKey, ingestKeyVaultConfigured } from "../../../lib/ingestKeyVault";
import {
  createAuthClientFromSession,
  userHasAnyMfaEnrolled,
} from "../../../lib/mfa";
import { hasElevatedAuth } from "../../../lib/mfaStepUpProof";
import { checkRevealIngestKeyRateLimit } from "../../../lib/revealIngestKeyLimits";
import { listHouseholdDevices } from "../../../lib/devices";
import { recordHouseholdActivity } from "../../../lib/householdActivity";
import { requireHouseholdEditor, householdEditorCtx } from "../../../lib/householdAuth";

export const POST: APIRoute = async ({ request, cookies }) => {
  const { session, user } = await getAuthFromCookies(cookies);
  if (!session || !user) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rate = checkRevealIngestKeyRateLimit(user.id);
  if (!rate.ok) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: `Too many reveal attempts. Try again in ${rate.retryAfterSec ?? 60} seconds.`,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rate.retryAfterSec ?? 60),
        },
      },
    );
  }

  if (!ingestKeyVaultConfigured()) {
    return new Response(
      JSON.stringify({ ok: false, error: "Key recovery is not configured on this server." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  const { client, error: sessionError } = await createAuthClientFromSession(
    session.access_token,
    session.refresh_token,
  );
  if (sessionError) {
    return new Response(JSON.stringify({ ok: false, error: "Session expired." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const hasMfa = await userHasAnyMfaEnrolled(client, user);
  if (
    hasMfa &&
    !(await hasElevatedAuth(request, cookies, session.access_token, user.id))
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Verify MFA again before revealing ingest keys.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const editor = await requireHouseholdEditor(user.id);
  if (!editor.ok) {
    return new Response(JSON.stringify({ ok: false, error: "View-only access." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = (await request.json()) as { device_id?: string };
  const deviceId = body.device_id?.trim();
  if (!deviceId) {
    return new Response(JSON.stringify({ ok: false, error: "device_id required." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { devices } = await listHouseholdDevices(householdEditorCtx(editor).householdId);
  const device = devices.find((row) => row.id === deviceId && row.source === "push");
  if (!device) {
    return new Response(JSON.stringify({ ok: false, error: "Device not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const meta =
    device.meta && typeof device.meta === "object" && !Array.isArray(device.meta)
      ? (device.meta as Record<string, unknown>)
      : {};
  const stored = typeof meta.ingest_key_enc === "string" ? meta.ingest_key_enc : null;
  if (!stored) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "No recoverable key for this device. Rotate to generate a new one.",
      }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const ingestKey = await decryptStoredIngestKey(stored);
  if (!ingestKey) {
    return new Response(JSON.stringify({ ok: false, error: "Could not decrypt stored key." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  await recordHouseholdActivity({
    householdId: householdEditorCtx(editor).householdId,
    userId: user.id,
    action: "ingest_key_revealed",
    detail: `${device.name} (${deviceId})`,
  });

  return new Response(
    JSON.stringify({ ok: true, ingest_key: ingestKey }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
};
