import type { AlertSettings, NotifyKind } from "./alerts";

const SNOOZE_BLOCKED: NotifyKind[] = [
  "threshold",
  "rate",
  "digest",
  "generic",
  "forecast",
  "runway",
  "nws",
  "rule",
  "battery",
  "rssi",
];

const VACATION_BLOCKED: NotifyKind[] = [
  "threshold",
  "rate",
  "digest",
  "generic",
  "rule",
  "battery",
  "rssi",
];

export function isSnoozeActive(settings: AlertSettings, now = Date.now()): boolean {
  if (!settings.snoozeUntil) return false;
  const until = Date.parse(settings.snoozeUntil);
  return Number.isFinite(until) && now < until;
}

export function isVacationActive(settings: AlertSettings, now = Date.now()): boolean {
  if (!settings.vacationUntil) return false;
  const until = Date.parse(settings.vacationUntil);
  return Number.isFinite(until) && now < until;
}

export function shouldSuppressForSnoozeOrVacation(
  settings: AlertSettings,
  kind: NotifyKind | undefined,
): boolean {
  const k = kind ?? "generic";
  if (isSnoozeActive(settings) && SNOOZE_BLOCKED.includes(k)) return true;
  if (isVacationActive(settings) && VACATION_BLOCKED.includes(k)) return true;
  return false;
}

export function snoozeUntilFromHours(hours: number, now = Date.now()): string {
  const clamped = Math.min(Math.max(Number.isFinite(hours) ? hours : 24, 1), 168);
  return new Date(now + clamped * 60 * 60 * 1000).toISOString();
}

export function vacationUntilFromDays(days: number, now = Date.now()): string {
  const clamped = Math.min(Math.max(Number.isFinite(days) ? days : 7, 1), 90);
  return new Date(now + clamped * 24 * 60 * 60 * 1000).toISOString();
}

/** End-of-day ISO for a YYYY-MM-DD vacation return date (local calendar day). */
export function vacationUntilFromDate(
  dateYmd: string,
  now = Date.now(),
): string | null {
  const trimmed = dateYmd.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const end = new Date(`${trimmed}T23:59:59`);
  const ms = end.getTime();
  if (!Number.isFinite(ms) || ms <= now) return null;
  const max = now + 90 * 24 * 60 * 60 * 1000;
  return new Date(Math.min(ms, max)).toISOString();
}

/** Persist snooze on alert_settings for a user (used by ack playbook). */
export async function snoozeAlertsForUser(
  userId: string,
  hours: number,
): Promise<void> {
  const { getAlertSettingsForUser, saveAlertSettingsForUser } = await import("./notify");
  const settings = await getAlertSettingsForUser(userId, {});
  await saveAlertSettingsForUser(userId, {
    ...settings,
    snoozeUntil: snoozeUntilFromHours(hours),
  });
}
