import { appendBatterySample } from "./batteryTrend";

export type RssiSample = { dbm: number; at: string };

export function appendRssiSample(
  history: unknown,
  dbm: number,
  at = new Date().toISOString(),
  maxSamples = 14,
): RssiSample[] {
  const existing = Array.isArray(history)
    ? (history as RssiSample[]).filter(
        (s) => typeof s.dbm === "number" && typeof s.at === "string",
      )
    : [];
  return [...existing, { dbm, at }].slice(-maxSamples);
}

export function parseRssiHistory(meta: unknown): RssiSample[] {
  if (!meta || typeof meta !== "object") return [];
  const history = (meta as Record<string, unknown>).rssi_history;
  if (!Array.isArray(history)) return [];
  return history.filter(
    (item): item is RssiSample =>
      !!item &&
      typeof item === "object" &&
      typeof (item as RssiSample).dbm === "number" &&
      typeof (item as RssiSample).at === "string",
  );
}

/** Merge live battery/rssi fields with rolling history rings on device meta. */
export function enrichDeviceMetaHistories(
  existingMeta: unknown,
  patch: Record<string, unknown>,
  at = new Date().toISOString(),
): Record<string, unknown> {
  const next = { ...patch };
  const meta =
    existingMeta && typeof existingMeta === "object" && !Array.isArray(existingMeta)
      ? (existingMeta as Record<string, unknown>)
      : {};

  if (typeof next.battery_pct === "number" && Number.isFinite(next.battery_pct)) {
    next.battery_history = appendBatterySample(meta.battery_history, next.battery_pct, at);
  }
  if (typeof next.rssi === "number" && Number.isFinite(next.rssi)) {
    next.rssi_history = appendRssiSample(meta.rssi_history, next.rssi, at);
  }
  return next;
}
