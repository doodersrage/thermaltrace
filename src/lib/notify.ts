import { isSafeHttpsUrl } from "./ssrfGuard";
import {
  type AlertChannelName,
  type AlertSettings,
  type NotifyKind,
  DEFAULT_ALERT_SETTINGS,
  alertSettingsToRow,
  getAlertSettingsFromMetadata,
  rowToAlertSettings,
} from "./alerts";
import { recordAlertEvent, updateAlertEventChannels, type AlertEventMeta } from "./alertEvents";
import { buildUserAckUrl } from "./alertAckTokens";
import { buildSiteUrl } from "./siteUrl";
import { applyAlertTemplates } from "./alertTemplates";
import {
  quietHoursAllowsSmsCritical,
  shouldSuppressForQuietHours,
} from "./quietHours";
import { shouldSuppressForSnoozeOrVacation } from "./alertSnooze";
import { filterChannelsForSpace } from "./spaceChannelRouting";
import { deliverWebhookPost } from "./webhookDeliveries";
import { createServerClient } from "./supabase";
import { getUserEntitlements } from "./entitlements";
import { sendPushChannelToUser } from "./pushChannel";
import { getRuntimeEnv, hasRuntimeEnv } from "./runtimeEnv";

export type NotifyPayload = {
  title: string;
  body: string;
  kind?: NotifyKind;
  meta?: AlertEventMeta;
};

async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  try {
    const { sendEmail: send } = await import("./mailer");
    const { brandedEmailParts } = await import("./emailLayout");
    const { resolveSiteUrl } = await import("./schemaMarkup");
    const siteUrl = resolveSiteUrl(null);
    const parts = brandedEmailParts({
      eyebrow: "Alert",
      preheader: body.slice(0, 120),
      title: subject,
      intro: body,
      cta: { label: "Open dashboard", url: `${siteUrl}/dashboard` },
      secondaryCta: { label: "Alert settings", url: `${siteUrl}/dashboard/alerts` },
      tone: "alert",
      footerNote:
        "You’re receiving this because freeze or threshold alerts are enabled for your account.",
    });
    await send(to, subject, parts.text, { html: parts.html });
  } catch (error) {
    console.error("Failed to send alert email:", error);
  }
}

async function sendDiscord(webhookUrl: string, title: string, body: string): Promise<void> {
  if (!isSafeHttpsUrl(webhookUrl)) {
    console.error("Refusing to send Discord webhook: unsafe URL");
    return;
  }
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: `**${title}**\n${body}`,
      }),
    });
  } catch (error) {
    console.error("Failed to send Discord webhook:", error);
  }
}

async function sendSlack(webhookUrl: string, title: string, body: string): Promise<void> {
  if (!isSafeHttpsUrl(webhookUrl)) {
    console.error("Refusing to send Slack webhook: unsafe URL");
    return;
  }
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: `*${title}*\n${body}`,
      }),
    });
  } catch (error) {
    console.error("Failed to send Slack webhook:", error);
  }
}

async function sendTeams(webhookUrl: string, title: string, body: string): Promise<void> {
  if (!isSafeHttpsUrl(webhookUrl)) {
    console.error("Refusing to send Teams webhook: unsafe URL");
    return;
  }
  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "@type": "MessageCard",
        summary: title,
        themeColor: "0078D4",
        title,
        text: body,
      }),
    });
  } catch (error) {
    console.error("Failed to send Teams webhook:", error);
  }
}

async function sendNtfy(
  server: string,
  topic: string,
  title: string,
  body: string,
): Promise<void> {
  const base = server.replace(/\/$/, "");
  if (!isSafeHttpsUrl(base)) {
    console.error("Refusing to send ntfy notification: unsafe URL");
    return;
  }
  try {
    await fetch(`${base}/${encodeURIComponent(topic)}`, {
      method: "POST",
      headers: {
        Title: title.slice(0, 250),
        Priority: "high",
        Tags: "thermometer",
      },
      body: `${title}\n${body}`.slice(0, 4000),
    });
  } catch (error) {
    console.error("Failed to send ntfy notification:", error);
  }
}

async function sendPushover(
  userKey: string,
  appToken: string,
  title: string,
  body: string,
): Promise<void> {
  try {
    const params = new URLSearchParams({
      token: appToken,
      user: userKey,
      title: title.slice(0, 250),
      message: body.slice(0, 1024),
      priority: "1",
    });
    await fetch("https://api.pushover.net/1/messages.json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    });
  } catch (error) {
    console.error("Failed to send Pushover notification:", error);
  }
}

export async function sendTwilioWhatsApp(to: string, body: string): Promise<boolean> {
  const sid = getRuntimeEnv("TWILIO_ACCOUNT_SID");
  const token = getRuntimeEnv("TWILIO_AUTH_TOKEN");
  const from =
    getRuntimeEnv("TWILIO_WHATSAPP_FROM") || getRuntimeEnv("TWILIO_FROM_NUMBER");

  if (!sid || !token || !from) {
    console.warn("Twilio WhatsApp env vars not configured; skipping");
    return false;
  }

  const whatsappFrom = from.startsWith("whatsapp:") ? from : `whatsapp:${from}`;
  const whatsappTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

  try {
    const auth = btoa(`${sid}:${token}`);
    const params = new URLSearchParams({
      To: whatsappTo,
      From: whatsappFrom,
      Body: body.slice(0, 1500),
    });
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      },
    );
    if (!response.ok) {
      console.error("Twilio WhatsApp failed:", await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to send Twilio WhatsApp:", error);
    return false;
  }
}

async function sendTelegram(
  botToken: string,
  chatId: string,
  title: string,
  body: string,
): Promise<void> {
  try {
    const url = `https://api.telegram.org/bot${encodeURIComponent(botToken)}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `${title}\n${body}`.slice(0, 4000),
      }),
    });
    if (!response.ok) {
      console.error("Telegram send failed:", await response.text());
    }
  } catch (error) {
    console.error("Failed to send Telegram message:", error);
  }
}

export function isTwilioConfigured(): boolean {
  return hasRuntimeEnv(
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_FROM_NUMBER",
  );
}

export async function sendTwilioSms(to: string, body: string): Promise<boolean> {
  const sid = getRuntimeEnv("TWILIO_ACCOUNT_SID");
  const token = getRuntimeEnv("TWILIO_AUTH_TOKEN");
  const from = getRuntimeEnv("TWILIO_FROM_NUMBER");

  if (!sid || !token || !from) {
    console.warn("Twilio env vars not configured; skipping SMS");
    return false;
  }

  try {
    const auth = btoa(`${sid}:${token}`);
    const params = new URLSearchParams({
      To: to,
      From: from,
      Body: body.slice(0, 1500),
    });

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
      },
    );

    if (!response.ok) {
      console.error("Twilio SMS failed:", await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("Failed to send Twilio SMS:", error);
    return false;
  }
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

async function sendOutboundWebhook(
  userId: string,
  url: string,
  secret: string | null,
  payload: NotifyPayload,
): Promise<void> {
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    kind: payload.kind ?? "generic",
    sent_at: new Date().toISOString(),
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (secret) {
    headers["X-Signature"] = await hmacSha256Hex(secret, body);
  }

  const response = await deliverWebhookPost(
    userId,
    "outbound_alert",
    url,
    headers,
    body,
  );
  if (response && !response.ok) {
    console.error("Outbound webhook failed:", response.status);
  }
}

function channelAllowed(
  settings: AlertSettings,
  kind: NotifyKind | undefined,
  channel: AlertChannelName,
): boolean {
  if (!kind) return true;
  const override = settings.channelSeverity?.[kind];
  if (!override || override.length === 0) return true;
  return override.includes(channel);
}

export async function getAlertSettingsForUser(
  userId: string,
  metadata?: Record<string, unknown>,
): Promise<AlertSettings> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("alert_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (data) {
    return rowToAlertSettings(data as Record<string, unknown>);
  }

  const fromMeta = getAlertSettingsFromMetadata(metadata);
  await supabase.from("alert_settings").upsert({
    user_id: userId,
    ...alertSettingsToRow(fromMeta),
  });

  return fromMeta;
}

export async function saveAlertSettingsForUser(
  userId: string,
  settings: AlertSettings,
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { error } = await supabase.from("alert_settings").upsert(
    {
      user_id: userId,
      ...alertSettingsToRow(settings),
    },
    { onConflict: "user_id" },
  );

  return { error: error?.message ?? null };
}

export async function markCooldown(
  userId: string,
  field:
    | "last_alert_sent_at"
    | "last_outage_alert_at"
    | "last_rate_alert_at"
    | "last_forecast_alert_at"
    | "last_runway_alert_at"
    | "last_battery_alert_at"
    | "last_battery_trend_alert_at"
    | "last_rssi_alert_at"
    | "last_nws_alert_at"
    | "last_flood_alert_at",
): Promise<void> {
  const supabase = createServerClient();
  const now = new Date().toISOString();
  const patch = { [field]: now, updated_at: now } as {
    last_alert_sent_at?: string;
    last_outage_alert_at?: string;
    last_rate_alert_at?: string;
    last_forecast_alert_at?: string;
    last_runway_alert_at?: string;
    last_battery_alert_at?: string;
    last_battery_trend_alert_at?: string;
    last_rssi_alert_at?: string;
    last_nws_alert_at?: string;
    last_flood_alert_at?: string;
    updated_at: string;
  };

  const { data, error } = await supabase
    .from("alert_settings")
    .update(patch)
    .eq("user_id", userId)
    .select("user_id");

  if (error) {
    console.error("markCooldown update failed:", error.message);
  }
  if (data && data.length > 0) return;

  // Update matched 0 rows (missing settings row). Upsert so test alerts still unlock Overview.
  const { error: upsertError } = await supabase.from("alert_settings").upsert(
    {
      user_id: userId,
      ...alertSettingsToRow(DEFAULT_ALERT_SETTINGS),
      ...patch,
    },
    { onConflict: "user_id" },
  );
  if (upsertError) {
    console.error("markCooldown upsert failed:", upsertError.message);
  }
}

/** Cooldown timestamps that prove at least one alert left the system. */
export function alertSettingsHaveDeliveryTimestamp(settings: AlertSettings): boolean {
  return Boolean(
    settings.lastAlertSentAt ||
      settings.lastOutageAlertAt ||
      settings.lastRateAlertAt ||
      settings.lastForecastAlertAt ||
      settings.lastRunwayAlertAt ||
      settings.lastFloodAlertAt ||
      settings.lastNwsAlertAt ||
      settings.lastBatteryAlertAt ||
      settings.lastBatteryTrendAlertAt ||
      settings.lastRssiAlertAt,
  );
}

/**
 * Overview / onboarding treat a delivered test (or any real alert) as done.
 * If cooldown columns were never written (silent update miss) but alert_events
 * show a successful send, heal last_alert_sent_at and return true.
 */
export async function ensureAlertDeliveryEvidence(
  userId: string,
  settings: AlertSettings,
): Promise<{ hasDelivery: boolean; settings: AlertSettings }> {
  if (alertSettingsHaveDeliveryTimestamp(settings)) {
    return { hasDelivery: true, settings };
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("alert_events")
    .select("channels_sent")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) {
    console.error("ensureAlertDeliveryEvidence failed:", error.message);
    return { hasDelivery: false, settings };
  }

  const delivered = (data ?? []).some(
    (row) => Array.isArray(row.channels_sent) && row.channels_sent.length > 0,
  );
  if (!delivered) {
    return { hasDelivery: false, settings };
  }

  await markCooldown(userId, "last_alert_sent_at");
  const healed = await getAlertSettingsForUser(userId);
  return {
    hasDelivery: alertSettingsHaveDeliveryTimestamp(healed),
    settings: healed,
  };
}

export async function markEscalation(userId: string): Promise<void> {
  const supabase = createServerClient();
  await supabase
    .from("alert_settings")
    .update({
      last_escalation_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
}

export async function notifyUser(
  userId: string,
  fallbackEmail: string | null | undefined,
  settings: AlertSettings,
  payload: NotifyPayload,
  options?: {
    snoozeUrl?: string;
    smsOnly?: boolean;
    space?: string | null;
    /** When set, only these channels may fire (must also be enabled in settings). */
    channelFilter?: AlertChannelName[];
  },
): Promise<{ sent: string[]; skipped: string[] }> {
  if (
    !options?.smsOnly &&
    shouldSuppressForSnoozeOrVacation(settings, payload.kind)
  ) {
    const skipped = ["snooze_or_vacation"];
    await recordAlertEvent({
      userId,
      kind: payload.kind ?? "generic",
      title: payload.title,
      body: payload.body,
      channelsSent: [],
      channelsSkipped: skipped,
      meta: payload.meta,
    });
    return { sent: [], skipped };
  }

  const smsCriticalOnly =
    options?.smsOnly || quietHoursAllowsSmsCritical(settings, payload.kind);
  if (
    !options?.smsOnly &&
    shouldSuppressForQuietHours(settings, payload.kind) &&
    !smsCriticalOnly
  ) {
    const skipped = ["quiet_hours"];
    await recordAlertEvent({
      userId,
      kind: payload.kind ?? "generic",
      title: payload.title,
      body: payload.body,
      channelsSent: [],
      channelsSkipped: skipped,
      meta: payload.meta,
    });
    return { sent: [], skipped };
  }

  const entitlements = await getUserEntitlements(userId);
  const email = settings.email ?? fallbackEmail ?? null;
  let payloadResolved = applyAlertTemplates(payload, settings.alertTemplates);
  const sent: string[] = [];
  const skipped: string[] = [];

  const eventId = await recordAlertEvent({
    userId,
    kind: payload.kind ?? "generic",
    title: payload.title,
    body: payload.body,
    channelsSent: [],
    channelsSkipped: [],
    meta: payload.meta,
  });

  const kind = payloadResolved.kind;
  const routedChannels = kind
    ? filterChannelsForSpace(
        settings,
        options?.space,
        kind,
        ["email", "sms", "discord", "push", "webhook", "telegram", "slack", "teams", "ntfy", "pushover", "whatsapp"],
      )
    : null;
  const routedSet = routedChannels ? new Set(routedChannels) : null;
  const baseUrl = buildSiteUrl();
  const ackUrl = await buildUserAckUrl(baseUrl, userId);
  const footerLines: string[] = [];
  if (options?.snoozeUrl) footerLines.push(`Snooze 24h: ${options.snoozeUrl}`);
  if (ackUrl) footerLines.push(`Mark as handled: ${ackUrl}`);
  const bodyWithSnooze =
    footerLines.length > 0
      ? `${payloadResolved.body}\n\n${footerLines.join("\n")}`
      : payloadResolved.body;
  const channelFilterSet = options?.channelFilter?.length
    ? new Set(options.channelFilter)
    : null;
  const allowChannel = (channel: AlertChannelName) => {
    if (channelFilterSet && !channelFilterSet.has(channel)) return false;
    if (routedSet && !routedSet.has(channel)) return false;
    if (options?.smsOnly) return channel === "sms";
    if (smsCriticalOnly) return channel === "sms";
    return channelAllowed(settings, kind, channel);
  };

  if (settings.channelEmail && allowChannel("email")) {
    if (email) {
      await sendEmail(email, payloadResolved.title, bodyWithSnooze);
      sent.push("email");
    } else {
      skipped.push("email");
    }
  }

  if (settings.channelDiscord && allowChannel("discord")) {
    if (settings.discordWebhookUrl) {
      await sendDiscord(settings.discordWebhookUrl, payloadResolved.title, bodyWithSnooze);
      sent.push("discord");
    } else {
      skipped.push("discord");
    }
  }

  if (settings.channelSlack && allowChannel("slack")) {
    if (settings.slackWebhookUrl) {
      await sendSlack(settings.slackWebhookUrl, payloadResolved.title, bodyWithSnooze);
      sent.push("slack");
    } else {
      skipped.push("slack");
    }
  }

  if (settings.channelTeams && allowChannel("teams")) {
    if (settings.teamsWebhookUrl) {
      await sendTeams(settings.teamsWebhookUrl, payloadResolved.title, bodyWithSnooze);
      sent.push("teams");
    } else {
      skipped.push("teams");
    }
  }

  if (settings.channelNtfy && allowChannel("ntfy")) {
    if (settings.ntfyTopic) {
      await sendNtfy(
        settings.ntfyServer,
        settings.ntfyTopic,
        payloadResolved.title,
        bodyWithSnooze,
      );
      sent.push("ntfy");
    } else {
      skipped.push("ntfy");
    }
  }

  if (settings.channelPushover && allowChannel("pushover")) {
    if (settings.pushoverUserKey && settings.pushoverAppToken) {
      await sendPushover(
        settings.pushoverUserKey,
        settings.pushoverAppToken,
        payloadResolved.title,
        bodyWithSnooze,
      );
      sent.push("pushover");
    } else {
      skipped.push("pushover");
    }
  }

  if (settings.channelWhatsapp && allowChannel("whatsapp")) {
    if (settings.whatsappPhone && entitlements.canUseSms) {
      const ok = await sendTwilioWhatsApp(
        settings.whatsappPhone,
        `${payloadResolved.title}: ${bodyWithSnooze}`,
      );
      if (ok) sent.push("whatsapp");
      else skipped.push("whatsapp");
    } else {
      skipped.push("whatsapp");
    }
  }

  if (settings.channelTelegram && allowChannel("telegram")) {
    if (settings.telegramBotToken && settings.telegramChatId) {
      await sendTelegram(
        settings.telegramBotToken,
        settings.telegramChatId,
        payloadResolved.title,
        bodyWithSnooze,
      );
      sent.push("telegram");
    } else {
      skipped.push("telegram");
    }
  }

  if (settings.channelSms && allowChannel("sms")) {
    if (settings.smsPhone && entitlements.canUseSms) {
      const smsOk = await sendTwilioSms(
        settings.smsPhone,
        `${payloadResolved.title}: ${bodyWithSnooze}`,
      );
      if (smsOk) {
        sent.push("sms");
      } else {
        skipped.push(isTwilioConfigured() ? "sms" : "sms_not_configured");
      }
    } else {
      skipped.push("sms");
    }
  }

  if (settings.channelPush && allowChannel("push")) {
    if (entitlements.canUsePush) {
      const pushResult = await sendPushChannelToUser(userId, {
        title: payloadResolved.title,
        body: bodyWithSnooze,
        eventId,
      });
      if (pushResult.delivered > 0) {
        sent.push("push");
      } else {
        skipped.push(pushResult.skippedReason ?? "push");
      }
    } else {
      skipped.push("push");
    }
  }

  if (settings.channelWebhook && allowChannel("webhook")) {
    if (settings.outboundWebhookUrl && entitlements.canUseOutboundWebhook) {
      await sendOutboundWebhook(
        userId,
        settings.outboundWebhookUrl,
        settings.outboundWebhookSecret,
        payload,
      );
      sent.push("webhook");
    } else {
      skipped.push("webhook");
    }
  }

  if (smsCriticalOnly && sent.length === 0) {
    skipped.push("quiet_hours");
  }

  if (eventId != null) {
    await updateAlertEventChannels(eventId, userId, sent, skipped);
  } else {
    await recordAlertEvent({
      userId,
      kind: payload.kind ?? "generic",
      title: payload.title,
      body: payload.body,
      channelsSent: sent,
      channelsSkipped: skipped,
      meta: payload.meta,
    });
  }

  return { sent, skipped };
}
