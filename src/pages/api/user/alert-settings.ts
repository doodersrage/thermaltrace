import type { APIRoute } from "astro";
import { getAuthFromRequest } from "../../../lib/auth";
import { updateUserAlertSettings } from "../../../lib/alertNotifications";
import {
  alertChannelsIncomplete,
  buildAlertSettingsFromFormData,
  findInvalidAlertWebhookUrl,
  isWeakTelegramSecret,
} from "../../../lib/alertSettingsForm";
import { getAlertSettingsForUser } from "../../../lib/notify";
import { getUserEntitlements } from "../../../lib/entitlements";
import {
  redirectUnlessEditor,
  requireHouseholdEditor,
} from "../../../lib/householdAuth";
import { recordHouseholdActivity } from "../../../lib/householdActivity";
import { getUserHouseholdId } from "../../../lib/households";
import { formRedirectPath, withQuery } from "../../../lib/siteUrl";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromRequest(request, cookies);

  if (!session || !user) {
    return redirect("/signin");
  }

  const formData = await request.formData();
  const redirectTo = formRedirectPath(formData, "/dashboard/alerts");

  const editor = await requireHouseholdEditor(user.id);
  const blocked = redirectUnlessEditor(editor, redirectTo, redirect);
  if (blocked) return blocked;
  const existing = await getAlertSettingsForUser(
    user.id,
    user.user_metadata as Record<string, unknown> | undefined,
  );
  const entitlements = await getUserEntitlements(user.id);
  const settings = buildAlertSettingsFromFormData(
    formData,
    existing,
    entitlements,
  );

  if (findInvalidAlertWebhookUrl(settings)) {
    return redirect(withQuery(redirectTo, { alert_error: "invalid_webhook_url" }));
  }

  if (isWeakTelegramSecret(settings.telegramCommandSecret)) {
    return redirect(withQuery(redirectTo, { alert_error: "weak_telegram_secret" }));
  }

  const { error } = await updateUserAlertSettings(
    session.access_token,
    session.refresh_token,
    user.id,
    settings,
  );

  if (error) {
    return redirect(withQuery(redirectTo, { alert_error: "1" }));
  }

  const householdId = await getUserHouseholdId(user.id);
  if (householdId) {
    await recordHouseholdActivity({
      householdId,
      userId: user.id,
      action: "alert_settings_saved",
      detail: settings.enabled ? "alerts on" : "alerts off",
    });
  }

  const params: Record<string, string> = { alert_saved: "1" };
  if (alertChannelsIncomplete(settings)) params.channels_incomplete = "1";
  return redirect(withQuery(redirectTo, params));
};
