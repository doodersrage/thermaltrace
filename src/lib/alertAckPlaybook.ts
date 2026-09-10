import { acknowledgeAlertEvent, getAlertEventForUser, updateAlertEventMeta } from "./alertEvents";
import { getUserHouseholdId } from "./households";
import { createServerClient } from "./supabase";
import { snoozeAlertsForUser } from "./alertSnooze";
import { sendTenantFreezeRelay } from "./tenantRelay";
import { deliverWebhookPost } from "./webhookDeliveries";
import { getAlertSettingsForUser } from "./notify";
import { resolveSiteUrl } from "./schemaMarkup";
import { suggestFalseAlarmTip } from "./falseAlarmHints";

export type AckPlaybookAction =
  | "ack"
  | "snooze_1h"
  | "snooze_4h"
  | "snooze_24h"
  | "false_alarm"
  | "notify_tenant"
  | "webhook_ping";

export type AckPlaybookResult = {
  ok: boolean;
  message: string;
};

export async function executeAlertAckPlaybook(input: {
  userId: string;
  userEmail: string | null | undefined;
  eventId: number;
  action: AckPlaybookAction;
  siteUrl?: string;
}): Promise<AckPlaybookResult> {
  const event = await getAlertEventForUser(input.userId, input.eventId);
  if (!event) {
    return { ok: false, message: "Alert event not found." };
  }

  if (input.action === "snooze_1h" || input.action === "snooze_4h" || input.action === "snooze_24h" || input.action === "false_alarm") {
    const hours =
      input.action === "snooze_1h" ? 1 : input.action === "snooze_4h" ? 4 : 24;
    await snoozeAlertsForUser(input.userId, hours);
  }

  let suggestedTipId: string | undefined;
  if (input.action === "false_alarm") {
    const tip = suggestFalseAlarmTip(event.kind);
    suggestedTipId = tip.id;
    await updateAlertEventMeta(input.userId, input.eventId, {
      feedback: "false_alarm",
      feedbackAt: new Date().toISOString(),
      suggestedTipId: tip.id,
    });
  }

  if (input.action === "notify_tenant") {
    const householdId = await getUserHouseholdId(input.userId);
    if (!householdId) {
      return { ok: false, message: "No household for tenant relay." };
    }
    const supabase = createServerClient();
    const { data: household } = await supabase
      .from("households")
      .select("name")
      .eq("id", householdId)
      .maybeSingle();
    const relay = await sendTenantFreezeRelay({
      householdId,
      managerUserId: input.userId,
      householdName: household?.name?.trim() || "Property",
      alertTitle: event.title,
      alertBody: event.body,
      siteUrl: input.siteUrl,
    });
    if (!relay.ok) {
      return { ok: false, message: relay.error ?? "Tenant relay failed." };
    }
  }

  if (input.action === "webhook_ping") {
    const settings = await getAlertSettingsForUser(input.userId, {});
    if (!settings.outboundWebhookUrl?.trim()) {
      return { ok: false, message: "No outbound webhook configured." };
    }
    const payload = JSON.stringify({
      title: "ThermalTrace alert acknowledged",
      body: event.body,
      kind: "generic",
      action: "ack_playbook",
      event_id: event.id,
      sent_at: new Date().toISOString(),
    });
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (settings.outboundWebhookSecret?.trim()) {
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(settings.outboundWebhookSecret.trim()),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
      headers["X-Signature"] = [...new Uint8Array(sig)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    await deliverWebhookPost(
      input.userId,
      "outbound_alert",
      settings.outboundWebhookUrl,
      headers,
      payload,
    );
  }

  const ack = await acknowledgeAlertEvent(input.userId, input.eventId);
  if (!ack.ok) {
    return { ok: false, message: ack.error ?? "Could not acknowledge alert." };
  }

  if (input.action === "false_alarm" && suggestedTipId) {
    const tip = suggestFalseAlarmTip(event.kind);
    const tipHref = tip.href ?? "/dashboard/alerts#alert-section-essentials";
    return {
      ok: true,
      message: `Marked as false alarm: alerts snoozed 24h. Suggested fix: ${tip.title}. Open ${tipHref}`,
    };
  }

  const messages: Record<AckPlaybookAction, string> = {
    ack: "Alert marked as handled.",
    snooze_1h: "Alert handled: freeze alerts snoozed for 1 hour.",
    snooze_4h: "Alert handled: freeze alerts snoozed for 4 hours.",
    snooze_24h: "Alert handled: freeze alerts snoozed for 24 hours.",
    false_alarm:
      "Marked as false alarm: alerts snoozed 24h. Check probe placement if this keeps happening.",
    notify_tenant: "Alert handled: tenant contact emailed.",
    webhook_ping: "Alert handled: outbound webhook notified.",
  };

  return { ok: true, message: messages[input.action] };
}
