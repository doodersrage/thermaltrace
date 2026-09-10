import type { APIRoute } from "astro";
import { getAuthFromRequest } from "../../../lib/auth";
import {
  getAlertSettingsForUser,
  markCooldown,
  notifyUser,
  saveAlertSettingsForUser,
} from "../../../lib/notify";
import { resolveAlertEmail } from "../../../lib/alerts";
import {
  redirectUnlessEditor,
  requireHouseholdEditor,
} from "../../../lib/householdAuth";
import { formRedirectPath, withQuery } from "../../../lib/siteUrl";

function wantsJson(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("application/json");
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromRequest(request, cookies);
  const json = wantsJson(request);

  if (!session || !user) {
    if (json) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return redirect("/signin");
  }

  let redirectTo = "/dashboard/alerts";
  const contentType = request.headers.get("content-type") ?? "";
  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    const formData = await request.formData();
    redirectTo = formRedirectPath(formData, redirectTo);
  }

  const editor = await requireHouseholdEditor(user.id);
  if (!editor.ok) {
    if (json) {
      return new Response(JSON.stringify({ error: "Editor role required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    const blocked = redirectUnlessEditor(editor, redirectTo, redirect);
    if (blocked) return blocked;
  }

  try {
    let settings = await getAlertSettingsForUser(
      user.id,
      user.user_metadata as Record<string, unknown>,
    );

    // Persist account email when channel is on but destination was left blank
    // (notifyUser already falls back; Overview used to treat blank as incomplete).
    const resolvedEmail = resolveAlertEmail(settings, user.email);
    if (
      settings.channelEmail &&
      !settings.email?.trim() &&
      resolvedEmail
    ) {
      settings = { ...settings, email: resolvedEmail };
      await saveAlertSettingsForUser(user.id, settings);
    }

    const { sent, skipped } = await notifyUser(user.id, user.email, settings, {
      title: "ThermalTrace test alert",
      body: "This is a test notification from your ThermalTrace dashboard. If you received this, your alert channels are working.",
      kind: "generic",
    });

    if (sent.length === 0) {
      const reason = skipped.length > 0 ? "incomplete" : "none";
      if (json) {
        return new Response(
          JSON.stringify({ ok: false, error: "No channels delivered", reason, skipped }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      return redirect(withQuery(redirectTo, { test_error: "1", test_reason: reason }));
    }

    await markCooldown(user.id, "last_alert_sent_at");

    if (json) {
      return new Response(JSON.stringify({ ok: true, sent, skipped }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const params: Record<string, string> = { test_sent: "1", sent: sent.join(",") };
    if (skipped.length > 0) params.skipped = skipped.join(",");
    return redirect(withQuery(redirectTo, params));
  } catch (error) {
    console.error("Test alert failed:", error);
    if (json) {
      return new Response(JSON.stringify({ error: "Test alert failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    return redirect(withQuery(redirectTo, { test_error: "1" }));
  }
};
