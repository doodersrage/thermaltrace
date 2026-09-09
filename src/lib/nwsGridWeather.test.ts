import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetWeatherPresetCoords = vi.fn();
vi.mock("./weatherCityCoords", () => ({
  getWeatherPresetCoords: (...a: unknown[]) => mockGetWeatherPresetCoords(...a),
}));

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

function pointResponse(forecastUrl = "https://api.weather.gov/gridpoints/XYZ/1,2/forecast") {
  return jsonResponse({
    properties: { gridId: "XYZ", gridX: 1, gridY: 2, forecast: forecastUrl },
  });
}

function forecastResponse(
  periods: Array<{ temperature?: number; temperatureUnit?: string; shortForecast?: string }>,
) {
  return jsonResponse({ properties: { periods } });
}

beforeEach(() => {
  mockGetWeatherPresetCoords.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchNwsGridForecast", () => {
  it("returns null when the points lookup fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false, 503)));
    const { fetchNwsGridForecast } = await import("./nwsGridWeather");

    expect(await fetchNwsGridForecast(39.7, -104.9)).toBeNull();
  });

  it("returns null when the points response has no forecast url", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ properties: {} })));
    const { fetchNwsGridForecast } = await import("./nwsGridWeather");

    expect(await fetchNwsGridForecast(39.7, -104.9)).toBeNull();
  });

  it("returns null when the forecast fetch fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(pointResponse())
      .mockResolvedValueOnce(jsonResponse({}, false, 500));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchNwsGridForecast } = await import("./nwsGridWeather");

    expect(await fetchNwsGridForecast(39.7, -104.9)).toBeNull();
  });

  it("returns null when fetch throws (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const { fetchNwsGridForecast } = await import("./nwsGridWeather");

    expect(await fetchNwsGridForecast(39.7, -104.9)).toBeNull();
  });

  it("returns nulls for temps and shortForecast when there are no periods", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(pointResponse())
      .mockResolvedValueOnce(forecastResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchNwsGridForecast } = await import("./nwsGridWeather");

    const result = await fetchNwsGridForecast(39.7, -104.9);

    expect(result).toEqual({
      gridId: "XYZ",
      gridX: 1,
      gridY: 2,
      minTempF: null,
      maxTempF: null,
      shortForecast: null,
    });
  });

  it("computes min/max from the first 6 periods and converts Celsius to Fahrenheit", async () => {
    const periods = [
      { temperature: 40, temperatureUnit: "F", shortForecast: "Sunny" },
      { temperature: 0, temperatureUnit: "C", shortForecast: "Cloudy" }, // 32F
      { temperature: 60, temperatureUnit: "F" },
      { temperature: 45, temperatureUnit: "F" },
      { temperature: 45, temperatureUnit: "F" },
      { temperature: 45, temperatureUnit: "F" },
      // Beyond the first 6 periods; should be ignored.
      { temperature: -100, temperatureUnit: "F" },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(pointResponse())
      .mockResolvedValueOnce(forecastResponse(periods));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchNwsGridForecast } = await import("./nwsGridWeather");

    const result = await fetchNwsGridForecast(39.7, -104.9);

    expect(result?.minTempF).toBe(32);
    expect(result?.maxTempF).toBe(60);
    expect(result?.shortForecast).toBe("Sunny");
  });

  it("skips periods with a null/undefined temperature", async () => {
    const periods = [
      { temperature: undefined, temperatureUnit: "F", shortForecast: "Unknown" },
      { temperature: 50, temperatureUnit: "F" },
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(pointResponse())
      .mockResolvedValueOnce(forecastResponse(periods));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchNwsGridForecast } = await import("./nwsGridWeather");

    const result = await fetchNwsGridForecast(39.7, -104.9);

    expect(result?.minTempF).toBe(50);
    expect(result?.maxTempF).toBe(50);
  });

  it("defaults gridId/gridX/gridY when missing from the points response", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ properties: { forecast: "https://forecast.example" } }),
      )
      .mockResolvedValueOnce(forecastResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchNwsGridForecast } = await import("./nwsGridWeather");

    const result = await fetchNwsGridForecast(39.7, -104.9);

    expect(result).toEqual(
      expect.objectContaining({ gridId: "", gridX: 0, gridY: 0 }),
    );
  });
});

describe("fetchNwsGridForCity", () => {
  it("returns null without fetching when the city has no preset coords", async () => {
    mockGetWeatherPresetCoords.mockReturnValue(null);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { fetchNwsGridForCity } = await import("./nwsGridWeather");

    expect(await fetchNwsGridForCity("999")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the grid forecast for the preset coords", async () => {
    mockGetWeatherPresetCoords.mockReturnValue({ lat: 39.7, lon: -104.9 });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(pointResponse())
      .mockResolvedValueOnce(forecastResponse([]));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchNwsGridForCity } = await import("./nwsGridWeather");

    const result = await fetchNwsGridForCity("123");

    expect(result?.gridId).toBe("XYZ");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.weather.gov/points/39.7000,-104.9000",
      expect.anything(),
    );
  });
});
