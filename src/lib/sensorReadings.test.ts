import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeviceSensor, DeviceWithSensors } from "./devices";
import type { TempFeedResult, TempProbeConfig } from "./tempFeedConfig";

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "gte", "not", "order", "limit", "insert"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  (builder as { then: unknown }).then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

const mockFrom = vi.fn();
vi.mock("./supabase", () => ({
  createServerClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}));

function sensor(overrides: Partial<DeviceSensor> = {}): DeviceSensor {
  return {
    id: "sensor-1",
    device_id: "device-1",
    key: "avg",
    label: "Garage",
    kind: "temperature",
    unit: "F",
    visible: true,
    sort_order: 0,
    offset_num: 0,
    ...overrides,
  };
}

function device(overrides: Partial<DeviceWithSensors> = {}): DeviceWithSensors {
  return {
    id: "device-1",
    household_id: "house-1",
    name: "Garage Feed",
    source: "pull",
    pull_url: null,
    ingest_key_prefix: null,
    enabled: true,
    last_seen_at: null,
    sort_order: 0,
    meta: {},
    space: null,
    sensors: [sensor()],
    ...overrides,
  } as unknown as DeviceWithSensors;
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe("insertSensorReadings", () => {
  it("returns no error for an empty list without hitting the database", async () => {
    const { insertSensorReadings } = await import("./sensorReadings");

    const result = await insertSensorReadings([]);

    expect(result).toEqual({ error: null });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("inserts rows, filling in defaults for optional fields", async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });
    const { insertSensorReadings } = await import("./sensorReadings");

    const result = await insertSensorReadings([
      { sensor_id: "s1", household_id: "h1", value_num: 40 },
    ]);

    expect(result).toEqual({ error: null });
    expect(mockFrom).toHaveBeenCalledWith("sensor_readings");
    const [rows] = mockInsert.mock.calls[0]!;
    expect(rows[0]).toMatchObject({
      sensor_id: "s1",
      household_id: "h1",
      value_num: 40,
      value_bool: null,
      value_text: null,
      meta: {},
    });
    expect(typeof rows[0].recorded_at).toBe("string");
  });

  it("returns the error message on failure", async () => {
    mockFrom.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: { message: "boom" } }) });
    const { insertSensorReadings } = await import("./sensorReadings");

    const result = await insertSensorReadings([{ sensor_id: "s1", household_id: "h1" }]);

    expect(result).toEqual({ error: "boom" });
  });
});

describe("buildReadingRowsFromTempResults", () => {
  const probe: TempProbeConfig = {
    id: "probe-1",
    feedId: "device-1",
    key: "avg",
    label: "Garage",
    visible: true,
  };

  const result: TempFeedResult = {
    id: "device-1",
    name: "Garage Feed",
    url: "https://example.com",
    probes: { avg: { c: 4.4, f: 40, h: 55 } },
  };

  it("builds temp and humidity rows for visible probes with matching sensors", async () => {
    const dev = device({
      sensors: [
        sensor({ id: "temp-sensor", kind: "temperature" }),
        sensor({ id: "humidity-sensor", kind: "humidity" }),
      ],
    });
    const { buildReadingRowsFromTempResults } = await import("./sensorReadings");

    const rows = buildReadingRowsFromTempResults("house-1", [dev], [result], [probe]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      sensor_id: "temp-sensor",
      household_id: "house-1",
      value_num: 40,
      meta: { tempc: 4.4, tempf: 40 },
    });
    expect(rows[1]).toMatchObject({
      sensor_id: "humidity-sensor",
      household_id: "house-1",
      value_num: 55,
      meta: { humidity: 55 },
    });
  });

  it("skips a probe marked not visible", async () => {
    const dev = device();
    const { buildReadingRowsFromTempResults } = await import("./sensorReadings");

    const rows = buildReadingRowsFromTempResults(
      "house-1",
      [dev],
      [result],
      [{ ...probe, visible: false }],
    );

    expect(rows).toEqual([]);
  });

  it("skips when the device or its feed result is missing", async () => {
    const { buildReadingRowsFromTempResults } = await import("./sensorReadings");

    expect(buildReadingRowsFromTempResults("house-1", [], [result], [probe])).toEqual([]);
    expect(buildReadingRowsFromTempResults("house-1", [device()], [], [probe])).toEqual([]);
  });

  it("skips a feed result that carries an error", async () => {
    const dev = device();
    const { buildReadingRowsFromTempResults } = await import("./sensorReadings");

    const rows = buildReadingRowsFromTempResults(
      "house-1",
      [dev],
      [{ ...result, error: "offline" }],
      [probe],
    );

    expect(rows).toEqual([]);
  });

  it("skips a probe whose key has no reading in the feed result", async () => {
    const dev = device();
    const { buildReadingRowsFromTempResults } = await import("./sensorReadings");

    const rows = buildReadingRowsFromTempResults(
      "house-1",
      [dev],
      [{ ...result, probes: {} }],
      [probe],
    );

    expect(rows).toEqual([]);
  });
});

describe("getRecentNumericReadings", () => {
  it("returns numeric values, filtering out non-numbers", async () => {
    mockFrom.mockReturnValue(
      mockQuery({ data: [{ value_num: 40 }, { value_num: null }, { value_num: 41 }] }),
    );
    const { getRecentNumericReadings } = await import("./sensorReadings");

    const result = await getRecentNumericReadings("sensor-1", "2024-01-01");

    expect(result).toEqual([40, 41]);
  });

  it("returns an empty array when there is no data", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null }));
    const { getRecentNumericReadings } = await import("./sensorReadings");

    expect(await getRecentNumericReadings("sensor-1", "2024-01-01")).toEqual([]);
  });
});

describe("getRecentNumericReadingSamples", () => {
  it("returns only rows with both a numeric value and a string timestamp", async () => {
    mockFrom.mockReturnValue(
      mockQuery({
        data: [
          { value_num: 40, recorded_at: "2024-01-01T00:00:00Z" },
          { value_num: null, recorded_at: "2024-01-01T01:00:00Z" },
          { value_num: 41, recorded_at: null },
        ],
      }),
    );
    const { getRecentNumericReadingSamples } = await import("./sensorReadings");

    const result = await getRecentNumericReadingSamples("sensor-1", "2024-01-01");

    expect(result).toEqual([{ at: "2024-01-01T00:00:00Z", tempF: 40 }]);
  });
});

describe("fetchRecentBoolReadings", () => {
  it("returns only rows with a boolean value", async () => {
    mockFrom.mockReturnValue(
      mockQuery({
        data: [
          { value_bool: true, recorded_at: "2024-01-01T00:00:00Z" },
          { value_bool: null, recorded_at: "2024-01-01T01:00:00Z" },
        ],
      }),
    );
    const { fetchRecentBoolReadings } = await import("./sensorReadings");

    const result = await fetchRecentBoolReadings("sensor-1", "2024-01-01");

    expect(result).toEqual([{ value: true, recordedAt: "2024-01-01T00:00:00Z" }]);
  });

  it("returns an empty array when there is no data", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null }));
    const { fetchRecentBoolReadings } = await import("./sensorReadings");

    expect(await fetchRecentBoolReadings("sensor-1", "2024-01-01")).toEqual([]);
  });
});

describe("fetchLatestSensorValues", () => {
  it("returns an empty array when the household has no devices", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [] }));
    const { fetchLatestSensorValues } = await import("./sensorReadings");

    expect(await fetchLatestSensorValues("house-1")).toEqual([]);
  });

  it("returns an empty array when there are no visible sensors", async () => {
    mockFrom
      .mockReturnValueOnce(mockQuery({ data: [{ id: "device-1", name: "Garage", space: null }] }))
      .mockReturnValueOnce(mockQuery({ data: [] }));
    const { fetchLatestSensorValues } = await import("./sensorReadings");

    expect(await fetchLatestSensorValues("house-1")).toEqual([]);
  });

  it("joins the latest reading per sensor and applies calibration offsets to numeric temp/humidity", async () => {
    mockFrom
      .mockReturnValueOnce(mockQuery({ data: [{ id: "device-1", name: "Garage", space: "Attached" }] }))
      .mockReturnValueOnce(
        mockQuery({
          data: [
            {
              id: "sensor-1",
              device_id: "device-1",
              key: "avg",
              label: "Garage",
              kind: "temperature",
              unit: "F",
              visible: true,
              sort_order: 0,
              offset_num: 2,
            },
          ],
        }),
      )
      .mockReturnValueOnce(
        mockQuery({
          data: {
            value_num: 40,
            value_bool: null,
            value_text: null,
            recorded_at: "2024-01-01T00:00:00Z",
          },
        }),
      );
    const { fetchLatestSensorValues } = await import("./sensorReadings");

    const result = await fetchLatestSensorValues("house-1");

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      deviceName: "Garage",
      deviceSpace: "Attached",
      value_num: 42,
      recorded_at: "2024-01-01T00:00:00Z",
    });
  });

  it("skips a sensor that has no reading yet", async () => {
    mockFrom
      .mockReturnValueOnce(mockQuery({ data: [{ id: "device-1", name: "Garage", space: null }] }))
      .mockReturnValueOnce(
        mockQuery({
          data: [
            {
              id: "sensor-1",
              device_id: "device-1",
              key: "avg",
              label: "Garage",
              kind: "temperature",
              unit: "F",
              visible: true,
              sort_order: 0,
              offset_num: 0,
            },
          ],
        }),
      )
      .mockReturnValueOnce(mockQuery({ data: null }));
    const { fetchLatestSensorValues } = await import("./sensorReadings");

    expect(await fetchLatestSensorValues("house-1")).toEqual([]);
  });
});
