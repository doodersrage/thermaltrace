import type { User } from "@supabase/supabase-js";
import { createAuthClient } from "./supabase";

/** Metric card ids that can be pinned on Overview Status. */
export const PINNABLE_OVERVIEW_METRICS = [
  "last_reading",
  "sensors",
  "feeds",
  "alerts",
  "house",
  "freeze_hours",
  "coldest_margin",
  "indoor_outdoor",
  "probe_spread",
  "condensation",
  "feed_health",
] as const;

export type PinnableOverviewMetric = (typeof PINNABLE_OVERVIEW_METRICS)[number];

export const PINNABLE_OVERVIEW_METRIC_LABELS: Record<
  PinnableOverviewMetric,
  string
> = {
  last_reading: "Last reading",
  sensors: "Sensors",
  feeds: "Feeds",
  alerts: "Alerts",
  house: "House",
  freeze_hours: "Freeze hours (7d)",
  coldest_margin: "Coldest margin",
  indoor_outdoor: "Indoor − outdoor",
  probe_spread: "Probe spread",
  condensation: "Condensation (7d)",
  feed_health: "Feed health",
};

export const DEFAULT_PINNED_OVERVIEW_METRICS: PinnableOverviewMetric[] = [
  "last_reading",
  "sensors",
  "feeds",
  "alerts",
  "coldest_margin",
];

export const PINNED_METRICS_MAX = 5;

const CRITICAL_BANNER_IDS = new Set(["lowBattery", "stale"]);

/** Ops Attention strip — sensors/alerts/freeze readiness only (not growth tips). */
export const OPS_ATTENTION_BANNER_IDS = new Set([
  "lowBattery",
  "stale",
  "testAlert",
  "alertSetup",
  "freezeReadiness",
]);

export function isCriticalOverviewBanner(id: string): boolean {
  return CRITICAL_BANNER_IDS.has(id);
}

export function isOpsAttentionBanner(id: string): boolean {
  return OPS_ATTENTION_BANNER_IDS.has(id);
}

export function getDashboardQuietUntil(
  user: User | null | undefined,
): string | null {
  const raw = user?.user_metadata?.dashboard_quiet_until;
  if (typeof raw !== "string" || !raw.trim()) return null;
  const ts = Date.parse(raw);
  return Number.isFinite(ts) ? new Date(ts).toISOString() : null;
}

export function isDashboardQuietActive(
  user: User | null | undefined,
  nowMs = Date.now(),
): boolean {
  const until = getDashboardQuietUntil(user);
  if (!until) return false;
  return Date.parse(until) > nowMs;
}

export function getPinnedOverviewMetrics(
  user: User | null | undefined,
): PinnableOverviewMetric[] {
  const raw = user?.user_metadata?.pinned_overview_metrics;
  if (!Array.isArray(raw)) return [...DEFAULT_PINNED_OVERVIEW_METRICS];
  const allowed = new Set<string>(PINNABLE_OVERVIEW_METRICS);
  const pinned = raw
    .filter((id): id is string => typeof id === "string" && allowed.has(id))
    .slice(0, PINNED_METRICS_MAX) as PinnableOverviewMetric[];
  return pinned.length > 0 ? pinned : [...DEFAULT_PINNED_OVERVIEW_METRICS];
}

export function parsePinnedOverviewMetricsInput(
  values: string[],
): PinnableOverviewMetric[] {
  const allowed = new Set<string>(PINNABLE_OVERVIEW_METRICS);
  const seen = new Set<string>();
  const out: PinnableOverviewMetric[] = [];
  for (const value of values) {
    const id = value.trim();
    if (!allowed.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id as PinnableOverviewMetric);
    if (out.length >= PINNED_METRICS_MAX) break;
  }
  return out.length > 0 ? out : [...DEFAULT_PINNED_OVERVIEW_METRICS];
}

export async function updateDashboardQuietUntil(
  accessToken: string,
  refreshToken: string,
  quietUntilIso: string | null,
): Promise<{ user: User | null; error: Error | null }> {
  const client = createAuthClient();
  const { data: sessionData, error: sessionError } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError || !sessionData.session) {
    return { user: null, error: sessionError ?? new Error("Invalid session") };
  }

  const { data, error } = await client.auth.updateUser({
    data: { dashboard_quiet_until: quietUntilIso },
  });

  if (error) {
    return { user: null, error };
  }

  return { user: data.user, error: null };
}

export async function updatePinnedOverviewMetrics(
  accessToken: string,
  refreshToken: string,
  metrics: PinnableOverviewMetric[],
): Promise<{ user: User | null; error: Error | null }> {
  const client = createAuthClient();
  const { data: sessionData, error: sessionError } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError || !sessionData.session) {
    return { user: null, error: sessionError ?? new Error("Invalid session") };
  }

  const { data, error } = await client.auth.updateUser({
    data: {
      pinned_overview_metrics: metrics.slice(0, PINNED_METRICS_MAX),
    },
  });

  if (error) {
    return { user: null, error };
  }

  return { user: data.user, error: null };
}

export function quietUntilSevenDaysFromNow(nowMs = Date.now()): string {
  return new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString();
}

export const GROWTH_TIPS_AUTO_HIDE_MS = 14 * 24 * 60 * 60 * 1000;

export function getDashboardGrowthTipsDismissed(
  user: User | null | undefined,
): boolean {
  return user?.user_metadata?.dashboard_growth_tips_dismissed === true;
}

/**
 * Nest / PWA / Android / Bay Buddy on Overview Tips.
 * Hidden after dismiss-once, Quiet, or 14 days past account create once the user is live and settled.
 */
export function shouldShowOverviewGrowthTips(
  user: User | null | undefined,
  opts: { hasLive: boolean; settled: boolean },
  nowMs = Date.now(),
): boolean {
  if (getDashboardGrowthTipsDismissed(user)) return false;
  if (isDashboardQuietActive(user, nowMs)) return false;
  if (opts.hasLive && opts.settled) {
    const created = Date.parse(user?.created_at ?? "");
    if (Number.isFinite(created) && nowMs - created >= GROWTH_TIPS_AUTO_HIDE_MS) {
      return false;
    }
  }
  return true;
}

export async function updateDashboardGrowthTipsDismissed(
  accessToken: string,
  refreshToken: string,
  dismissed: boolean,
): Promise<{ user: User | null; error: Error | null }> {
  const client = createAuthClient();
  const { data: sessionData, error: sessionError } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError || !sessionData.session) {
    return { user: null, error: sessionError ?? new Error("Invalid session") };
  }

  const { data, error } = await client.auth.updateUser({
    data: { dashboard_growth_tips_dismissed: dismissed },
  });

  if (error) {
    return { user: null, error };
  }

  return { user: data.user, error: null };
}

/** Viewer / alert_only roles stay on Simple overview. */
export function shouldForceSimpleOverview(
  role: string | null | undefined,
): boolean {
  return role === "viewer" || role === "alert_only";
}
