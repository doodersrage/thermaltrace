import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeviceSensor } from "./devices";
import type { DiscoveredPushSensor } from "./pushSensorDiscovery";

const mockUpsertDeviceSensor = vi.fn();
vi.mock("./devices", () => ({
  upsertDeviceSensor: (...a: unknown[]) => mockUpsertDeviceSensor(...a),
}));

const mockDefaultUnitForKind = vi.fn();
vi.mock("./sensorKinds", () => ({
  defaultUnitForKind: (...a: unknown[]) => mockDefaultUnitForKind(...a),
}));

function sensor(overrides: Partial<DeviceSensor> = {}): DeviceSensor {
  return {
    id: "s1",
    device_id: "device-1",
    key: "0",
    kind: "temp",
    label: "Probe",
    unit: "F",
    visible: true,
    sort_order: 0,
    offset_num: 0,
    ...overrides,
  } as unknown as DeviceSensor;
}

beforeEach(() => {
  mockUpsertDeviceSensor.mockReset().mockResolvedValue({ sensor: sensor(), error: null });
  mockDefaultUnitForKind.mockReset().mockReturnValue("default-unit");
});

describe("ensureDiscoveredPushSensors", () => {
  it("does nothing for an empty discovery list", async () => {
    const { ensureDiscoveredPushSensors } = await import("./pushSensorDiscovery");

    const result = await ensureDiscoveredPushSensors("device-1", []);

    expect(result).toEqual({ created: 0, error: null });
    expect(mockUpsertDeviceSensor).not.toHaveBeenCalled();
  });

  it("creates a new sensor using the explicit unit when given", async () => {
    const { ensureDiscoveredPushSensors } = await import("./pushSensorDiscovery");

    const result = await ensureDiscoveredPushSensors("device-1", [
      { key: "0", label: "Probe 0", kind: "temp" as never, unit: "C" },
    ]);

    expect(mockUpsertDeviceSensor).toHaveBeenCalledWith("device-1", "0", "Probe 0", "temp", "C");
    expect(mockDefaultUnitForKind).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 1, error: null });
  });

  it("falls back to defaultUnitForKind when no unit is given", async () => {
    const { ensureDiscoveredPushSensors } = await import("./pushSensorDiscovery");

    await ensureDiscoveredPushSensors("device-1", [
      { key: "0", label: "Probe 0", kind: "temp" as never },
    ]);

    expect(mockDefaultUnitForKind).toHaveBeenCalledWith("temp");
    expect(mockUpsertDeviceSensor).toHaveBeenCalledWith(
      "device-1",
      "0",
      "Probe 0",
      "temp",
      "default-unit",
    );
  });

  it("skips a sensor that already exists (matching key and kind)", async () => {
    const { ensureDiscoveredPushSensors } = await import("./pushSensorDiscovery");

    const result = await ensureDiscoveredPushSensors(
      "device-1",
      [{ key: "0", label: "Probe 0", kind: "temp" as never }],
      [sensor({ key: "0", kind: "temp" as never })],
    );

    expect(mockUpsertDeviceSensor).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 0, error: null });
  });

  it("stops and returns the error immediately when a create fails", async () => {
    mockUpsertDeviceSensor.mockResolvedValueOnce({ sensor: null, error: "insert failed" });
    const { ensureDiscoveredPushSensors } = await import("./pushSensorDiscovery");

    const result = await ensureDiscoveredPushSensors("device-1", [
      { key: "0", label: "Probe 0", kind: "temp" as never },
      { key: "1", label: "Probe 1", kind: "temp" as never },
    ]);

    expect(result).toEqual({ created: 0, error: "insert failed" });
    expect(mockUpsertDeviceSensor).toHaveBeenCalledTimes(1);
  });

  it("does not count a create that returns neither a sensor nor an error", async () => {
    mockUpsertDeviceSensor.mockResolvedValueOnce({ sensor: null, error: null });
    const { ensureDiscoveredPushSensors } = await import("./pushSensorDiscovery");

    const result = await ensureDiscoveredPushSensors("device-1", [
      { key: "0", label: "Probe 0", kind: "temp" as never },
    ]);

    expect(result).toEqual({ created: 0, error: null });
  });

  describe("withHumiditySibling", () => {
    const discovered: DiscoveredPushSensor[] = [
      { key: "0", label: "Probe 0", kind: "temp" as never, withHumiditySibling: true },
    ];

    it("creates both the temperature and humidity rows when neither exists", async () => {
      const { ensureDiscoveredPushSensors } = await import("./pushSensorDiscovery");

      const result = await ensureDiscoveredPushSensors("device-1", discovered);

      expect(mockUpsertDeviceSensor).toHaveBeenNthCalledWith(
        1,
        "device-1",
        "0",
        "Probe 0",
        "temperature",
        "F",
      );
      expect(mockUpsertDeviceSensor).toHaveBeenNthCalledWith(
        2,
        "device-1",
        "0",
        "Probe 0 humidity",
        "humidity",
        "%",
      );
      expect(result).toEqual({ created: 2, error: null });
    });

    it("only creates the humidity sibling when the temperature row already exists", async () => {
      const { ensureDiscoveredPushSensors } = await import("./pushSensorDiscovery");

      const result = await ensureDiscoveredPushSensors(
        "device-1",
        discovered,
        [sensor({ key: "0", kind: "temperature" })],
      );

      expect(mockUpsertDeviceSensor).toHaveBeenCalledTimes(1);
      expect(mockUpsertDeviceSensor).toHaveBeenCalledWith(
        "device-1",
        "0",
        "Probe 0 humidity",
        "humidity",
        "%",
      );
      expect(result).toEqual({ created: 1, error: null });
    });

    it("only creates the temperature row when the humidity sibling already exists", async () => {
      const { ensureDiscoveredPushSensors } = await import("./pushSensorDiscovery");

      const result = await ensureDiscoveredPushSensors(
        "device-1",
        discovered,
        [sensor({ key: "0", kind: "humidity" })],
      );

      expect(mockUpsertDeviceSensor).toHaveBeenCalledTimes(1);
      expect(mockUpsertDeviceSensor).toHaveBeenCalledWith(
        "device-1",
        "0",
        "Probe 0",
        "temperature",
        "F",
      );
      expect(result).toEqual({ created: 1, error: null });
    });

    it("stops without attempting the humidity sibling when the temperature create fails", async () => {
      mockUpsertDeviceSensor.mockResolvedValueOnce({ sensor: null, error: "temp failed" });
      const { ensureDiscoveredPushSensors } = await import("./pushSensorDiscovery");

      const result = await ensureDiscoveredPushSensors("device-1", discovered);

      expect(result).toEqual({ created: 0, error: "temp failed" });
      expect(mockUpsertDeviceSensor).toHaveBeenCalledTimes(1);
    });

    it("reports the temperature row as created even if the humidity create then fails", async () => {
      mockUpsertDeviceSensor
        .mockResolvedValueOnce({ sensor: sensor(), error: null })
        .mockResolvedValueOnce({ sensor: null, error: "humidity failed" });
      const { ensureDiscoveredPushSensors } = await import("./pushSensorDiscovery");

      const result = await ensureDiscoveredPushSensors("device-1", discovered);

      expect(result).toEqual({ created: 1, error: "humidity failed" });
    });
  });
});

describe("labelForPushSensorKey", () => {
  const discovered: DiscoveredPushSensor[] = [
    { key: "0", label: "Probe 0", kind: "temp" as never, withHumiditySibling: true },
    { key: "1", label: "Door", kind: "door" as never },
  ];

  it("returns a humidity-suffixed label for a humidity-sibling match", async () => {
    const { labelForPushSensorKey } = await import("./pushSensorDiscovery");

    expect(labelForPushSensorKey(discovered, "0", "humidity" as never)).toBe("Probe 0 humidity");
  });

  it("returns null for humidity when there is no sibling match", async () => {
    const { labelForPushSensorKey } = await import("./pushSensorDiscovery");

    expect(labelForPushSensorKey(discovered, "1", "humidity" as never)).toBeNull();
  });

  it("returns the label for a direct key+kind match", async () => {
    const { labelForPushSensorKey } = await import("./pushSensorDiscovery");

    expect(labelForPushSensorKey(discovered, "1", "door" as never)).toBe("Door");
  });

  it("returns null when there is no match at all", async () => {
    const { labelForPushSensorKey } = await import("./pushSensorDiscovery");

    expect(labelForPushSensorKey(discovered, "99", "door" as never)).toBeNull();
  });
});
