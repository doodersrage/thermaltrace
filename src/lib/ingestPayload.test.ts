import { describe, expect, it } from "vitest";
import { inferSensorKind, parseIngestPayload } from "./ingestPayload";

describe("parseIngestPayload", () => {
  it("returns empty results for null/invalid payloads", () => {
    expect(parseIngestPayload(null)).toEqual({ tempProbes: {}, typed: [] });
    expect(parseIngestPayload(undefined)).toEqual({ tempProbes: {}, typed: [] });
    expect(parseIngestPayload("nope")).toEqual({ tempProbes: {}, typed: [] });
    expect(parseIngestPayload(42)).toEqual({ tempProbes: {}, typed: [] });
  });

  it("parses a temp object into probes", () => {
    const result = parseIngestPayload({
      temp: {
        bay: { c: 0, f: 32, h: 40 },
        loft: { c: 10, f: 50, h: 55 },
        skip: { c: "x", f: 1, h: 2 },
        bare: 12,
      },
    });
    expect(result.tempProbes).toEqual({
      bay: { c: 0, f: 32, h: 40 },
      loft: { c: 10, f: 50, h: 55 },
    });
    expect(result.typed).toEqual([]);
  });

  it("parses a sensors array with typed fields", () => {
    const result = parseIngestPayload({
      sensors: [
        {
          key: "door1",
          kind: "door",
          bool: true,
          label: "Front door",
          unit: "state",
        },
        { key: "rh", kind: "humidity", value: 48 },
        { key: "note", text: "ok" },
        { key: 123 },
        null,
        "skip",
      ],
    });
    expect(result.typed).toEqual([
      {
        key: "door1",
        kind: "door",
        value: null,
        bool: true,
        text: null,
        label: "Front door",
        unit: "state",
      },
      {
        key: "rh",
        kind: "humidity",
        value: 48,
        bool: null,
        text: null,
        label: undefined,
        unit: undefined,
      },
      {
        key: "note",
        kind: undefined,
        value: null,
        bool: null,
        text: "ok",
        label: undefined,
        unit: undefined,
      },
    ]);
  });

  it("ignores unknown sensor kinds on the sensors array", () => {
    const result = parseIngestPayload({
      sensors: [{ key: "x", kind: "smoke", value: 1 }],
    });
    expect(result.typed[0]?.kind).toBeUndefined();
  });

  it("infers flat numeric/boolean keys when temp and sensors are absent", () => {
    const result = parseIngestPayload({
      garage_temp: 41.2,
      humidity_bay: 62,
      door_open: true,
      flood_sensor: false,
      battery: 90,
      rssi: -70,
      meta: { device: "esp" },
    });
    expect(result.typed).toEqual([
      { key: "garage_temp", value: 41.2, kind: "temperature" },
      { key: "humidity_bay", value: 62, kind: "humidity" },
      { key: "door_open", bool: true, kind: "door" },
      { key: "flood_sensor", bool: false, kind: "flood" },
    ]);
  });

  it("skips flat-key parsing when temp or sensors are present", () => {
    expect(
      parseIngestPayload({
        temp: { bay: { c: 1, f: 33.8, h: 40 } },
        garage_temp: 99,
      }).typed,
    ).toEqual([]);
    expect(
      parseIngestPayload({
        sensors: [{ key: "door1", bool: true }],
        humidity_bay: 50,
      }).typed,
    ).toEqual([
      {
        key: "door1",
        kind: undefined,
        value: null,
        bool: true,
        text: null,
        label: undefined,
        unit: undefined,
      },
    ]);
  });

  it("returns empty results for an empty object", () => {
    expect(parseIngestPayload({})).toEqual({ tempProbes: {}, typed: [] });
  });
});

describe("inferSensorKind", () => {
  it("prefers an explicit kind", () => {
    expect(inferSensorKind("door", { key: "door", kind: "humidity", value: 1 })).toBe(
      "humidity",
    );
  });

  it("infers boolean door/flood/power/motion kinds", () => {
    expect(inferSensorKind("front_door", { key: "front_door", bool: true })).toBe("door");
    expect(inferSensorKind("leak_alarm", { key: "leak_alarm", bool: false })).toBe("flood");
    expect(inferSensorKind("relay_a", { key: "relay_a", bool: true })).toBe("power");
    expect(inferSensorKind("occupancy", { key: "occupancy", bool: true })).toBe("motion");
    expect(inferSensorKind("switch", { key: "switch", bool: true })).toBe("generic");
  });

  it("infers humidity and temperature from numeric keys", () => {
    expect(inferSensorKind("relative_humidity", { key: "relative_humidity", value: 40 })).toBe(
      "humidity",
    );
    expect(inferSensorKind("probe_temp", { key: "probe_temp", value: 32 })).toBe("temperature");
    expect(inferSensorKind("misc", { key: "misc", value: 1 })).toBe("generic");
  });
});
