import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonalWeatherConfig } from "./personalWeatherStations";

const mockFetchForecastMinTemp = vi.fn();
const mockFetchForecastMinTempByCoords = vi.fn();
const mockFetchNightsAtRisk = vi.fn();
const mockFetchWeatherSnapshot = vi.fn();
const mockResolveWeatherCityId = vi.fn();
vi.mock("./FetchWeather", () => ({
  fetchForecastMinTemp: (...a: unknown[]) => mockFetchForecastMinTemp(...a),
  fetchForecastMinTempByCoords: (...a: unknown[]) => mockFetchForecastMinTempByCoords(...a),
  fetchNightsAtRisk: (...a: unknown[]) => mockFetchNightsAtRisk(...a),
  fetchWeatherSnapshot: (...a: unknown[]) => mockFetchWeatherSnapshot(...a),
  resolveWeatherCityId: (...a: unknown[]) => mockResolveWeatherCityId(...a),
}));

const mockFetchAmbientWeatherSnapshot = vi.fn();
const mockFetchWeatherFlowSnapshot = vi.fn();
vi.mock("./personalWeatherStations", () => ({
  fetchAmbientWeatherSnapshot: (...a: unknown[]) => mockFetchAmbientWeatherSnapshot(...a),
  fetchWeatherFlowSnapshot: (...a: unknown[]) => mockFetchWeatherFlowSnapshot(...a),
}));

const mockPersonalWeatherConfigFromPreferences = vi.fn();
const mockGetDisplayPreferencesFromMetadata = vi.fn();
vi.mock("./userPreferences", () => ({
  personalWeatherConfigFromPreferences: (...a: unknown[]) =>
    mockPersonalWeatherConfigFromPreferences(...a),
  getDisplayPreferencesFromMetadata: (...a: unknown[]) =>
    mockGetDisplayPreferencesFromMetadata(...a),
}));

function config(overrides: Partial<PersonalWeatherConfig> = {}): PersonalWeatherConfig {
  return {
    source: "openweather",
    openWeatherCityId: "123",
    ambientMac: null,
    ambientApiKey: null,
    weatherflowStationId: null,
    weatherflowToken: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockFetchForecastMinTemp.mockReset().mockResolvedValue(null);
  mockFetchForecastMinTempByCoords.mockReset().mockResolvedValue(null);
  mockFetchNightsAtRisk.mockReset().mockResolvedValue([]);
  mockFetchWeatherSnapshot.mockReset().mockResolvedValue(null);
  mockResolveWeatherCityId.mockReset().mockReturnValue("resolved-city");
  mockFetchAmbientWeatherSnapshot.mockReset().mockResolvedValue(null);
  mockFetchWeatherFlowSnapshot.mockReset().mockResolvedValue(null);
  mockPersonalWeatherConfigFromPreferences.mockReset().mockReturnValue(config());
  mockGetDisplayPreferencesFromMetadata.mockReset().mockReturnValue({});
});

describe("getPersonalWeatherConfig", () => {
  it("derives the config from the user's display preferences", async () => {
    const user = { id: "user-1" } as never;
    const prefs = { weatherCityId: "5" };
    mockGetDisplayPreferencesFromMetadata.mockReturnValue(prefs);
    const cfg = config({ openWeatherCityId: "5" });
    mockPersonalWeatherConfigFromPreferences.mockReturnValue(cfg);
    const { getPersonalWeatherConfig } = await import("./weatherContext");

    const result = getPersonalWeatherConfig(user);

    expect(mockGetDisplayPreferencesFromMetadata).toHaveBeenCalledWith(user);
    expect(mockPersonalWeatherConfigFromPreferences).toHaveBeenCalledWith(prefs);
    expect(result).toBe(cfg);
  });
});

describe("fetchWeatherSnapshotForConfig", () => {
  it("uses the ambient station when configured and it returns a snapshot", async () => {
    mockFetchAmbientWeatherSnapshot.mockResolvedValue({ tempF: 40, lat: 1, lon: 2 });
    const { fetchWeatherSnapshotForConfig } = await import("./weatherContext");

    const result = await fetchWeatherSnapshotForConfig(
      config({ source: "ambient", ambientMac: "aa:bb:cc:dd:ee:ff", ambientApiKey: "key" }),
    );

    expect(mockFetchAmbientWeatherSnapshot).toHaveBeenCalledWith("aa:bb:cc:dd:ee:ff", "key");
    expect(result).toEqual({ tempF: 40, lat: 1, lon: 2 });
    expect(mockFetchWeatherSnapshot).not.toHaveBeenCalled();
  });

  it("falls through to openweather when the ambient snapshot is falsy", async () => {
    mockFetchAmbientWeatherSnapshot.mockResolvedValue(null);
    mockFetchWeatherSnapshot.mockResolvedValue({ tempF: 50 });
    const { fetchWeatherSnapshotForConfig } = await import("./weatherContext");

    const result = await fetchWeatherSnapshotForConfig(
      config({ source: "ambient", ambientMac: "aa:bb:cc:dd:ee:ff", ambientApiKey: "key" }),
    );

    expect(result).toEqual({ tempF: 50, source: "openweather" });
  });

  it("skips the ambient call entirely when mac or apiKey is missing", async () => {
    mockFetchWeatherSnapshot.mockResolvedValue({ tempF: 50 });
    const { fetchWeatherSnapshotForConfig } = await import("./weatherContext");

    await fetchWeatherSnapshotForConfig(config({ source: "ambient", ambientMac: "aa:bb:cc:dd:ee:ff" }));

    expect(mockFetchAmbientWeatherSnapshot).not.toHaveBeenCalled();
  });

  it("uses the weatherflow station when configured and it returns a snapshot", async () => {
    mockFetchWeatherFlowSnapshot.mockResolvedValue({ tempF: 45, lat: 3, lon: 4 });
    const { fetchWeatherSnapshotForConfig } = await import("./weatherContext");

    const result = await fetchWeatherSnapshotForConfig(
      config({ source: "weatherflow", weatherflowStationId: "st1", weatherflowToken: "tok" }),
    );

    expect(mockFetchWeatherFlowSnapshot).toHaveBeenCalledWith("st1", "tok");
    expect(result).toEqual({ tempF: 45, lat: 3, lon: 4 });
  });

  it("falls through to openweather when the weatherflow snapshot is falsy", async () => {
    mockFetchWeatherFlowSnapshot.mockResolvedValue(null);
    mockFetchWeatherSnapshot.mockResolvedValue({ tempF: 55 });
    const { fetchWeatherSnapshotForConfig } = await import("./weatherContext");

    const result = await fetchWeatherSnapshotForConfig(
      config({ source: "weatherflow", weatherflowStationId: "st1", weatherflowToken: "tok" }),
    );

    expect(result).toEqual({ tempF: 55, source: "openweather" });
  });

  it("resolves the city id and fetches from openweather by default", async () => {
    mockResolveWeatherCityId.mockReturnValue("resolved-city");
    mockFetchWeatherSnapshot.mockResolvedValue({ tempF: 60 });
    const { fetchWeatherSnapshotForConfig } = await import("./weatherContext");

    const result = await fetchWeatherSnapshotForConfig(config({ openWeatherCityId: "9" }));

    expect(mockResolveWeatherCityId).toHaveBeenCalledWith("9");
    expect(mockFetchWeatherSnapshot).toHaveBeenCalledWith("resolved-city");
    expect(result).toEqual({ tempF: 60, source: "openweather" });
  });

  it("returns null when the openweather fetch also fails", async () => {
    mockFetchWeatherSnapshot.mockResolvedValue(null);
    const { fetchWeatherSnapshotForConfig } = await import("./weatherContext");

    expect(await fetchWeatherSnapshotForConfig(config())).toBeNull();
  });
});

describe("fetchWeatherForUser", () => {
  it("builds the config from the user and fetches its snapshot", async () => {
    mockGetDisplayPreferencesFromMetadata.mockReturnValue({});
    mockPersonalWeatherConfigFromPreferences.mockReturnValue(config({ openWeatherCityId: "9" }));
    mockFetchWeatherSnapshot.mockResolvedValue({ tempF: 60 });
    const { fetchWeatherForUser } = await import("./weatherContext");

    const result = await fetchWeatherForUser({ id: "user-1" } as never);

    expect(result).toEqual({ tempF: 60, source: "openweather" });
  });
});

describe("fetchForecastMinTempForConfig", () => {
  it("uses forecast-by-coords when the snapshot has lat/lon and it succeeds", async () => {
    mockFetchWeatherSnapshot.mockResolvedValue({ tempF: 40, lat: 1, lon: 2 });
    mockFetchForecastMinTempByCoords.mockResolvedValue({ minTempF: 20 });
    const { fetchForecastMinTempForConfig } = await import("./weatherContext");

    const result = await fetchForecastMinTempForConfig(config(), 12);

    expect(mockFetchForecastMinTempByCoords).toHaveBeenCalledWith(1, 2, 12);
    expect(result).toEqual({ minTempF: 20 });
    expect(mockFetchForecastMinTemp).not.toHaveBeenCalled();
  });

  it("defaults hoursAhead to 24", async () => {
    mockFetchWeatherSnapshot.mockResolvedValue(null);
    const { fetchForecastMinTempForConfig } = await import("./weatherContext");

    await fetchForecastMinTempForConfig(config());

    expect(mockFetchForecastMinTemp).toHaveBeenCalledWith("resolved-city", 24);
  });

  it("falls back to fetchForecastMinTemp by city id when there is no usable snapshot", async () => {
    mockFetchWeatherSnapshot.mockResolvedValue(null);
    mockFetchForecastMinTemp.mockResolvedValue({ minTempF: 15 });
    const { fetchForecastMinTempForConfig } = await import("./weatherContext");

    const result = await fetchForecastMinTempForConfig(config({ openWeatherCityId: "9" }), 6);

    expect(mockResolveWeatherCityId).toHaveBeenCalledWith("9");
    expect(mockFetchForecastMinTemp).toHaveBeenCalledWith("resolved-city", 6);
    expect(result).toEqual({ minTempF: 15 });
  });

  it("falls back to city id when forecast-by-coords returns falsy despite lat/lon", async () => {
    mockFetchWeatherSnapshot.mockResolvedValue({ tempF: 40, lat: 1, lon: 2 });
    mockFetchForecastMinTempByCoords.mockResolvedValue(null);
    mockFetchForecastMinTemp.mockResolvedValue({ minTempF: 18 });
    const { fetchForecastMinTempForConfig } = await import("./weatherContext");

    const result = await fetchForecastMinTempForConfig(config(), 6);

    expect(result).toEqual({ minTempF: 18 });
  });
});

describe("fetchNightsAtRiskForConfig", () => {
  it("uses an explicitly passed snapshot instead of fetching one", async () => {
    const { fetchNightsAtRiskForConfig } = await import("./weatherContext");

    await fetchNightsAtRiskForConfig(config(), 32, { tempF: 40, lat: 1, lon: 2 } as never);

    expect(mockFetchWeatherSnapshot).not.toHaveBeenCalled();
    expect(mockFetchAmbientWeatherSnapshot).not.toHaveBeenCalled();
    expect(mockFetchNightsAtRisk).toHaveBeenCalledWith({ lat: 1, lon: 2, freezeThresholdF: 32 });
  });

  it("treats an explicit null snapshot as 'no snapshot' without re-fetching", async () => {
    const { fetchNightsAtRiskForConfig } = await import("./weatherContext");

    await fetchNightsAtRiskForConfig(config({ openWeatherCityId: "9" }), 32, null);

    expect(mockFetchWeatherSnapshot).not.toHaveBeenCalled();
    expect(mockFetchNightsAtRisk).toHaveBeenCalledWith({
      cityId: "resolved-city",
      freezeThresholdF: 32,
    });
  });

  it("fetches a snapshot when none is passed, and uses lat/lon when available", async () => {
    mockFetchWeatherSnapshot.mockResolvedValue({ tempF: 40, lat: 5, lon: 6 });
    const { fetchNightsAtRiskForConfig } = await import("./weatherContext");

    await fetchNightsAtRiskForConfig(config(), 30);

    expect(mockFetchWeatherSnapshot).toHaveBeenCalled();
    expect(mockFetchNightsAtRisk).toHaveBeenCalledWith({ lat: 5, lon: 6, freezeThresholdF: 30 });
  });

  it("falls back to cityId when the fetched snapshot has no lat/lon", async () => {
    mockFetchWeatherSnapshot.mockResolvedValue({ tempF: 40 });
    const { fetchNightsAtRiskForConfig } = await import("./weatherContext");

    await fetchNightsAtRiskForConfig(config({ openWeatherCityId: "9" }), 30);

    expect(mockFetchNightsAtRisk).toHaveBeenCalledWith({
      cityId: "resolved-city",
      freezeThresholdF: 30,
    });
  });
});
