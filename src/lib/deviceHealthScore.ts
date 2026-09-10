import type { DeviceWithSensors } from "./devices";
import type { LatestSensorRow } from "./sensorReadings";
import { STALE_MS } from "./relativeTime";
import { parseBatteryHistory } from "./batterySparkline";
import { estimateBatteryDaysRemaining } from "./batteryTrend";

export type DeviceHealthLabel = "healthy" | "watch" | "at_risk" | "offline";

export type DeviceHealthScore = {
  score: number;
  label: DeviceHealthLabel;
  detail: string;
  batteryPct: number | null;
  rssi: number | null;
  daysRemaining: number | null;
};

function readMetaNumber(meta: unknown, key: string): number | null {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const value = (meta as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Score a single device for the Devices health table. */
export function scoreDeviceHealth(
  device: DeviceWithSensors,
  latest: LatestSensorRow[] = [],
  nowMs = Date.now(),
  rssiThreshold = -80,
): DeviceHealthScore {
  const batteryPct = readMetaNumber(device.meta, "battery_pct");
  const rssi = readMetaNumber(device.meta, "rssi");
  const history = parseBatteryHistory(device.meta);
  const daysRemaining = estimateBatteryDaysRemaining(history);

  if (!device.enabled) {
    return {
      score: 25,
      label: "offline",
      detail: "Device disabled",
      batteryPct,
      rssi,
      daysRemaining,
    };
  }

  if (!device.last_seen_at) {
    return {
      score: 30,
      label: "offline",
      detail: "Waiting for first reading",
      batteryPct,
      rssi,
      daysRemaining,
    };
  }

  const ageMs = nowMs - Date.parse(device.last_seen_at);
  const stale = !Number.isFinite(ageMs) || ageMs >= STALE_MS;

  const deviceLatest = latest.filter((row) => row.sensor.device_id === device.id);
  const floodWet = deviceLatest.some(
    (row) => row.sensor.kind === "flood" && row.value_bool === true,
  );

  if (floodWet) {
    return {
      score: stale ? 10 : 20,
      label: "at_risk",
      detail: "Flood / leak contact wet",
      batteryPct,
      rssi,
      daysRemaining,
    };
  }

  if (stale) {
    return {
      score: 45,
      label: "watch",
      detail: "Probe data stale, check power/Wi‑Fi",
      batteryPct,
      rssi,
      daysRemaining,
    };
  }

  if (batteryPct != null && batteryPct <= 15) {
    return {
      score: 55,
      label: "watch",
      detail: `Battery ${batteryPct}% — replace soon`,
      batteryPct,
      rssi,
      daysRemaining,
    };
  }

  if (daysRemaining != null && daysRemaining <= 14) {
    return {
      score: 60,
      label: "watch",
      detail: `Battery ~${Math.round(daysRemaining)} days left`,
      batteryPct,
      rssi,
      daysRemaining,
    };
  }

  if (rssi != null && rssi <= rssiThreshold) {
    return {
      score: 65,
      label: "watch",
      detail: `Weak RSSI (${rssi} dBm)`,
      batteryPct,
      rssi,
      daysRemaining,
    };
  }

  return {
    score: 95,
    label: "healthy",
    detail: "Reporting, dry flood contacts",
    batteryPct,
    rssi,
    daysRemaining,
  };
}

export function formatBatteryEta(daysRemaining: number | null): string {
  if (daysRemaining == null) return "—";
  if (daysRemaining < 2) return "Replace soon";
  if (daysRemaining < 60) return `~${Math.round(daysRemaining)} days`;
  return `~${Math.round(daysRemaining / 7)} wk`;
}
