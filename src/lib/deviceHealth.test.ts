import { describe, expect, it } from "vitest";
import { deviceHealthFromDevices, readDeviceMetaNumber } from "./deviceHealth";
import type { DeviceWithSensors } from "./devices";

describe("readDeviceMetaNumber", () => {
  it("returns null when meta is undefined", () => {
    expect(readDeviceMetaNumber(undefined, "battery_pct")).toBeNull();
  });

  it("returns null when the key is missing or non-numeric", () => {
    expect(readDeviceMetaNumber({}, "battery_pct")).toBeNull();
    expect(readDeviceMetaNumber({ battery_pct: "not-a-number" }, "battery_pct")).toBeNull();
    expect(readDeviceMetaNumber({ battery_pct: undefined }, "battery_pct")).toBeNull();
  });

  it("treats a null value as 0 (Number(null) is 0, which is finite)", () => {
    expect(readDeviceMetaNumber({ battery_pct: null }, "battery_pct")).toBe(0);
  });

  it("coerces a numeric-looking string to a number", () => {
    expect(readDeviceMetaNumber({ battery_pct: "72" }, "battery_pct")).toBe(72);
  });

  it("returns the numeric value directly", () => {
    expect(readDeviceMetaNumber({ rssi: -55 }, "rssi")).toBe(-55);
  });
});

describe("deviceHealthFromDevices", () => {
  it("maps each device's name, battery, and rssi from meta", () => {
    const devices = [
      { name: "Garage", meta: { battery_pct: 80, rssi: -60 } },
      { name: "Attic", meta: {} },
      { name: "Shed", meta: undefined },
    ] as unknown as DeviceWithSensors[];

    expect(deviceHealthFromDevices(devices)).toEqual([
      { deviceName: "Garage", batteryPct: 80, rssi: -60 },
      { deviceName: "Attic", batteryPct: null, rssi: null },
      { deviceName: "Shed", batteryPct: null, rssi: null },
    ]);
  });

  it("returns an empty array for an empty device list", () => {
    expect(deviceHealthFromDevices([])).toEqual([]);
  });
});
