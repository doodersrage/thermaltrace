import { createAdminClient } from "./supabase";
import { getAlertSettingsForUser, notifyUser } from "./notify";
import { brandedEmailParts } from "./emailLayout";
import { resolveSiteUrl } from "./schemaMarkup";
import { sendEmail, isMailDeliveryBounceError } from "./mailer";
import { computeFreezeReadiness } from "./freezeReadiness";
import { listAllHouseholdOwnerUserIds } from "./households";
import { listHouseholdDevices } from "./devices";
import { fetchLatestSensorValues } from "./sensorReadings";
import { getUserEntitlements } from "./entitlements";
import { getUserPreferences, personalWeatherConfigFromPreferences } from "./userPreferences";
import { isWeatherLocationConfigured } from "./personalWeatherStations";
import {
  isEmailSuppressed,
  isPlausibleEmailAddress,
  suppressEmail,
} from "./emailSuppressions";

/** Sep 1 – Nov 15 (Northern Hemisphere pre-season). */
export function shouldSendFreezeDrill(now = new Date()): boolean {
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();
  if (month === 9 || month === 10) return true;
  if (month === 11 && day <= 15) return true;
  return false;
}

export function buildFreezeDrillEmailParts(input: {
  score: number;
  checks: Array<{ ok: boolean; label: string }>;
  siteUrl: string;
}) {
  return brandedEmailParts({
    eyebrow: "Pre-season freeze drill",
    preheader: `Readiness score ${input.score}%`,
    title: "Time for your freeze-season check",
    intro: "Before the first hard freeze, confirm alerts and probes are ready.",
    paragraphs: [`Readiness: ${input.score}%`],
    bullets: input.checks.map((c) => `${c.ok ? "✓" : "○"} ${c.label}`),
    cta: { label: "Open dashboard", url: `${input.siteUrl}/dashboard` },
    secondaryCta: {
      label: "Send test alert",
      url: `${input.siteUrl}/dashboard/alerts?tab=settings#send-test-alert`,
    },
    tone: "brand",
    footerNote: "Disable pre-season drills in Dashboard → Alerts.",
  });
}

export function monthsSince(iso: string | null | undefined, now = Date.now()): number {
  if (!iso) return Infinity;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return Infinity;
  return (now - t) / (30 * 24 * 60 * 60 * 1000);
}

export async function sendFreezeDrillsForAllUsers(): Promise<{
  sent: number;
  skipped: number;
  errors: string[];
}> {
  if (!shouldSendFreezeDrill()) {
    return { sent: 0, skipped: 0, errors: [] };
  }

  const admin = createAdminClient();
  const ownerIds = await listAllHouseholdOwnerUserIds();
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  const siteUrl = resolveSiteUrl(null);

  for (const userId of ownerIds) {
    try {
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
      if (userError || !userData.user) {
        skipped += 1;
        continue;
      }
      const user = userData.user;
      const settings = await getAlertSettingsForUser(userId, user.user_metadata as Record<string, unknown>);

      if (settings.freezeDrillEnabled === false) {
        skipped += 1;
        continue;
      }

      if (monthsSince(settings.lastFreezeDrillAt) < 11) {
        skipped += 1;
        continue;
      }

      const entitlements = await getUserEntitlements(userId);
      const prefs = await getUserPreferences(user);
      const { data: member } = await admin
        .from("household_members")
        .select("household_id")
        .eq("user_id", userId)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle();

      const householdId = member?.household_id ?? null;
      const devicesResult = householdId
        ? await listHouseholdDevices(householdId)
        : { devices: [] };
      const latest = householdId ? await fetchLatestSensorValues(householdId) : [];

      const readiness = computeFreezeReadiness({
        alertSettings: settings,
        devices: devicesResult.devices,
        latest,
        weatherLocationConfigured: isWeatherLocationConfigured(
          personalWeatherConfigFromPreferences(prefs),
        ),
        canUseForecast: entitlements.canUseForecastAlerts,
        canUseNws: entitlements.canUseNwsAlerts,
        hasSentAnyAlert: Boolean(settings.lastAlertSentAt),
      });

      const parts = buildFreezeDrillEmailParts({
        score: readiness.score,
        checks: readiness.checks,
        siteUrl,
      });

      if (user.email) {
        if (
          !isPlausibleEmailAddress(user.email) ||
          (await isEmailSuppressed(user.email))
        ) {
          skipped += 1;
          continue;
        }
        try {
          await sendEmail(user.email, `Freeze readiness ${readiness.score}%: pre-season drill`, parts.text, {
            html: parts.html,
          });
        } catch (error) {
          if (isMailDeliveryBounceError(error)) {
            await suppressEmail(
              user.email,
              "bounce",
              error instanceof Error ? error.message : String(error),
            );
            skipped += 1;
            continue;
          }
          throw error;
        }
      }

      await notifyUser(
        userId,
        user.email,
        settings,
        {
          title: "Pre-season freeze drill",
          body: `Readiness ${readiness.score}%. Open the dashboard and send a test alert if you have not this season.`,
          kind: "generic",
        },
      );

      await admin
        .from("alert_settings")
        .update({ last_freeze_drill_at: new Date().toISOString() })
        .eq("user_id", userId);

      sent += 1;
    } catch (error) {
      errors.push(`${userId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return { sent, skipped, errors };
}
