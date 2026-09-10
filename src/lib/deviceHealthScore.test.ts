import { describe, expect, it } from "vitest";
import { formatBatteryEta, scoreDeviceHealth } from "./deviceHealthScore";
import type { DeviceWithSensors } from "./devices";

function device(partial: Partial<DeviceWithSensors> & Pick<DeviceWithSensors, "id" | "name">): DeviceWithSensors {
  return {
    household_id: "h1",
    source: "push",
    pull_url: null,
    ingest_key_prefix: "abcd",
    enabled: true,
    last_seen_at: new Date().toISOString(),
    sort_order: 0,
    meta: {},
    space: null,
    sensors: [],
    ...partial,
  };
}

describe("deviceHealthScore", () => {
  it("scores a fresh device as healthy", () => {
    const health = scoreDeviceHealth(device({ id: "d1", name: "Probe" }));
    expect(health.label).toBe("healthy");
    expect(health.score).toBeGreaterThan(80);
  });

  it("flags disabled devices offline", () => {
    const health = scoreDeviceHealth(
      device({ id: "d1", name: "Probe", enabled: false }),
    );
    expect(health.label).toBe("offline");
  });

  it("formats battery ETA", () => {
    expect(formatBatteryEta(null)).toBe("—");
    expect(formatBatteryEta(1)).toBe("Replace soon");
    expect(formatBatteryEta(10)).toBe("~10 days");
  });
});
