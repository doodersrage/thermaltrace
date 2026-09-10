import { describe, expect, it } from "vitest";
import {
  ALERT_COOLDOWN_MS,
  DEFAULT_ALERT_SETTINGS,
  evaluateAlerts,
  evaluateBatteryHealth,
  evaluateFloodAlerts,
  evaluateForecastFreeze,
  evaluateOutage,
  evaluateRateChange,
  evaluateRssiHealth,
  getAlertSettingsFromMetadata,
  isAlertCooldownActive,
  parseChannelSeverity,
  resolveAlertEmail,
  type AlertReading,
  type AlertSettings,
  type DeviceHealth,
} from "./alerts";
import { detectTemperatureAnomalies } from "./anomalyDetection";
import { computeIndoorOutdoorDelta } from "./indoorOutdoorDelta";
import { parseIngestPayload, inferSensorKind } from "./ingestPayload";
import { resolvePlanTierFromPriceId } from "./planTier";
import { summarizeSeasonal } from "./seasonalInsights";

const enabled: AlertSettings = { ...DEFAULT_ALERT_SETTINGS, enabled: true };

function reading(overrides: Partial<AlertReading> = {}): AlertReading {
  return { label: "Garage", tempf: 50, humidity: 40, ...overrides };
}

describe("evaluateAlerts", () => {
  it("produces nothing when alerts are disabled, even past every threshold", () => {
    const messages = evaluateAlerts(
      { ...enabled, enabled: false },
      [reading({ tempf: 10, humidity: 99 })],
    );
    expect(messages).toEqual([]);
  });

  it("fires a freeze message at or below the threshold but not above it", () => {
    expect(evaluateAlerts(enabled, [reading({ tempf: 34 })])).toEqual([
      "Garage is 34.0°F (at or below freeze threshold 34°F).",
    ]);
    expect(evaluateAlerts(enabled, [reading({ tempf: 34.1 })])).toEqual([]);
  });

  it("fires a humidity message at or above the threshold but not below it", () => {
    expect(evaluateAlerts(enabled, [reading({ humidity: 75 })])).toEqual([
      "Garage humidity is 75% (above threshold 75%).",
    ]);
    expect(evaluateAlerts(enabled, [reading({ humidity: 74.9 })])).toEqual([]);
  });

  it("can fire both a freeze and a humidity message for the same reading", () => {
    const messages = evaluateAlerts(enabled, [reading({ tempf: 20, humidity: 90 })]);
    expect(messages).toHaveLength(2);
  });

  it("skips a sensor that is outside a configured threshold scope", () => {
    const scoped: AlertSettings = {
      ...enabled,
      thresholdSensorScope: { includedSensorIds: ["sensor-a"], overrides: {} },
    };
    const messages = evaluateAlerts(scoped, [
      reading({ tempf: 10, sensorId: "sensor-b" }),
    ]);
    expect(messages).toEqual([]);
  });

  it("applies a per-sensor freeze threshold override", () => {
    const scoped: AlertSettings = {
      ...enabled,
      thresholdSensorScope: {
        includedSensorIds: [],
        overrides: { "sensor-a": { freezeThresholdF: 40 } },
      },
    };
    const messages = evaluateAlerts(scoped, [
      reading({ tempf: 38, sensorId: "sensor-a" }),
    ]);
    expect(messages).toEqual([
      "Garage is 38.0°F (at or below freeze threshold 40°F).",
    ]);
  });

  it("waits for freeze dwell minutes before firing", () => {
    const dwell: AlertSettings = { ...enabled, freezeDwellMinutes: 10 };
    const now = Date.parse("2026-01-01T12:00:00.000Z");
    const samples = {
      "sensor-a": [
        { at: "2026-01-01T11:55:00.000Z", tempF: 30 },
        { at: "2026-01-01T12:00:00.000Z", tempF: 30 },
      ],
    };
    expect(
      evaluateAlerts(dwell, [reading({ tempf: 30, sensorId: "sensor-a" })], {
        dwellSamplesBySensorId: samples,
        nowMs: now,
      }),
    ).toEqual([]);

    const longEnough = {
      "sensor-a": [
        { at: "2026-01-01T11:45:00.000Z", tempF: 30 },
        { at: "2026-01-01T11:50:00.000Z", tempF: 30 },
        { at: "2026-01-01T12:00:00.000Z", tempF: 30 },
      ],
    };
    expect(
      evaluateAlerts(dwell, [reading({ tempf: 30, sensorId: "sensor-a" })], {
        dwellSamplesBySensorId: longEnough,
        nowMs: now,
      }),
    ).toEqual([
      "Garage is 30.0°F (at or below freeze threshold 34°F for 10+ min).",
    ]);
  });
});

describe("evaluateFloodAlerts", () => {
  it("reports nothing when disabled", () => {
    expect(evaluateFloodAlerts({ ...enabled, enabled: false }, [{ label: "Sump" }])).toEqual([]);
  });

  it("always reports every wet sensor when enabled -- no threshold to clear", () => {
    expect(evaluateFloodAlerts(enabled, [{ label: "Sump" }, { label: "Basement" }])).toEqual([
      "Sump flood / leak sensor is wet.",
      "Basement flood / leak sensor is wet.",
    ]);
  });
});

describe("evaluateForecastFreeze", () => {
  it("is silent when the forecast feature is off even if alerts are enabled", () => {
    expect(evaluateForecastFreeze(enabled, 20, 6)).toBeNull();
  });

  it("is silent when the forecast low is above the freeze threshold", () => {
    const settings = { ...enabled, forecastFreezeEnabled: true, freezeThresholdF: 34 };
    expect(evaluateForecastFreeze(settings, 40, 6)).toBeNull();
  });

  it("fires when the forecast low reaches the freeze threshold", () => {
    const settings = { ...enabled, forecastFreezeEnabled: true, freezeThresholdF: 34 };
    expect(evaluateForecastFreeze(settings, 30, 6)).toBe(
      "Outdoor forecast reaches 30.0°F within 6h (freeze threshold 34°F).",
    );
  });

  it("is silent when the forecast value is missing or non-finite", () => {
    const settings = { ...enabled, forecastFreezeEnabled: true };
    expect(evaluateForecastFreeze(settings, null, 6)).toBeNull();
    expect(evaluateForecastFreeze(settings, Number.NaN, 6)).toBeNull();
  });
});

describe("evaluateRateChange", () => {
  it("needs at least two readings", () => {
    expect(evaluateRateChange(enabled, "Garage", [50])).toBeNull();
  });

  it("fires on a rise that meets the threshold and shows a + sign", () => {
    const settings = { ...enabled, rateChangeF: 15 };
    expect(evaluateRateChange(settings, "Garage", [50, 66])).toBe(
      "Garage changed +16.0°F in the last hour (threshold ±15°F).",
    );
  });

  it("fires on a drop that meets the threshold with no + sign", () => {
    const settings = { ...enabled, rateChangeF: 15 };
    expect(evaluateRateChange(settings, "Garage", [66, 50])).toBe(
      "Garage changed -16.0°F in the last hour (threshold ±15°F).",
    );
  });

  it("is silent when the change stays under the threshold", () => {
    const settings = { ...enabled, rateChangeF: 15 };
    expect(evaluateRateChange(settings, "Garage", [50, 60])).toBeNull();
  });

  it("only compares the first and last sample, ignoring the path between", () => {
    const settings = { ...enabled, rateChangeF: 15 };
    // Big swing in the middle nets out to a small first->last delta.
    expect(evaluateRateChange(settings, "Garage", [50, 90, 52])).toBeNull();
  });
});

function device(overrides: Partial<DeviceHealth> = {}): DeviceHealth {
  return { deviceName: "Sensor 1", batteryPct: 50, rssi: -50, ...overrides };
}

describe("evaluateBatteryHealth", () => {
  it("is silent when battery alerts are disabled even below threshold", () => {
    expect(evaluateBatteryHealth(enabled, [device({ batteryPct: 5 })])).toEqual([]);
  });

  it("fires at or below the threshold and ignores unknown battery levels", () => {
    const settings = { ...enabled, batteryAlertsEnabled: true, batteryThresholdPct: 20 };
    const messages = evaluateBatteryHealth(settings, [
      device({ deviceName: "Low", batteryPct: 20 }),
      device({ deviceName: "Fine", batteryPct: 21 }),
      device({ deviceName: "Unknown", batteryPct: null }),
    ]);
    expect(messages).toEqual(["Low battery is 20% (threshold 20%)."]);
  });
});

describe("evaluateRssiHealth", () => {
  it("is silent when rssi alerts are disabled", () => {
    expect(evaluateRssiHealth(enabled, [device({ rssi: -90 })])).toEqual([]);
  });

  it("fires at or below the (negative) threshold", () => {
    const settings = { ...enabled, rssiAlertsEnabled: true, rssiThreshold: -80 };
    const messages = evaluateRssiHealth(settings, [
      device({ deviceName: "Weak", rssi: -85 }),
      device({ deviceName: "Ok", rssi: -70 }),
    ]);
    expect(messages).toEqual(["Weak signal is -85 dBm (threshold -80 dBm)."]);
  });
});

describe("evaluateOutage", () => {
  it("is silent when disabled", () => {
    expect(evaluateOutage({ ...enabled, enabled: false }, "Garage", null)).toBeNull();
  });

  it("is silent when outageHours is zero or negative -- feature is off", () => {
    expect(evaluateOutage({ ...enabled, outageHours: 0 }, "Garage", null)).toBeNull();
  });

  it("reports a device that has never reported", () => {
    expect(evaluateOutage(enabled, "Garage", null)).toBe(
      "Garage has never reported a reading.",
    );
  });

  it("is silent before the outage window elapses and fires once it does", () => {
    const settings = { ...enabled, outageHours: 2 };
    const now = Date.parse("2026-01-01T12:00:00.000Z");
    const justUnder = new Date(now - 1.9 * 60 * 60 * 1000).toISOString();
    const atThreshold = new Date(now - 2 * 60 * 60 * 1000).toISOString();

    expect(evaluateOutage(settings, "Garage", justUnder, now)).toBeNull();
    expect(evaluateOutage(settings, "Garage", atThreshold, now)).toBe(
      "Garage has been silent for 2.0 hours (outage threshold 2h).",
    );
  });
});

describe("isAlertCooldownActive", () => {
  it("is false with no last-sent timestamp", () => {
    expect(isAlertCooldownActive(null)).toBe(false);
    expect(isAlertCooldownActive(DEFAULT_ALERT_SETTINGS)).toBe(false);
  });

  it("accepts either a raw timestamp string or a settings object", () => {
    const now = Date.parse("2026-01-01T12:00:00.000Z");
    const recent = new Date(now - 60_000).toISOString();
    expect(isAlertCooldownActive(recent, now)).toBe(true);
    expect(isAlertCooldownActive({ ...DEFAULT_ALERT_SETTINGS, lastAlertSentAt: recent }, now)).toBe(
      true,
    );
  });

  it("expires after the 4-hour cooldown window", () => {
    const now = Date.parse("2026-01-01T12:00:00.000Z");
    const justUnder = new Date(now - (4 * 60 * 60 * 1000 - 1000)).toISOString();
    const justOver = new Date(now - (4 * 60 * 60 * 1000 + 1000)).toISOString();
    expect(isAlertCooldownActive(justUnder, now)).toBe(true);
    expect(isAlertCooldownActive(justOver, now)).toBe(false);
  });

  it("treats an unparsable timestamp as no cooldown", () => {
    expect(isAlertCooldownActive("not-a-date")).toBe(false);
  });

  it("works end-to-end with settings decoded from user metadata", () => {
    const now = Date.parse("2026-08-24T12:00:00.000Z");
    const settings = getAlertSettingsFromMetadata({
      alert_settings: {
        enabled: true,
        last_alert_sent_at: "2026-08-24T10:30:00.000Z",
      },
    });

    expect(isAlertCooldownActive(settings, now)).toBe(true);
    expect(isAlertCooldownActive(settings, now + ALERT_COOLDOWN_MS + 1)).toBe(false);
  });
});

describe("resolveAlertEmail", () => {
  it("prefers the saved settings email over the account fallback", () => {
    expect(resolveAlertEmail({ email: "alerts@example.com" }, "account@example.com")).toBe(
      "alerts@example.com",
    );
  });

  it("falls back to the account email when settings has none", () => {
    expect(resolveAlertEmail({ email: null }, "account@example.com")).toBe(
      "account@example.com",
    );
    expect(resolveAlertEmail({ email: "   " }, "account@example.com")).toBe(
      "account@example.com",
    );
  });

  it("returns null when neither is set", () => {
    expect(resolveAlertEmail({ email: null }, null)).toBeNull();
    expect(resolveAlertEmail({ email: null }, undefined)).toBeNull();
  });
});

describe("parseChannelSeverity", () => {
  it("drops unknown notify kinds and unknown channel names", () => {
    expect(
      parseChannelSeverity({
        threshold: ["email", "not-a-channel"],
        madeUpKind: ["email"],
      }),
    ).toEqual({ threshold: ["email"] });
  });

  it("drops a kind entirely once all its channels are invalid", () => {
    expect(parseChannelSeverity({ threshold: ["not-a-channel"] })).toEqual({});
  });

  it("returns an empty map for non-object input", () => {
    expect(parseChannelSeverity(null)).toEqual({});
    expect(parseChannelSeverity(["email"])).toEqual({});
    expect(parseChannelSeverity("email")).toEqual({});
  });
});


describe("ingest payload (cross-module smoke test)", () => {
  it("parses classic temp JSON and typed sensors", () => {
    const { tempProbes, typed } = parseIngestPayload({
      temp: { "0": { c: 10, f: 50, h: 40 } },
      sensors: [{ key: "door1", bool: true, kind: "door" }],
    });
    expect(tempProbes["0"]?.f).toBe(50);
    expect(typed).toHaveLength(1);
    expect(inferSensorKind("door1", typed[0]!)).toBe("door");
  });
});

describe("entitlements price mapping (cross-module smoke test)", () => {
  it("defaults unknown prices to member", () => {
    expect(resolvePlanTierFromPriceId("price_abc")).toBe("member");
  });
});

describe("seasonal insights (cross-module smoke test)", () => {
  it("summarizes extremes", () => {
    const insights = summarizeSeasonal(
      [
        { timestamp: "2026-01-01T00:00:00Z", tempf: 20, humidity: 30, probeLabel: "A" },
        { timestamp: "2026-01-02T00:00:00Z", tempf: 40, humidity: 80, probeLabel: "A" },
      ],
      30,
    );
    expect(insights.length).toBeGreaterThanOrEqual(3);
  });
});

describe("indoor outdoor delta (cross-module smoke test)", () => {
  it("computes garage vs outdoor difference", () => {
    const delta = computeIndoorOutdoorDelta(
      [
        { timestamp: "2026-01-01T00:00:00Z", tempf: 50, humidity: 40, probeLabel: "A" },
        { timestamp: "2026-01-01T01:00:00Z", tempf: 60, humidity: 40, probeLabel: "A" },
      ],
      40,
      "clear sky",
      "Testville",
    );
    expect(delta?.indoorAvgF).toBe(55);
    expect(delta?.deltaF).toBe(15);
  });
});

describe("detectTemperatureAnomalies (cross-module smoke test)", () => {
  it("detects rapid temperature drops", () => {
    const notices = detectTemperatureAnomalies([
      {
        probeLabel: "Garage",
        timestamp: "2026-08-24T10:00:00.000Z",
        tempf: 55,
        humidity: 40,
      },
      {
        probeLabel: "Garage",
        timestamp: "2026-08-24T10:30:00.000Z",
        tempf: 40,
        humidity: 42,
      },
    ]);

    expect(notices).toHaveLength(1);
    expect(notices[0]?.severity).toBe("warning");
  });
});
