import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertSettings } from "./alerts";
import type { LatestSensorRow } from "./sensorReadings";

const mockGetRecentNumericReadingSamples = vi.fn();
vi.mock("./sensorReadings", () => ({
  getRecentNumericReadingSamples: (...a: unknown[]) => mockGetRecentNumericReadingSamples(...a),
}));

const mockFetchForecastMinTemp = vi.fn();
vi.mock("./FetchWeather", () => ({
  fetchForecastMinTemp: (...a: unknown[]) => mockFetchForecastMinTemp(...a),
}));

const mockBuildThermalRunway = vi.fn();
const mockFormatRunwayAlertSuffix = vi.fn();
vi.mock("./thermalRunway", () => ({
  buildThermalRunway: (...a: unknown[]) => mockBuildThermalRunway(...a),
  formatRunwayAlertSuffix: (...a: unknown[]) => mockFormatRunwayAlertSuffix(...a),
}));

const mockFetchRegionalBenchmark = vi.fn();
const mockFormatBenchmarkAlertSuffix = vi.fn();
vi.mock("./regionalBenchmark", () => ({
  fetchRegionalBenchmark: (...a: unknown[]) => mockFetchRegionalBenchmark(...a),
  formatBenchmarkAlertSuffix: (...a: unknown[]) => mockFormatBenchmarkAlertSuffix(...a),
}));

const mockFetchThermostatAnnotationForHousehold = vi.fn();
vi.mock("./thermostatCorrelation", () => ({
  fetchThermostatAnnotationForHousehold: (...a: unknown[]) =>
    mockFetchThermostatAnnotationForHousehold(...a),
}));

function settings(overrides: Partial<AlertSettings> = {}): AlertSettings {
  return {
    freezeThresholdF: 35,
    forecastHoursAhead: 24,
    ...overrides,
  } as unknown as AlertSettings;
}

function sensorRow(overrides: Partial<LatestSensorRow> = {}): LatestSensorRow {
  return {
    sensor: { kind: "door" } as never,
    deviceName: "Garage",
    value_num: null,
    value_bool: null,
    value_text: null,
    recorded_at: "2024-06-15T12:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  mockGetRecentNumericReadingSamples.mockReset().mockResolvedValue([]);
  mockFetchForecastMinTemp.mockReset().mockResolvedValue(null);
  mockBuildThermalRunway.mockReset().mockReturnValue({ hours: null, rateFPerHour: null, message: "", annotations: [] });
  mockFormatRunwayAlertSuffix.mockReset().mockReturnValue(null);
  mockFetchRegionalBenchmark.mockReset().mockResolvedValue(null);
  mockFormatBenchmarkAlertSuffix.mockReset().mockReturnValue(null);
  mockFetchThermostatAnnotationForHousehold.mockReset().mockResolvedValue(null);
});

describe("buildFreezeAlertContext", () => {
  it("returns null when there is nothing to say", async () => {
    const { buildFreezeAlertContext } = await import("./alertContext");

    const result = await buildFreezeAlertContext({
      settings: settings(),
      coldestTempF: 30,
    });

    expect(result).toBeNull();
  });

  it("includes the thermostat annotation when present", async () => {
    mockFetchThermostatAnnotationForHousehold.mockResolvedValue("Thermostat set to 65F.");
    const { buildFreezeAlertContext } = await import("./alertContext");

    const result = await buildFreezeAlertContext({
      householdId: "house-1",
      settings: settings(),
      coldestTempF: 30,
    });

    expect(result).toContain("Thermostat set to 65F.");
  });

  it("swallows a thrown annotation lookup instead of propagating", async () => {
    mockFetchThermostatAnnotationForHousehold.mockRejectedValue(new Error("boom"));
    const { buildFreezeAlertContext } = await import("./alertContext");

    await expect(
      buildFreezeAlertContext({ householdId: "house-1", settings: settings(), coldestTempF: 30 }),
    ).resolves.not.toThrow();
  });

  it("fetches the regional benchmark only with a householdId and a finite coldestTempF", async () => {
    const { buildFreezeAlertContext } = await import("./alertContext");

    await buildFreezeAlertContext({ settings: settings(), coldestTempF: 30 });
    expect(mockFetchRegionalBenchmark).not.toHaveBeenCalled();

    await buildFreezeAlertContext({ householdId: "house-1", settings: settings(), coldestTempF: NaN });
    expect(mockFetchRegionalBenchmark).not.toHaveBeenCalled();

    await buildFreezeAlertContext({ householdId: "house-1", settings: settings(), coldestTempF: 30 });
    expect(mockFetchRegionalBenchmark).toHaveBeenCalledWith({ householdId: "house-1", yourTempF: 30 });
  });

  it("includes the benchmark line when formatBenchmarkAlertSuffix returns one", async () => {
    mockFetchRegionalBenchmark.mockResolvedValue({ cityLabel: "Denver" });
    mockFormatBenchmarkAlertSuffix.mockReturnValue("5F colder than typical.");
    const { buildFreezeAlertContext } = await import("./alertContext");

    const result = await buildFreezeAlertContext({
      householdId: "house-1",
      settings: settings(),
      coldestTempF: 30,
    });

    expect(result).toContain("5F colder than typical.");
  });

  it("swallows a thrown benchmark lookup, passing null to the formatter", async () => {
    mockFetchRegionalBenchmark.mockRejectedValue(new Error("boom"));
    const { buildFreezeAlertContext } = await import("./alertContext");

    await buildFreezeAlertContext({ householdId: "house-1", settings: settings(), coldestTempF: 30 });

    expect(mockFormatBenchmarkAlertSuffix).toHaveBeenCalledWith(null);
  });

  it("detects an open door sensor via value_bool or value_text", async () => {
    const { buildFreezeAlertContext } = await import("./alertContext");

    const withBool = await buildFreezeAlertContext({
      settings: settings(),
      coldestTempF: 30,
      latestSensors: [sensorRow({ value_bool: true })],
    });
    expect(withBool).toContain("A door sensor is open");

    const withText = await buildFreezeAlertContext({
      settings: settings(),
      coldestTempF: 30,
      latestSensors: [sensorRow({ value_text: "open" })],
    });
    expect(withText).toContain("A door sensor is open");
  });

  it("does not treat a non-door sensor or a closed door as open", async () => {
    const { buildFreezeAlertContext } = await import("./alertContext");

    const notDoor = await buildFreezeAlertContext({
      settings: settings(),
      coldestTempF: 30,
      latestSensors: [sensorRow({ sensor: { kind: "temperature" } as never, value_bool: true })],
    });
    expect(notDoor).toBeNull();

    const closed = await buildFreezeAlertContext({
      settings: settings(),
      coldestTempF: 30,
      latestSensors: [sensorRow({ value_bool: false, value_text: "closed" })],
    });
    expect(closed).toBeNull();
  });

  it("builds a thermal runway when coldestSensorId is given, using recent samples and the forecast", async () => {
    mockGetRecentNumericReadingSamples.mockResolvedValue([{ at: "t", tempF: 30 }]);
    mockFetchForecastMinTemp.mockResolvedValue({ minTempF: 20 });
    mockFormatRunwayAlertSuffix.mockReturnValue("Cooling fast.");
    const { buildFreezeAlertContext } = await import("./alertContext");

    const result = await buildFreezeAlertContext({
      settings: settings({ forecastHoursAhead: 12 }),
      coldestTempF: 30,
      coldestSensorId: "sensor-1",
      weatherCityId: "123",
    });

    expect(mockGetRecentNumericReadingSamples).toHaveBeenCalledWith("sensor-1", expect.any(String));
    expect(mockFetchForecastMinTemp).toHaveBeenCalledWith("123", 12);
    expect(mockBuildThermalRunway).toHaveBeenCalledWith({
      currentTempF: 30,
      freezeThresholdF: 35,
      recentSamples: [{ at: "t", tempF: 30 }],
      forecastMinTempF: 20,
      forecastHoursAhead: 12,
      doorOpenNearby: false,
    });
    expect(result).toContain("Cooling fast.");
  });

  it("skips the forecast fetch when there is no weatherCityId", async () => {
    const { buildFreezeAlertContext } = await import("./alertContext");

    await buildFreezeAlertContext({
      settings: settings(),
      coldestTempF: 30,
      coldestSensorId: "sensor-1",
    });

    expect(mockFetchForecastMinTemp).not.toHaveBeenCalled();
    expect(mockBuildThermalRunway).toHaveBeenCalledWith(
      expect.objectContaining({ forecastMinTempF: null }),
    );
  });

  it("swallows a thrown samples or forecast lookup", async () => {
    mockGetRecentNumericReadingSamples.mockRejectedValue(new Error("boom"));
    mockFetchForecastMinTemp.mockRejectedValue(new Error("boom"));
    const { buildFreezeAlertContext } = await import("./alertContext");

    await buildFreezeAlertContext({
      settings: settings(),
      coldestTempF: 30,
      coldestSensorId: "sensor-1",
      weatherCityId: "123",
    });

    expect(mockBuildThermalRunway).toHaveBeenCalledWith(
      expect.objectContaining({ recentSamples: [], forecastMinTempF: null }),
    );
  });

  it("falls back to the door-open line when there is no coldestSensorId", async () => {
    const { buildFreezeAlertContext } = await import("./alertContext");

    const result = await buildFreezeAlertContext({
      settings: settings(),
      coldestTempF: 30,
      latestSensors: [sensorRow({ value_bool: true })],
    });

    expect(result).toBe("A door sensor is open. Expect faster heat loss until it closes.");
    expect(mockBuildThermalRunway).not.toHaveBeenCalled();
  });

  it("joins multiple parts with a blank line", async () => {
    mockFetchThermostatAnnotationForHousehold.mockResolvedValue("Thermostat note.");
    mockFetchRegionalBenchmark.mockResolvedValue({});
    mockFormatBenchmarkAlertSuffix.mockReturnValue("Benchmark note.");
    const { buildFreezeAlertContext } = await import("./alertContext");

    const result = await buildFreezeAlertContext({
      householdId: "house-1",
      settings: settings(),
      coldestTempF: 30,
      latestSensors: [sensorRow({ value_bool: true })],
    });

    expect(result).toBe("Thermostat note.\n\nBenchmark note.\n\nA door sensor is open. Expect faster heat loss until it closes.");
  });
});
