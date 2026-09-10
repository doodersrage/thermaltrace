import {
  DEFAULT_ALERT_SETTINGS,
  type AlertSettings,
} from "./alerts";
import { parseAlertRulesFromForm } from "./alertRules";
import { parseAlertPlaybooksFromForm } from "./alertPlaybooks";
import { parseSpaceChannelRouting } from "./spaceChannelRouting";
import { parseThresholdSensorScope } from "./thresholdSensorScope";
import { parseAlertTemplates } from "./alertTemplates";
import type { Entitlements } from "./entitlements";
import { isSafeHttpsUrl } from "./ssrfGuard";

/** Checkbox fields use value="true" when checked; omitted when unchecked. */
function formCheckbox(formData: FormData, key: string): boolean {
  return formData.get(key)?.toString() === "true";
}

function formString(
  formData: FormData,
  key: string,
  fallback?: string | null,
): string | null {
  if (!formData.has(key)) {
    return fallback ?? null;
  }
  const value = formData.get(key)?.toString().trim();
  return value || null;
}

function formNumber(
  formData: FormData,
  key: string,
  fallback: number,
): number {
  if (!formData.has(key)) return fallback;
  const raw = formData.get(key);
  if (raw == null || raw === "") return fallback;
  const num = Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

/** Checkbox names on the alert settings form (value="true" when checked). */
const ALERT_SETTINGS_CHECKBOXES = [
  "alerts_enabled",
  "digest_enabled",
  "monthly_report_enabled",
  "quarterly_report_enabled",
  "drip_emails_enabled",
  "battery_alerts_enabled",
  "battery_trend_alerts_enabled",
  "rssi_alerts_enabled",
  "feed_uptime_alerts_enabled",
  "portfolio_alerts_enabled",
  "freeze_drill_enabled",
  "escalation_enabled",
  "forecast_freeze_enabled",
  "runway_alert_enabled",
  "nws_freeze_alerts_enabled",
  "quiet_hours_enabled",
  "quiet_hours_bypass_freeze",
  "quiet_hours_sms_critical",
  "channel_email",
  "channel_discord",
  "channel_telegram",
  "channel_slack",
  "channel_teams",
  "channel_ntfy",
  "channel_pushover",
  "channel_whatsapp",
  "channel_sms",
  "channel_push",
  "channel_webhook",
] as const;

/** Normalize FormData from the alert settings form before save. */
export function prepareAlertSettingsFormData(source: FormData): FormData {
  const formData = new FormData();
  for (const [key, value] of source.entries()) {
    formData.append(key, value);
  }
  for (const name of ALERT_SETTINGS_CHECKBOXES) {
    if (!formData.has(name)) {
      formData.set(name, "");
    }
  }
  return formData;
}

/** Build alert settings from a dashboard form POST / Action FormData. */
export function buildAlertSettingsFromFormData(
  formData: FormData,
  existing: AlertSettings,
  entitlements: Entitlements,
): AlertSettings {
  return {
    ...DEFAULT_ALERT_SETTINGS,
    ...existing,
    enabled: formCheckbox(formData, "alerts_enabled"),
    digestEnabled: formCheckbox(formData, "digest_enabled"),
    freezeThresholdF: formNumber(
      formData,
      "freeze_threshold_f",
      existing.freezeThresholdF,
    ),
    freezeDwellMinutes: Math.max(
      0,
      Math.min(
        120,
        Math.round(
          formNumber(formData, "freeze_dwell_minutes", existing.freezeDwellMinutes),
        ),
      ),
    ),
    humidityThreshold: formNumber(
      formData,
      "humidity_threshold",
      existing.humidityThreshold,
    ),
    rateChangeF: formNumber(formData, "rate_change_f", existing.rateChangeF),
    // Unchecked "sensor not reporting" clears the threshold (0 = disabled).
    // If the checkbox field is absent (older clients / partial forms), keep existing hours.
    outageHours: formData.has("outage_alerts_enabled")
      ? formCheckbox(formData, "outage_alerts_enabled")
        ? Math.max(
            0.5,
            formNumber(formData, "outage_hours", existing.outageHours || 2),
          )
        : 0
      : formNumber(formData, "outage_hours", existing.outageHours),
    email: formString(formData, "alert_email", existing.email),
    channelEmail: formCheckbox(formData, "channel_email"),
    channelSms: formCheckbox(formData, "channel_sms") && entitlements.canUseSms,
    channelDiscord: formCheckbox(formData, "channel_discord"),
    channelTelegram: formCheckbox(formData, "channel_telegram"),
    channelSlack: formCheckbox(formData, "channel_slack"),
    channelTeams: formCheckbox(formData, "channel_teams"),
    channelNtfy: formCheckbox(formData, "channel_ntfy"),
    channelPushover: formCheckbox(formData, "channel_pushover"),
    channelWhatsapp:
      formCheckbox(formData, "channel_whatsapp") && entitlements.canUseSms,
    channelPush: formCheckbox(formData, "channel_push") && entitlements.canUsePush,
    channelWebhook:
      formCheckbox(formData, "channel_webhook") && entitlements.canUseOutboundWebhook,
    discordWebhookUrl: formString(formData, "discord_webhook_url", existing.discordWebhookUrl),
    teamsWebhookUrl: formString(formData, "teams_webhook_url", existing.teamsWebhookUrl),
    ntfyTopic: formString(formData, "ntfy_topic", existing.ntfyTopic),
    ntfyServer: formString(formData, "ntfy_server", existing.ntfyServer) || existing.ntfyServer,
    pushoverUserKey: formString(formData, "pushover_user_key", existing.pushoverUserKey),
    pushoverAppToken:
      formString(formData, "pushover_app_token", existing.pushoverAppToken) ||
      existing.pushoverAppToken,
    whatsappPhone: formString(formData, "whatsapp_phone", existing.whatsappPhone),
    smsPhone: formString(formData, "sms_phone", existing.smsPhone),
    outboundWebhookUrl: formString(formData, "outbound_webhook_url", existing.outboundWebhookUrl),
    outboundWebhookSecret:
      formString(formData, "outbound_webhook_secret", existing.outboundWebhookSecret) ||
      existing.outboundWebhookSecret,
    telegramBotToken:
      formString(formData, "telegram_bot_token", existing.telegramBotToken) ||
      existing.telegramBotToken,
    telegramChatId: formString(formData, "telegram_chat_id", existing.telegramChatId),
    slackWebhookUrl: formString(formData, "slack_webhook_url", existing.slackWebhookUrl),
    lastAlertSentAt: existing.lastAlertSentAt,
    lastOutageAlertAt: existing.lastOutageAlertAt,
    lastRateAlertAt: existing.lastRateAlertAt,
    lastForecastAlertAt: existing.lastForecastAlertAt,
    lastRunwayAlertAt: existing.lastRunwayAlertAt,
    forecastFreezeEnabled:
      formCheckbox(formData, "forecast_freeze_enabled") &&
      entitlements.canUseForecastAlerts,
    runwayAlertEnabled: formCheckbox(formData, "runway_alert_enabled"),
    nwsFreezeAlertsEnabled:
      formCheckbox(formData, "nws_freeze_alerts_enabled") &&
      entitlements.canUseNwsAlerts,
    lastNwsAlertAt: existing.lastNwsAlertAt,
    lastFloodAlertAt: existing.lastFloodAlertAt,
    forecastHoursAhead: formNumber(
      formData,
      "forecast_hours_ahead",
      existing.forecastHoursAhead,
    ),
    quietHoursEnabled: formCheckbox(formData, "quiet_hours_enabled"),
    quietHoursStart:
      formString(formData, "quiet_hours_start", existing.quietHoursStart) ||
      existing.quietHoursStart,
    quietHoursEnd:
      formString(formData, "quiet_hours_end", existing.quietHoursEnd) ||
      existing.quietHoursEnd,
    quietHoursTimezone:
      formString(formData, "quiet_hours_timezone", existing.quietHoursTimezone) ||
      existing.quietHoursTimezone,
    quietHoursBypassFreeze: formCheckbox(formData, "quiet_hours_bypass_freeze"),
    quietHoursSmsCritical:
      formCheckbox(formData, "quiet_hours_sms_critical") && entitlements.canUseSms,
    alertRules: formData.has("alert_rules_json")
      ? parseAlertRulesFromForm(formData.get("alert_rules_json")?.toString())
      : existing.alertRules,
    monthlyReportEnabled: formCheckbox(formData, "monthly_report_enabled"),
    quarterlyReportEnabled: formCheckbox(formData, "quarterly_report_enabled"),
    dripEmailsEnabled: formCheckbox(formData, "drip_emails_enabled"),
    batteryAlertsEnabled: formCheckbox(formData, "battery_alerts_enabled"),
    batteryTrendAlertsEnabled: formCheckbox(formData, "battery_trend_alerts_enabled"),
    batteryThresholdPct: formNumber(
      formData,
      "battery_threshold_pct",
      existing.batteryThresholdPct,
    ),
    rssiAlertsEnabled: formCheckbox(formData, "rssi_alerts_enabled"),
    rssiThreshold: formNumber(
      formData,
      "rssi_threshold",
      existing.rssiThreshold,
    ),
    snoozeUntil: existing.snoozeUntil,
    vacationUntil: existing.vacationUntil,
    lastBatteryAlertAt: existing.lastBatteryAlertAt,
    lastBatteryTrendAlertAt: existing.lastBatteryTrendAlertAt,
    lastRssiAlertAt: existing.lastRssiAlertAt,
    lastMonthlyReportAt: existing.lastMonthlyReportAt,
    escalationEnabled: formCheckbox(formData, "escalation_enabled"),
    escalationMinutes: formNumber(
      formData,
      "escalation_minutes",
      existing.escalationMinutes,
    ),
    alertTemplates: (() => {
      if (!formData.has("alert_templates_json")) return existing.alertTemplates;
      try {
        const raw = formData.get("alert_templates_json")?.toString();
        const parsed = raw
          ? parseAlertTemplates(JSON.parse(raw))
          : existing.alertTemplates;
        return Object.fromEntries(
          Object.entries(parsed).filter(
            (entry): entry is [string, { title?: string; body?: string }] =>
              Boolean(entry[1]),
          ),
        );
      } catch {
        return existing.alertTemplates;
      }
    })(),
    telegramCommandSecret:
      formString(formData, "telegram_command_secret", existing.telegramCommandSecret) ||
      existing.telegramCommandSecret,
    lastEscalationAt: existing.lastEscalationAt,
    channelSeverity: (() => {
      if (!formData.has("channel_severity_json")) return existing.channelSeverity;
      try {
        const raw = formData.get("channel_severity_json")?.toString();
        if (!raw) return existing.channelSeverity;
        const parsed = JSON.parse(raw) as Record<string, string[]>;
        return parsed && typeof parsed === "object"
          ? parsed
          : existing.channelSeverity;
      } catch {
        return existing.channelSeverity;
      }
    })(),
    readingWebhookUrl: formString(formData, "reading_webhook_url", existing.readingWebhookUrl),
    readingWebhookSecret:
      formString(formData, "reading_webhook_secret", existing.readingWebhookSecret) ||
      existing.readingWebhookSecret,
    spaceChannelRouting: (() => {
      if (!formData.has("space_channel_routing_json")) {
        return existing.spaceChannelRouting;
      }
      try {
        const raw = formData.get("space_channel_routing_json")?.toString();
        return raw
          ? parseSpaceChannelRouting(JSON.parse(raw))
          : existing.spaceChannelRouting;
      } catch {
        return existing.spaceChannelRouting;
      }
    })(),
    alertPlaybooks: formData.has("alert_playbooks_json")
      ? parseAlertPlaybooksFromForm(formData.get("alert_playbooks_json")?.toString())
      : existing.alertPlaybooks,
    dataRetentionDays: (() => {
      const raw = formData.get("data_retention_days");
      if (raw == null || raw === "") return existing.dataRetentionDays;
      const n = Number(raw);
      return Number.isFinite(n) && n >= 30 ? Math.floor(n) : existing.dataRetentionDays;
    })(),
    feedUptimeAlertsEnabled: formCheckbox(formData, "feed_uptime_alerts_enabled"),
    portfolioAlertsEnabled: entitlements.canUsePortfolio
      ? formCheckbox(formData, "portfolio_alerts_enabled")
      : existing.portfolioAlertsEnabled,
    freezeDrillEnabled: formCheckbox(formData, "freeze_drill_enabled"),
    lastFeedUptimeAlertAt: existing.lastFeedUptimeAlertAt,
    lastPortfolioAlertAt: existing.lastPortfolioAlertAt,
    playbookFired: existing.playbookFired,
    thresholdSensorScope: (() => {
      if (!formData.has("threshold_sensor_scope_json")) {
        return existing.thresholdSensorScope;
      }
      try {
        const raw = formData.get("threshold_sensor_scope_json")?.toString();
        return raw ? parseThresholdSensorScope(JSON.parse(raw)) : existing.thresholdSensorScope;
      } catch {
        return existing.thresholdSensorScope;
      }
    })(),
  };
}

export function alertChannelsIncomplete(settings: AlertSettings): boolean {
  return (
    // Email falls back to the account address at send time; blank is not incomplete.
    (settings.channelDiscord && !settings.discordWebhookUrl) ||
    (settings.channelTelegram &&
      (!settings.telegramBotToken || !settings.telegramChatId)) ||
    (settings.channelSlack && !settings.slackWebhookUrl) ||
    (settings.channelTeams && !settings.teamsWebhookUrl) ||
    (settings.channelNtfy && !settings.ntfyTopic) ||
    (settings.channelPushover &&
      (!settings.pushoverUserKey || !settings.pushoverAppToken)) ||
    (settings.channelWhatsapp && !settings.whatsappPhone) ||
    (settings.channelSms && !settings.smsPhone) ||
    (settings.channelWebhook && !settings.outboundWebhookUrl)
  );
}

/**
 * These five fields are URLs the *server* fetches (outbound alert delivery,
 * per-reading webhook), not links a browser follows -- so an invalid one
 * isn't just a broken alert, it's a way to point the server's own outbound
 * requests at an arbitrary or private target. Empty is fine (channel
 * simply isn't configured); anything non-empty must be a safe https URL.
 */
export function findInvalidAlertWebhookUrl(settings: AlertSettings): string | null {
  const fields: Array<[string, string | null]> = [
    ["discordWebhookUrl", settings.discordWebhookUrl],
    ["teamsWebhookUrl", settings.teamsWebhookUrl],
    ["slackWebhookUrl", settings.slackWebhookUrl],
    ["outboundWebhookUrl", settings.outboundWebhookUrl],
    ["readingWebhookUrl", settings.readingWebhookUrl],
    ["ntfyServer", settings.ntfyServer],
  ];

  for (const [field, value] of fields) {
    if (value && !isSafeHttpsUrl(value)) {
      return field;
    }
  }

  return null;
}

/**
 * Minimum length required for the Telegram command webhook secret. That
 * endpoint (/api/telegram/webhook) authenticates with this shared secret via
 * X-Telegram-Bot-Api-Secret-Token only (query ?secret= is rejected). Commands
 * require a saved chat id binding.
 */
export const MIN_TELEGRAM_COMMAND_SECRET_LENGTH = 16;

/** True only when a *non-empty* secret is set but too short to resist guessing. */
export function isWeakTelegramSecret(secret: string | null): boolean {
  if (!secret) return false;
  const trimmed = secret.trim();
  return trimmed.length > 0 && trimmed.length < MIN_TELEGRAM_COMMAND_SECRET_LENGTH;
}

/** Rebuild FormData from an Astro Action form input object. */
export function objectToFormData(
  input: Record<string, unknown>,
): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(input)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item != null) formData.append(key, String(item));
      }
      continue;
    }
    formData.set(key, String(value));
  }
  return formData;
}
