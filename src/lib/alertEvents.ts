import { createServerClient } from "./supabase";
import { escapeCsvField } from "./csvEscape";

export type AlertEventMeta = {
  thresholdF?: number;
  probeLabel?: string;
  probeTempF?: number;
  outdoorTempF?: number | null;
  deltaTF?: number | null;
  runwayHours?: number | null;
  doorOpen?: boolean;
  feedback?: "false_alarm" | string;
  feedbackAt?: string;
  suggestedTipId?: string;
  reasonSummary?: string;
};

export type AlertEventRow = {
  id: number;
  user_id: string;
  kind: string;
  title: string;
  body: string;
  channels_sent: string[];
  channels_skipped: string[];
  created_at: string;
  acknowledged_at: string | null;
  meta?: AlertEventMeta;
};

function parseAlertEventMeta(raw: unknown): AlertEventMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as AlertEventMeta;
}

export async function recordAlertEvent(input: {
  userId: string;
  kind: string;
  title: string;
  body: string;
  channelsSent: string[];
  channelsSkipped: string[];
  meta?: AlertEventMeta;
}): Promise<number | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("alert_events")
    .insert({
      user_id: input.userId,
      kind: input.kind,
      title: input.title,
      body: input.body,
      channels_sent: input.channelsSent,
      channels_skipped: input.channelsSkipped,
      meta: (input.meta ?? {}) as import("../types/supabase").Json,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to record alert event:", error.message);
    return null;
  }

  return data?.id ?? null;
}

export async function updateAlertEventMeta(
  userId: string,
  eventId: number,
  patch: AlertEventMeta,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServerClient();
  const existing = await getAlertEventForUser(userId, eventId);
  if (!existing) return { ok: false, error: "Alert event not found." };

  const { error } = await supabase
    .from("alert_events")
    .update({ meta: { ...existing.meta, ...patch } as import("../types/supabase").Json })
    .eq("id", eventId)
    .eq("user_id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function updateAlertEventChannels(
  eventId: number,
  userId: string,
  channelsSent: string[],
  channelsSkipped: string[],
): Promise<void> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("alert_events")
    .update({
      channels_sent: channelsSent,
      channels_skipped: channelsSkipped,
    })
    .eq("id", eventId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to update alert event channels:", error.message);
  }
}

export async function acknowledgeAlertEvent(
  userId: string,
  eventId: number,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("alert_events")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", eventId)
    .eq("user_id", userId)
    .is("acknowledged_at", null);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Acknowledge the most recent delivered alert that is still unhandled. */
export async function acknowledgeLatestUnackedAlert(
  userId: string,
): Promise<{ ok: boolean; eventId?: number; error?: string }> {
  const supabase = createServerClient();
  const { data, error: fetchError } = await supabase
    .from("alert_events")
    .select("id")
    .eq("user_id", userId)
    .is("acknowledged_at", null)
    .not("channels_sent", "eq", "{}")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) return { ok: false, error: fetchError.message };
  if (!data) return { ok: false, error: "No unhandled alerts." };

  const result = await acknowledgeAlertEvent(userId, data.id);
  if (!result.ok) return result;
  return { ok: true, eventId: data.id };
}

export async function getAlertEventForUser(
  userId: string,
  eventId: number,
): Promise<AlertEventRow | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("alert_events")
    .select("*")
    .eq("user_id", userId)
    .eq("id", eventId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    ...(data as AlertEventRow),
    meta: parseAlertEventMeta((data as { meta?: unknown }).meta),
  };
}

export async function listRecentAlertEvents(
  userId: string,
  limit = 20,
): Promise<AlertEventRow[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("alert_events")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => ({
    ...(row as AlertEventRow),
    meta: parseAlertEventMeta((row as { meta?: unknown }).meta),
  }));
}

export const ALERT_EVENTS_EXPORT_MAX = 5000;

/** Alert events in [fromIso, toIso], oldest first, capped for export. */
export async function listAlertEventsInRange(
  userId: string,
  fromIso: string,
  toIso: string,
  limit = ALERT_EVENTS_EXPORT_MAX,
): Promise<AlertEventRow[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("alert_events")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", fromIso)
    .lte("created_at", toIso)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return data as AlertEventRow[];
}

export function buildAlertEventsCsv(events: AlertEventRow[]): string {
  const headers = [
    "created_at",
    "kind",
    "title",
    "body",
    "channels_sent",
    "channels_skipped",
    "acknowledged_at",
  ];

  const rows = events.map((event) =>
    [
      event.created_at,
      event.kind,
      event.title,
      event.body,
      (event.channels_sent ?? []).join("|"),
      (event.channels_skipped ?? []).join("|"),
      event.acknowledged_at ?? "",
    ]
      .map(escapeCsvField)
      .join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}

export async function countUnacknowledgedAlerts(userId: string): Promise<number> {
  const supabase = createServerClient();
  const { count } = await supabase
    .from("alert_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("acknowledged_at", null)
    .not("channels_sent", "eq", "{}");

  return count ?? 0;
}
