/**
 * Shared "build a ClaimsPackData for this user's household and date range"
 * logic -- used by both the authenticated download route
 * (api/claims/pack.ts) and the email-to-adjuster route (api/claims/email.ts)
 * so they can't drift out of sync with each other.
 */
import type { Entitlements } from "./entitlements";
import { clampIsoToHistoryWindow, historyCutoffIso } from "./retentionSchedule";
import { fetchGarageTempChartData } from "./garageTempsHistory";
import { getAlertSettingsForUser } from "./notify";
import { getUserHouseholdId } from "./households";
import { listHouseholdDevices } from "./devices";
import { listAlertEventsInRange } from "./alertEvents";
import { createServerClient } from "./supabase";
import { buildClaimsPackData, type ClaimsDeviceSummary, type ClaimsPackData } from "./claimsPack";
import { buildHistoryChartUrl } from "./historyUrls";

export function parseClaimsDateParam(
  value: string | null | undefined,
  endOfDay = false,
): string | undefined {
  if (!value?.trim()) return undefined;
  const trimmed = value.trim();
  // Date-only values are household calendar days in UTC (match History filters).
  const dayOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  let parsed: Date;
  if (dayOnly) {
    const y = Number(dayOnly[1]);
    const m = Number(dayOnly[2]) - 1;
    const d = Number(dayOnly[3]);
    parsed = endOfDay
      ? new Date(Date.UTC(y, m, d, 23, 59, 59, 999))
      : new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  } else {
    parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return undefined;
    if (endOfDay) {
      parsed.setUTCHours(23, 59, 59, 999);
    } else {
      parsed.setUTCHours(0, 0, 0, 0);
    }
  }
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export function claimsDateQueryValue(iso: string): string {
  return iso.slice(0, 10);
}

export type GeneratedClaimsPack = {
  pack: ClaimsPackData;
  householdId: string | null;
  fromQ: string;
  toQ: string;
};

export async function generateClaimsPackForUser(
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> },
  entitlements: Entitlements,
  range: { from?: string | null; to?: string | null },
  siteUrl: string,
): Promise<GeneratedClaimsPack> {
  const rangeFrom = clampIsoToHistoryWindow(
    parseClaimsDateParam(range.from) ??
      historyCutoffIso(Math.min(30, entitlements.historyDays)),
    entitlements.historyDays,
  );
  const rangeTo = parseClaimsDateParam(range.to, true) ?? new Date().toISOString();

  const windowDays = Math.max(
    1,
    Math.ceil((Date.parse(rangeTo) - Date.parse(rangeFrom)) / (24 * 60 * 60 * 1000)),
  );

  const householdId = await getUserHouseholdId(user.id);
  const [alertSettings, chart, events, devicesResult, householdRow] = await Promise.all([
    getAlertSettingsForUser(user.id, user.user_metadata as Record<string, unknown>),
    fetchGarageTempChartData(user.id, Math.min(windowDays, entitlements.historyDays), {
      from: rangeFrom,
      to: rangeTo,
    }),
    listAlertEventsInRange(user.id, rangeFrom, rangeTo),
    householdId
      ? listHouseholdDevices(householdId)
      : Promise.resolve({ devices: [], error: null }),
    householdId
      ? createServerClient().from("households").select("name").eq("id", householdId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const devices: ClaimsDeviceSummary[] = devicesResult.devices.map((d) => ({
    name: d.name,
    space: d.space ?? null,
    sensors: d.sensors
      .filter((s) => s.visible)
      .map((s) => ({ label: s.label, kind: s.kind })),
  }));

  const cleanSiteUrl = siteUrl.replace(/\/$/, "");
  const fromQ = claimsDateQueryValue(rangeFrom);
  const toQ = claimsDateQueryValue(rangeTo);
  const qs = new URLSearchParams({ from: fromQ, to: toQ }).toString();

  const pack = buildClaimsPackData({
    householdLabel:
      (householdRow.data as { name?: string } | null)?.name?.trim() ||
      user.email ||
      "Household",
    rangeFrom,
    rangeTo,
    freezeThresholdF: alertSettings.freezeThresholdF,
    points: chart.points,
    events,
    devices,
    readingsCsvUrl: `${cleanSiteUrl}/api/garage-temps/export.csv?${qs}`,
    alertsCsvUrl: `${cleanSiteUrl}/api/alerts/export.csv?${qs}`,
    historyUrl: buildHistoryChartUrl(cleanSiteUrl, { from: fromQ, to: toQ }),
  });

  return { pack, householdId, fromQ, toQ };
}
