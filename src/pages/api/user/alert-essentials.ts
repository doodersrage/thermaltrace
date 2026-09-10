import type { APIRoute } from "astro";
import { getAuthFromCookies } from "../../../lib/auth";
import {
  redirectUnlessEditor,
  requireHouseholdEditor,
} from "../../../lib/householdAuth";
import {
  getAlertSettingsForUser,
  markCooldown,
  notifyUser,
  saveAlertSettingsForUser,
} from "../../../lib/notify";
import { formRedirectPath } from "../../../lib/siteUrl";
import { recordHouseholdActivity } from "../../../lib/householdActivity";
import { getUserHouseholdId } from "../../../lib/households";

/**
 * Minimal first-alert path used from Devices after first ingest.
 * Turns on alerts + email + freeze threshold without the full Alerts form.
 */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { user } = await getAuthFromCookies(cookies);
  if (!user) {
    return redirect("/signin");
  }

  const formData = await request.formData();
  const redirectTo = formRedirectPath(formData, "/dashboard/devices");

  const editor = await requireHouseholdEditor(user.id);
  const blocked = redirectUnlessEditor(editor, redirectTo, redirect);
  if (blocked) return blocked;

  const existing = await getAlertSettingsForUser(
    user.id,
    user.user_metadata as Record<string, unknown>,
  );

  const freezeRaw = formData.get("freeze_threshold_f")?.toString();
  const freezeParsed = freezeRaw != null && freezeRaw !== "" ? Number(freezeRaw) : NaN;
  const freezeThresholdF = Number.isFinite(freezeParsed)
    ? freezeParsed
    : existing.freezeThresholdF;

  const emailRaw = formData.get("alert_email")?.toString().trim();
  const email = emailRaw || existing.email || user.email || null;

  const settings = {
    ...existing,
    enabled: true,
    channelEmail: true,
    email,
    freezeThresholdF,
    outageHours: existing.outageHours > 0 ? existing.outageHours : 2,
  };

  const { error } = await saveAlertSettingsForUser(user.id, settings);
  if (error) {
    return redirect(`${redirectTo}?alert_error=1`);
  }

  const householdId = await getUserHouseholdId(user.id);
  if (householdId) {
    await recordHouseholdActivity({
      householdId,
      userId: user.id,
      action: "alert_settings_saved",
      detail: "essentials from devices",
    });
  }

  const alsoTest = formData.get("also_test") === "1";
  if (alsoTest) {
    try {
      const { sent, skipped } = await notifyUser(user.id, user.email, settings, {
        title: "ThermalTrace test alert",
        body: "This is a test notification from your ThermalTrace dashboard. If you received this, your alert channels are working.",
        kind: "generic",
      });
      if (sent.length === 0) {
        const reason = skipped.length > 0 ? "incomplete" : "none";
        return redirect(
          `${redirectTo}?alert_saved=1&test_error=1&test_reason=${reason}`,
        );
      }
      await markCooldown(user.id, "last_alert_sent_at");
      const params = new URLSearchParams({
        alert_saved: "1",
        test_sent: "1",
        sent: sent.join(","),
      });
      if (skipped.length > 0) params.set("skipped", skipped.join(","));
      return redirect(`${redirectTo}?${params.toString()}`);
    } catch (err) {
      console.error("Essentials test alert failed:", err);
      return redirect(`${redirectTo}?alert_saved=1&test_error=1`);
    }
  }

  return redirect(`${redirectTo}?alert_saved=1`);
};
