import type { AlertRule } from "./alertRules";
import { parseAlertPlaybooks, type AlertPlaybookStep } from "./alertPlaybooks";
import { parseSpaceChannelRouting, type SpaceChannelRouting } from "./spaceChannelRouting";
import {
  parseThresholdSensorScope,
  type ThresholdSensorScope,
  freezeThresholdForReading,
  humidityThresholdForReading,
  readingIncludedInThresholdAlerts,
} from "./thresholdSensorScope";

export type AlertChannelName =
  | "email"
  | "sms"
  | "discord"
  | "push"
  | "webhook"
  | "telegram"
  | "slack"
  | "teams"
  | "ntfy"
  | "pushover"
  | "whatsapp";

export type NotifyKind =
  | "threshold"
  | "rate"
  | "outage"
  | "digest"
  | "generic"
  | "forecast"
  | "runway"
  | "nws"
  | "flood"
  | "rule"
  | "battery"
  | "rssi";

export type ChannelSeverityMap = Partial<Record<NotifyKind, AlertChannelName[]>>;

const ALERT_CHANNEL_NAMES = new Set<AlertChannelName>([
  "email",
  "sms",
  "discord",
  "push",
  "webhook",
  "telegram",
  "slack",
  "teams",
  "ntfy",
  "pushover",
  "whatsapp",
]);

const NOTIFY_KINDS = new Set<NotifyKind>([
  "threshold",
  "rate",
  "outage",
  "digest",
  "generic",
  "forecast",
  "runway",
  "nws",
  "flood",
  "rule",
  "battery",
  "rssi",
]);

export function parseChannelSeverity(raw: unknown): ChannelSeverityMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: ChannelSeverityMap = {};
  for (const [kind, channels] of Object.entries(raw as Record<string, unknown>)) {
    if (!NOTIFY_KINDS.has(kind as NotifyKind)) continue;
    if (!Array.isArray(channels)) continue;
    const cleaned = channels.filter(
      (ch): ch is AlertChannelName =>
        typeof ch === "string" && ALERT_CHANNEL_NAMES.has(ch as AlertChannelName),
    );
    if (cleaned.length > 0) {
      out[kind as NotifyKind] = cleaned;
    }
  }
  return out;
}

export type AlertSettings = {
  enabled: boolean;
  digestEnabled: boolean;
  freezeThresholdF: number;
  /** Minutes a probe must stay at/below freeze before alerting; 0 = immediate. */
  freezeDwellMinutes: number;
  humidityThreshold: number;
  rateChangeF: number;
  outageHours: number;
  email: string | null;
  channelEmail: boolean;
  channelSms: boolean;
  channelDiscord: boolean;
  channelPush: boolean;
  channelWebhook: boolean;
  channelTelegram: boolean;
  channelSlack: boolean;
  channelTeams: boolean;
  channelNtfy: boolean;
  channelPushover: boolean;
  channelWhatsapp: boolean;
  discordWebhookUrl: string | null;
  teamsWebhookUrl: string | null;
  ntfyTopic: string | null;
  ntfyServer: string;
  pushoverUserKey: string | null;
  pushoverAppToken: string | null;
  whatsappPhone: string | null;
  smsPhone: string | null;
  outboundWebhookUrl: string | null;
  outboundWebhookSecret: string | null;
  telegramBotToken: string | null;
  telegramChatId: string | null;
  slackWebhookUrl: string | null;
  lastAlertSentAt: string | null;
  lastOutageAlertAt: string | null;
  lastRateAlertAt: string | null;
  lastForecastAlertAt: string | null;
  lastRunwayAlertAt: string | null;
  forecastFreezeEnabled: boolean;
  runwayAlertEnabled: boolean;
  nwsFreezeAlertsEnabled: boolean;
  lastNwsAlertAt: string | null;
  lastFloodAlertAt: string | null;
  forecastHoursAhead: number;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursTimezone: string;
  quietHoursBypassFreeze: boolean;
  quietHoursSmsCritical: boolean;
  alertRules: AlertRule[];
  channelSeverity: ChannelSeverityMap;
  snoozeUntil: string | null;
  vacationUntil: string | null;
  batteryAlertsEnabled: boolean;
  batteryTrendAlertsEnabled: boolean;
  batteryThresholdPct: number;
  rssiAlertsEnabled: boolean;
  rssiThreshold: number;
  monthlyReportEnabled: boolean;
  lastBatteryAlertAt: string | null;
  lastBatteryTrendAlertAt: string | null;
  lastRssiAlertAt: string | null;
  lastMonthlyReportAt: string | null;
  escalationEnabled: boolean;
  escalationMinutes: number;
  alertTemplates: Record<string, { title?: string; body?: string }>;
  telegramCommandSecret: string | null;
  lastEscalationAt: string | null;
  readingWebhookUrl: string | null;
  readingWebhookSecret: string | null;
  spaceChannelRouting: SpaceChannelRouting;
  dripEmailsEnabled: boolean;
  quarterlyReportEnabled: boolean;
  alertPlaybooks: AlertPlaybookStep[];
  dataRetentionDays: number | null;
  feedUptimeAlertsEnabled: boolean;
  lastFeedUptimeAlertAt: string | null;
  playbookFired: Record<string, string>;
  portfolioAlertsEnabled: boolean;
  lastPortfolioAlertAt: string | null;
  freezeDrillEnabled: boolean;
  lastFreezeDrillAt: string | null;
  thresholdSensorScope: ThresholdSensorScope;
};

/** Prefer saved alert email; fall back to account email (same as notifyUser). */
export function resolveAlertEmail(
  settings: Pick<AlertSettings, "email">,
  fallbackEmail?: string | null,
): string | null {
  const fromSettings = settings.email?.trim() || "";
  if (fromSettings) return fromSettings;
  const fromFallback = fallbackEmail?.trim() || "";
  return fromFallback || null;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  enabled: false,
  digestEnabled: false,
  freezeThresholdF: 34,
  freezeDwellMinutes: 0,
  humidityThreshold: 75,
  rateChangeF: 15,
  outageHours: 2,
  email: null,
  channelEmail: true,
  channelSms: false,
  channelDiscord: false,
  channelPush: false,
  channelWebhook: false,
  channelTelegram: false,
  channelSlack: false,
  channelTeams: false,
  channelNtfy: false,
  channelPushover: false,
  channelWhatsapp: false,
  discordWebhookUrl: null,
  teamsWebhookUrl: null,
  ntfyTopic: null,
  ntfyServer: "https://ntfy.sh",
  pushoverUserKey: null,
  pushoverAppToken: null,
  whatsappPhone: null,
  smsPhone: null,
  outboundWebhookUrl: null,
  outboundWebhookSecret: null,
  telegramBotToken: null,
  telegramChatId: null,
  slackWebhookUrl: null,
  lastAlertSentAt: null,
  lastOutageAlertAt: null,
  lastRateAlertAt: null,
  lastForecastAlertAt: null,
  lastRunwayAlertAt: null,
  forecastFreezeEnabled: false,
  runwayAlertEnabled: true,
  nwsFreezeAlertsEnabled: false,
  lastNwsAlertAt: null,
  lastFloodAlertAt: null,
  forecastHoursAhead: 12,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  quietHoursTimezone: "America/New_York",
  quietHoursBypassFreeze: true,
  quietHoursSmsCritical: true,
  alertRules: [],
  channelSeverity: {},
  snoozeUntil: null,
  vacationUntil: null,
  batteryAlertsEnabled: false,
  batteryTrendAlertsEnabled: true,
  batteryThresholdPct: 20,
  rssiAlertsEnabled: false,
  rssiThreshold: -80,
  monthlyReportEnabled: false,
  lastBatteryAlertAt: null,
  lastBatteryTrendAlertAt: null,
  lastRssiAlertAt: null,
  lastMonthlyReportAt: null,
  escalationEnabled: false,
  escalationMinutes: 30,
  alertTemplates: {},
  telegramCommandSecret: null,
  lastEscalationAt: null,
  readingWebhookUrl: null,
  readingWebhookSecret: null,
  spaceChannelRouting: {},
  dripEmailsEnabled: true,
  quarterlyReportEnabled: false,
  alertPlaybooks: [],
  dataRetentionDays: null,
  feedUptimeAlertsEnabled: false,
  lastFeedUptimeAlertAt: null,
  playbookFired: {},
  portfolioAlertsEnabled: true,
  lastPortfolioAlertAt: null,
  freezeDrillEnabled: true,
  lastFreezeDrillAt: null,
  thresholdSensorScope: { includedSensorIds: [], overrides: {} },
};

/** Minimum time between threshold alert notifications for the same account. */
export const ALERT_COOLDOWN_MS = 4 * 60 * 60 * 1000;

function parseAlertRules(raw: unknown): AlertRule[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is AlertRule => {
    if (!item || typeof item !== "object") return false;
    const rule = item as Record<string, unknown>;
    return (
      typeof rule.id === "string" &&
      typeof rule.name === "string" &&
      Array.isArray(rule.all)
    );
  }) as AlertRule[];
}

export function getAlertSettingsFromMetadata(
  metadata: Record<string, unknown> | undefined,
): AlertSettings {
  if (!metadata?.alert_settings || typeof metadata.alert_settings !== "object") {
    return DEFAULT_ALERT_SETTINGS;
  }

  const raw = metadata.alert_settings as Record<string, unknown>;

  return {
    ...DEFAULT_ALERT_SETTINGS,
    enabled: raw.enabled === true,
    digestEnabled: raw.digest_enabled === true,
    freezeThresholdF:
      typeof raw.freeze_threshold_f === "number"
        ? raw.freeze_threshold_f
        : DEFAULT_ALERT_SETTINGS.freezeThresholdF,
    humidityThreshold:
      typeof raw.humidity_threshold === "number"
        ? raw.humidity_threshold
        : DEFAULT_ALERT_SETTINGS.humidityThreshold,
    rateChangeF:
      typeof raw.rate_change_f === "number"
        ? raw.rate_change_f
        : DEFAULT_ALERT_SETTINGS.rateChangeF,
    outageHours:
      typeof raw.outage_hours === "number"
        ? raw.outage_hours
        : DEFAULT_ALERT_SETTINGS.outageHours,
    email: typeof raw.email === "string" ? raw.email : null,
    lastAlertSentAt:
      typeof raw.last_alert_sent_at === "string" ? raw.last_alert_sent_at : null,
  };
}

export function rowToAlertSettings(row: Record<string, unknown> | null | undefined): AlertSettings {
  if (!row) return DEFAULT_ALERT_SETTINGS;

  return {
    enabled: row.enabled === true,
    digestEnabled: row.digest_enabled === true,
    freezeThresholdF:
      typeof row.freeze_threshold_f === "number"
        ? row.freeze_threshold_f
        : DEFAULT_ALERT_SETTINGS.freezeThresholdF,
    freezeDwellMinutes:
      typeof row.freeze_dwell_minutes === "number" && Number.isFinite(row.freeze_dwell_minutes)
        ? Math.max(0, Math.min(120, Math.round(row.freeze_dwell_minutes)))
        : DEFAULT_ALERT_SETTINGS.freezeDwellMinutes,
    humidityThreshold:
      typeof row.humidity_threshold === "number"
        ? row.humidity_threshold
        : DEFAULT_ALERT_SETTINGS.humidityThreshold,
    rateChangeF:
      typeof row.rate_change_f === "number"
        ? row.rate_change_f
        : DEFAULT_ALERT_SETTINGS.rateChangeF,
    outageHours:
      typeof row.outage_hours === "number"
        ? row.outage_hours
        : DEFAULT_ALERT_SETTINGS.outageHours,
    email: typeof row.email === "string" ? row.email : null,
    channelEmail: row.channel_email !== false,
    channelSms: row.channel_sms === true,
    channelDiscord: row.channel_discord === true,
    channelPush: row.channel_push === true,
    channelWebhook: row.channel_webhook === true,
    channelTelegram: row.channel_telegram === true,
    channelSlack: row.channel_slack === true,
    channelTeams: row.channel_teams === true,
    channelNtfy: row.channel_ntfy === true,
    channelPushover: row.channel_pushover === true,
    channelWhatsapp: row.channel_whatsapp === true,
    discordWebhookUrl:
      typeof row.discord_webhook_url === "string" ? row.discord_webhook_url : null,
    teamsWebhookUrl:
      typeof row.teams_webhook_url === "string" ? row.teams_webhook_url : null,
    ntfyTopic: typeof row.ntfy_topic === "string" ? row.ntfy_topic : null,
    ntfyServer:
      typeof row.ntfy_server === "string" && row.ntfy_server.trim()
        ? row.ntfy_server.trim()
        : DEFAULT_ALERT_SETTINGS.ntfyServer,
    pushoverUserKey:
      typeof row.pushover_user_key === "string" ? row.pushover_user_key : null,
    pushoverAppToken:
      typeof row.pushover_app_token === "string" ? row.pushover_app_token : null,
    whatsappPhone:
      typeof row.whatsapp_phone === "string" ? row.whatsapp_phone : null,
    smsPhone: typeof row.sms_phone === "string" ? row.sms_phone : null,
    outboundWebhookUrl:
      typeof row.outbound_webhook_url === "string" ? row.outbound_webhook_url : null,
    outboundWebhookSecret:
      typeof row.outbound_webhook_secret === "string"
        ? row.outbound_webhook_secret
        : null,
    telegramBotToken:
      typeof row.telegram_bot_token === "string" ? row.telegram_bot_token : null,
    telegramChatId:
      typeof row.telegram_chat_id === "string" ? row.telegram_chat_id : null,
    slackWebhookUrl:
      typeof row.slack_webhook_url === "string" ? row.slack_webhook_url : null,
    lastAlertSentAt:
      typeof row.last_alert_sent_at === "string" ? row.last_alert_sent_at : null,
    lastOutageAlertAt:
      typeof row.last_outage_alert_at === "string" ? row.last_outage_alert_at : null,
    lastRateAlertAt:
      typeof row.last_rate_alert_at === "string" ? row.last_rate_alert_at : null,
    lastForecastAlertAt:
      typeof row.last_forecast_alert_at === "string"
        ? row.last_forecast_alert_at
        : null,
    lastRunwayAlertAt:
      typeof row.last_runway_alert_at === "string"
        ? row.last_runway_alert_at
        : null,
    forecastFreezeEnabled: row.forecast_freeze_enabled === true,
    runwayAlertEnabled: row.runway_alert_enabled !== false,
    nwsFreezeAlertsEnabled: row.nws_freeze_alerts_enabled === true,
    lastNwsAlertAt:
      typeof row.last_nws_alert_at === "string" ? row.last_nws_alert_at : null,
    lastFloodAlertAt:
      typeof row.last_flood_alert_at === "string" ? row.last_flood_alert_at : null,
    forecastHoursAhead:
      typeof row.forecast_hours_ahead === "number"
        ? row.forecast_hours_ahead
        : DEFAULT_ALERT_SETTINGS.forecastHoursAhead,
    quietHoursEnabled: row.quiet_hours_enabled === true,
    quietHoursStart:
      typeof row.quiet_hours_start === "string"
        ? row.quiet_hours_start
        : DEFAULT_ALERT_SETTINGS.quietHoursStart,
    quietHoursEnd:
      typeof row.quiet_hours_end === "string"
        ? row.quiet_hours_end
        : DEFAULT_ALERT_SETTINGS.quietHoursEnd,
    quietHoursTimezone:
      typeof row.quiet_hours_timezone === "string"
        ? row.quiet_hours_timezone
        : DEFAULT_ALERT_SETTINGS.quietHoursTimezone,
    quietHoursBypassFreeze: row.quiet_hours_bypass_freeze !== false,
    quietHoursSmsCritical: row.quiet_hours_sms_critical !== false,
    alertRules: parseAlertRules(row.alert_rules),
    channelSeverity: parseChannelSeverity(row.channel_severity),
    snoozeUntil:
      typeof row.snooze_until === "string" ? row.snooze_until : null,
    vacationUntil:
      typeof row.vacation_until === "string" ? row.vacation_until : null,
    batteryAlertsEnabled: row.battery_alerts_enabled === true,
    batteryTrendAlertsEnabled: row.battery_trend_alerts_enabled !== false,
    batteryThresholdPct:
      typeof row.battery_threshold_pct === "number"
        ? row.battery_threshold_pct
        : DEFAULT_ALERT_SETTINGS.batteryThresholdPct,
    rssiAlertsEnabled: row.rssi_alerts_enabled === true,
    rssiThreshold:
      typeof row.rssi_threshold === "number"
        ? row.rssi_threshold
        : DEFAULT_ALERT_SETTINGS.rssiThreshold,
    monthlyReportEnabled: row.monthly_report_enabled === true,
    lastBatteryAlertAt:
      typeof row.last_battery_alert_at === "string"
        ? row.last_battery_alert_at
        : null,
    lastBatteryTrendAlertAt:
      typeof row.last_battery_trend_alert_at === "string"
        ? row.last_battery_trend_alert_at
        : null,
    lastRssiAlertAt:
      typeof row.last_rssi_alert_at === "string" ? row.last_rssi_alert_at : null,
    lastMonthlyReportAt:
      typeof row.last_monthly_report_at === "string"
        ? row.last_monthly_report_at
        : null,
    escalationEnabled: row.escalation_enabled === true,
    escalationMinutes:
      typeof row.escalation_minutes === "number"
        ? row.escalation_minutes
        : DEFAULT_ALERT_SETTINGS.escalationMinutes,
    alertTemplates:
      row.alert_templates && typeof row.alert_templates === "object"
        ? (row.alert_templates as Record<string, { title?: string; body?: string }>)
        : {},
    telegramCommandSecret:
      typeof row.telegram_command_secret === "string"
        ? row.telegram_command_secret
        : null,
    lastEscalationAt:
      typeof row.last_escalation_at === "string" ? row.last_escalation_at : null,
    readingWebhookUrl:
      typeof row.reading_webhook_url === "string" ? row.reading_webhook_url : null,
    readingWebhookSecret:
      typeof row.reading_webhook_secret === "string"
        ? row.reading_webhook_secret
        : null,
    spaceChannelRouting: parseSpaceChannelRouting(row.space_channel_routing),
    dripEmailsEnabled: row.drip_emails_enabled !== false,
    quarterlyReportEnabled: row.quarterly_report_enabled === true,
    alertPlaybooks: parseAlertPlaybooks(row.alert_playbooks),
    dataRetentionDays:
      typeof row.data_retention_days === "number" ? row.data_retention_days : null,
    feedUptimeAlertsEnabled: row.feed_uptime_alerts_enabled === true,
    lastFeedUptimeAlertAt:
      typeof row.last_feed_uptime_alert_at === "string"
        ? row.last_feed_uptime_alert_at
        : null,
    playbookFired:
      row.playbook_fired && typeof row.playbook_fired === "object"
        ? (row.playbook_fired as Record<string, string>)
        : {},
    portfolioAlertsEnabled: row.portfolio_alerts_enabled !== false,
    lastPortfolioAlertAt:
      typeof row.last_portfolio_alert_at === "string"
        ? row.last_portfolio_alert_at
        : null,
    freezeDrillEnabled: row.freeze_drill_enabled !== false,
    lastFreezeDrillAt:
      typeof row.last_freeze_drill_at === "string" ? row.last_freeze_drill_at : null,
    thresholdSensorScope: parseThresholdSensorScope(row.threshold_sensor_scope),
  };
}

export function isAlertCooldownActive(
  settingsOrLastSent: AlertSettings | string | null | undefined,
  now = Date.now(),
): boolean {
  const lastSentAt =
    typeof settingsOrLastSent === "string" ||
    settingsOrLastSent == null
      ? settingsOrLastSent
      : settingsOrLastSent.lastAlertSentAt;

  if (!lastSentAt) return false;
  const lastSent = Date.parse(lastSentAt);
  if (Number.isNaN(lastSent)) return false;
  return now - lastSent < ALERT_COOLDOWN_MS;
}

export type AlertReading = {
  label: string;
  tempf: number;
  humidity: number;
  sensorId?: string;
  space?: string | null;
};

/**
 * True when the probe has been continuously at/below threshold long enough.
 * dwellMinutes 0 = fire on the current reading alone.
 */
export function meetsFreezeDwell(
  currentTempF: number,
  freezeThresholdF: number,
  samplesOldestToNewest: Array<{ at: string; tempF: number }>,
  dwellMinutes: number,
  nowMs = Date.now(),
): boolean {
  if (currentTempF > freezeThresholdF) return false;
  if (!(dwellMinutes > 0)) return true;

  const cutoffMs = nowMs - dwellMinutes * 60 * 1000;
  const windowSamples = samplesOldestToNewest.filter((sample) => {
    const ts = Date.parse(sample.at);
    return Number.isFinite(ts) && ts >= cutoffMs && ts <= nowMs;
  });

  // Need evidence spanning the dwell window: at least one sample at/before cutoff.
  const hasAnchor = samplesOldestToNewest.some((sample) => {
    const ts = Date.parse(sample.at);
    return Number.isFinite(ts) && ts <= cutoffMs && sample.tempF <= freezeThresholdF;
  });
  if (!hasAnchor) return false;

  const relevant =
    windowSamples.length > 0
      ? windowSamples
      : samplesOldestToNewest.filter((sample) => {
          const ts = Date.parse(sample.at);
          return Number.isFinite(ts) && ts <= nowMs;
        });

  if (relevant.length === 0) return false;
  return relevant.every((sample) => sample.tempF <= freezeThresholdF);
}

export function evaluateAlerts(
  settings: AlertSettings,
  readings: AlertReading[],
  options?: {
    dwellSamplesBySensorId?: Record<string, Array<{ at: string; tempF: number }>>;
    nowMs?: number;
  },
): string[] {
  if (!settings.enabled) {
    return [];
  }

  const messages: string[] = [];
  const nowMs = options?.nowMs ?? Date.now();
  const dwellSamples = options?.dwellSamplesBySensorId ?? {};

  for (const reading of readings) {
    if (!readingIncludedInThresholdAlerts(settings.thresholdSensorScope, reading)) {
      continue;
    }

    const freezeThreshold = freezeThresholdForReading(settings, reading);
    const samples =
      reading.sensorId && dwellSamples[reading.sensorId]
        ? dwellSamples[reading.sensorId]!
        : [];
    if (
      meetsFreezeDwell(
        reading.tempf,
        freezeThreshold,
        samples,
        settings.freezeDwellMinutes,
        nowMs,
      )
    ) {
      const dwellNote =
        settings.freezeDwellMinutes > 0
          ? ` for ${settings.freezeDwellMinutes}+ min`
          : "";
      messages.push(
        `${reading.label} is ${reading.tempf.toFixed(1)}°F (at or below freeze threshold ${freezeThreshold}°F${dwellNote}).`,
      );
    }

    const humidityThreshold = humidityThresholdForReading(settings, reading);
    if (reading.humidity >= humidityThreshold) {
      messages.push(
        `${reading.label} humidity is ${reading.humidity.toFixed(0)}% (above threshold ${humidityThreshold}%).`,
      );
    }
  }

  return messages;
}

export type FloodAlertReading = {
  label: string;
  space?: string | null;
};

/** Wet flood / leak sensors always notify when alerts are enabled. */
export function evaluateFloodAlerts(
  settings: AlertSettings,
  wetSensors: FloodAlertReading[],
): string[] {
  if (!settings.enabled) return [];
  return wetSensors.map(
    (sensor) => `${sensor.label} flood / leak sensor is wet.`,
  );
}

export function evaluateForecastFreeze(
  settings: AlertSettings,
  forecastMinF: number | null,
  hoursAhead: number,
): string | null {
  if (!settings.enabled || !settings.forecastFreezeEnabled) return null;
  if (forecastMinF == null || !Number.isFinite(forecastMinF)) return null;
  if (forecastMinF > settings.freezeThresholdF) return null;
  return `Outdoor forecast reaches ${forecastMinF.toFixed(1)}°F within ${hoursAhead}h (freeze threshold ${settings.freezeThresholdF}°F).`;
}

export function evaluateRateChange(
  settings: AlertSettings,
  label: string,
  valuesOldestToNewest: number[],
): string | null {
  if (!settings.enabled || valuesOldestToNewest.length < 2) return null;
  const first = valuesOldestToNewest[0];
  const last = valuesOldestToNewest[valuesOldestToNewest.length - 1];
  const delta = last - first;
  if (Math.abs(delta) >= settings.rateChangeF) {
    return `${label} changed ${delta > 0 ? "+" : ""}${delta.toFixed(1)}°F in the last hour (threshold ±${settings.rateChangeF}°F).`;
  }
  return null;
}

export type DeviceHealth = {
  deviceName: string;
  batteryPct: number | null;
  rssi: number | null;
};

export function evaluateBatteryHealth(
  settings: AlertSettings,
  devices: DeviceHealth[],
): string[] {
  if (!settings.enabled || !settings.batteryAlertsEnabled) return [];
  const messages: string[] = [];
  for (const device of devices) {
    if (
      device.batteryPct != null &&
      device.batteryPct <= settings.batteryThresholdPct
    ) {
      messages.push(
        `${device.deviceName} battery is ${device.batteryPct}% (threshold ${settings.batteryThresholdPct}%).`,
      );
    }
  }
  return messages;
}

export function evaluateRssiHealth(
  settings: AlertSettings,
  devices: DeviceHealth[],
): string[] {
  if (!settings.enabled || !settings.rssiAlertsEnabled) return [];
  const messages: string[] = [];
  for (const device of devices) {
    if (device.rssi != null && device.rssi <= settings.rssiThreshold) {
      messages.push(
        `${device.deviceName} signal is ${device.rssi} dBm (threshold ${settings.rssiThreshold} dBm).`,
      );
    }
  }
  return messages;
}

export function evaluateOutage(
  settings: AlertSettings,
  deviceName: string,
  lastSeenAt: string | null,
  now = Date.now(),
): string | null {
  if (!settings.enabled) return null;
  // outageHours <= 0 disables "sensor not reporting" alerts.
  if (!(settings.outageHours > 0)) return null;
  if (!lastSeenAt) {
    return `${deviceName} has never reported a reading.`;
  }
  const last = Date.parse(lastSeenAt);
  if (Number.isNaN(last)) return null;
  const hours = (now - last) / (60 * 60 * 1000);
  if (hours >= settings.outageHours) {
    return `${deviceName} has been silent for ${hours.toFixed(1)} hours (outage threshold ${settings.outageHours}h).`;
  }
  return null;
}

export function serializeAlertSettings(settings: AlertSettings): Record<string, unknown> {
  return {
    enabled: settings.enabled,
    digest_enabled: settings.digestEnabled,
    freeze_threshold_f: settings.freezeThresholdF,
    freeze_dwell_minutes: settings.freezeDwellMinutes,
    humidity_threshold: settings.humidityThreshold,
    rate_change_f: settings.rateChangeF,
    outage_hours: settings.outageHours,
    email: settings.email,
    channel_email: settings.channelEmail,
    channel_sms: settings.channelSms,
    channel_discord: settings.channelDiscord,
    channel_push: settings.channelPush,
    channel_webhook: settings.channelWebhook,
    channel_telegram: settings.channelTelegram,
    channel_slack: settings.channelSlack,
    channel_teams: settings.channelTeams,
    channel_ntfy: settings.channelNtfy,
    channel_pushover: settings.channelPushover,
    channel_whatsapp: settings.channelWhatsapp,
    discord_webhook_url: settings.discordWebhookUrl,
    teams_webhook_url: settings.teamsWebhookUrl,
    ntfy_topic: settings.ntfyTopic,
    ntfy_server: settings.ntfyServer,
    pushover_user_key: settings.pushoverUserKey,
    pushover_app_token: settings.pushoverAppToken,
    whatsapp_phone: settings.whatsappPhone,
    sms_phone: settings.smsPhone,
    outbound_webhook_url: settings.outboundWebhookUrl,
    outbound_webhook_secret: settings.outboundWebhookSecret,
    telegram_bot_token: settings.telegramBotToken,
    telegram_chat_id: settings.telegramChatId,
    slack_webhook_url: settings.slackWebhookUrl,
    last_alert_sent_at: settings.lastAlertSentAt,
    last_outage_alert_at: settings.lastOutageAlertAt,
    last_rate_alert_at: settings.lastRateAlertAt,
    last_forecast_alert_at: settings.lastForecastAlertAt,
    last_runway_alert_at: settings.lastRunwayAlertAt,
    forecast_freeze_enabled: settings.forecastFreezeEnabled,
    runway_alert_enabled: settings.runwayAlertEnabled,
    nws_freeze_alerts_enabled: settings.nwsFreezeAlertsEnabled,
    last_nws_alert_at: settings.lastNwsAlertAt,
    last_flood_alert_at: settings.lastFloodAlertAt,
    forecast_hours_ahead: settings.forecastHoursAhead,
    quiet_hours_enabled: settings.quietHoursEnabled,
    quiet_hours_start: settings.quietHoursStart,
    quiet_hours_end: settings.quietHoursEnd,
    quiet_hours_timezone: settings.quietHoursTimezone,
    quiet_hours_bypass_freeze: settings.quietHoursBypassFreeze,
    quiet_hours_sms_critical: settings.quietHoursSmsCritical,
    alert_rules: settings.alertRules,
    channel_severity: settings.channelSeverity,
    snooze_until: settings.snoozeUntil,
    vacation_until: settings.vacationUntil,
    battery_alerts_enabled: settings.batteryAlertsEnabled,
    battery_trend_alerts_enabled: settings.batteryTrendAlertsEnabled,
    battery_threshold_pct: settings.batteryThresholdPct,
    rssi_alerts_enabled: settings.rssiAlertsEnabled,
    rssi_threshold: settings.rssiThreshold,
    monthly_report_enabled: settings.monthlyReportEnabled,
    last_battery_alert_at: settings.lastBatteryAlertAt,
    last_battery_trend_alert_at: settings.lastBatteryTrendAlertAt,
    last_rssi_alert_at: settings.lastRssiAlertAt,
    last_monthly_report_at: settings.lastMonthlyReportAt,
    escalation_enabled: settings.escalationEnabled,
    escalation_minutes: settings.escalationMinutes,
    alert_templates: settings.alertTemplates,
    telegram_command_secret: settings.telegramCommandSecret,
    last_escalation_at: settings.lastEscalationAt,
    reading_webhook_url: settings.readingWebhookUrl,
    reading_webhook_secret: settings.readingWebhookSecret,
    space_channel_routing: settings.spaceChannelRouting,
    drip_emails_enabled: settings.dripEmailsEnabled,
    quarterly_report_enabled: settings.quarterlyReportEnabled,
    alert_playbooks: settings.alertPlaybooks,
    data_retention_days: settings.dataRetentionDays,
    feed_uptime_alerts_enabled: settings.feedUptimeAlertsEnabled,
    last_feed_uptime_alert_at: settings.lastFeedUptimeAlertAt,
    playbook_fired: settings.playbookFired,
    portfolio_alerts_enabled: settings.portfolioAlertsEnabled,
    last_portfolio_alert_at: settings.lastPortfolioAlertAt,
    freeze_drill_enabled: settings.freezeDrillEnabled,
    last_freeze_drill_at: settings.lastFreezeDrillAt,
    threshold_sensor_scope: settings.thresholdSensorScope,
  };
}

export function alertSettingsToRow(settings: AlertSettings): Record<string, unknown> {
  return {
    ...serializeAlertSettings(settings),
    updated_at: new Date().toISOString(),
  };
}
