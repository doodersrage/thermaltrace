import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchForecastMinTemp,
  fetchForecastMinTempByCoords,
  fetchNightsAtRisk,
  fetchWeather,
  fetchWeatherByCoords,
  fetchWeatherForecastByCoords,
  fetchWeatherForecastRaw,
  fetchWeatherSnapshot,
  getDefaultWeatherCityId,
  getOpenWeatherApiKey,
  minForecastTempInWindow,
  nightsAtRiskFromForecast,
  normalizeWeatherPayload,
  resolveWeatherCityId,
  weatherMapEmbedUrl,
  weatherMapExternalUrl,
} from "./FetchWeather";

type EnvRecord = Record<string, string | undefined>;
const env = import.meta.env as unknown as EnvRecord;
const savedEnv: EnvRecord = {};
function stubEnv(key: string, value: string | undefined) {
  if (!(key in savedEnv)) savedEnv[key] = env[key];
  if (value === undefined) {
    delete env[key];
  } else {
    env[key] = value;
  }
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(body) } as Response;
}

afterEach(() => {
  for (const key of Object.keys(savedEnv)) {
    const original = savedEnv[key];
    if (original === undefined) {
      delete env[key];
    } else {
      env[key] = original;
    }
    delete savedEnv[key];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("weatherMapEmbedUrl / weatherMapExternalUrl", () => {
  it("builds an embed url with a bounding box around the coords", () => {
    const url = weatherMapEmbedUrl(41.8, -87.6, 0.1);
    const west = -87.6 - 0.1;
    const south = 41.8 - 0.1;
    const east = -87.6 + 0.1;
    const north = 41.8 + 0.1;
    expect(url).toBe(
      `https://www.openstreetmap.org/export/embed.html?bbox=${west}%2C${south}%2C${east}%2C${north}&layer=mapnik&marker=41.8%2C-87.6`,
    );
  });

  it("builds an external map link centered on the coords", () => {
    expect(weatherMapExternalUrl(41.8, -87.6)).toBe(
      "https://www.openstreetmap.org/?mlat=41.8&mlon=-87.6#map=11/41.8/-87.6",
    );
  });
});

describe("getOpenWeatherApiKey / getDefaultWeatherCityId", () => {
  it("trims whitespace and stray carriage returns from the env values", () => {
    stubEnv("OPENWEATHER_API_KEY", "  key123\r\n  ");
    stubEnv("OPENWEATHER_CITY_ID", "  4887398\r\n  ");

    expect(getOpenWeatherApiKey()).toBe("key123");
    expect(getDefaultWeatherCityId()).toBe("4887398");
  });

  it("returns an empty string when unset", () => {
    stubEnv("OPENWEATHER_API_KEY", undefined);
    expect(getOpenWeatherApiKey()).toBe("");
  });
});

describe("resolveWeatherCityId", () => {
  it("uses a given numeric city id", () => {
    expect(resolveWeatherCityId("4887398")).toBe("4887398");
  });

  it("falls back to the default city id for a non-numeric value", () => {
    stubEnv("OPENWEATHER_CITY_ID", "1234");
    expect(resolveWeatherCityId("chicago")).toBe("1234");
  });

  it("falls back to the default city id when none is given", () => {
    stubEnv("OPENWEATHER_CITY_ID", "1234");
    expect(resolveWeatherCityId()).toBe("1234");
  });
});

describe("normalizeWeatherPayload", () => {
  it("returns null when temp is missing or non-numeric", () => {
    expect(normalizeWeatherPayload({})).toBeNull();
    expect(normalizeWeatherPayload({ main: { temp: "hot" } })).toBeNull();
  });

  it("normalizes a full payload", () => {
    const result = normalizeWeatherPayload({
      name: "Chicago",
      sys: { country: "US" },
      coord: { lat: 41.8, lon: -87.6 },
      main: { temp: 30, humidity: 55, feels_like: 25 },
      wind: { speed: 10, gust: 20 },
      clouds: { all: 40 },
      weather: [{ description: "clear sky" }],
    });

    expect(result).toEqual({
      name: "Chicago",
      country: "US",
      lat: 41.8,
      lon: -87.6,
      temp: 30,
      humidity: 55,
      feelsLike: 25,
      windSpeed: 10,
      windGust: 20,
      cloudCover: 40,
      description: "clear sky",
    });
  });

  it("fills in sensible defaults for missing optional fields", () => {
    const result = normalizeWeatherPayload({ main: { temp: 30 } });

    expect(result).toEqual({
      name: "Unknown",
      country: null,
      lat: null,
      lon: null,
      temp: 30,
      humidity: 0,
      feelsLike: 30,
      windSpeed: 0,
      windGust: null,
      cloudCover: 0,
      description: "—",
    });
  });
});

describe("fetchWeather", () => {
  it("returns null and logs when the api key is missing", async () => {
    stubEnv("OPENWEATHER_API_KEY", undefined);
    stubEnv("OPENWEATHER_CITY_ID", "1234");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await fetchWeather()).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith("OpenWeather API key is not configured");
  });

  it("returns null and logs when the city id is missing", async () => {
    stubEnv("OPENWEATHER_API_KEY", "key123");
    stubEnv("OPENWEATHER_CITY_ID", undefined);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await fetchWeather()).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith("OpenWeather city ID is not configured");
  });

  it("fetches and returns the raw json on success", async () => {
    stubEnv("OPENWEATHER_API_KEY", "key123");
    stubEnv("OPENWEATHER_CITY_ID", "1234");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ main: { temp: 30 } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchWeather();

    expect(result).toEqual({ main: { temp: 30 } });
    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toContain("id=1234");
    expect(url).toContain("appid=key123");
  });

  it("returns null and logs on a non-ok response", async () => {
    stubEnv("OPENWEATHER_API_KEY", "key123");
    stubEnv("OPENWEATHER_CITY_ID", "1234");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(null, false, 500)));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await fetchWeather()).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith("Weather request failed (500)");
  });

  it("returns null and logs when fetch throws", async () => {
    stubEnv("OPENWEATHER_API_KEY", "key123");
    stubEnv("OPENWEATHER_CITY_ID", "1234");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await fetchWeather()).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith("Weather fetch error:", expect.any(Error));
  });
});

describe("fetchWeatherSnapshot", () => {
  it("returns null when the underlying fetch fails", async () => {
    stubEnv("OPENWEATHER_API_KEY", undefined);
    stubEnv("OPENWEATHER_CITY_ID", "1234");
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await fetchWeatherSnapshot()).toBeNull();
  });

  it("fetches and normalizes the payload on success", async () => {
    stubEnv("OPENWEATHER_API_KEY", "key123");
    stubEnv("OPENWEATHER_CITY_ID", "1234");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ name: "Chicago", main: { temp: 30 } })),
    );

    const result = await fetchWeatherSnapshot();

    expect(result?.name).toBe("Chicago");
    expect(result?.temp).toBe(30);
  });
});

describe("fetchWeatherForecastRaw", () => {
  it("returns null when unconfigured", async () => {
    stubEnv("OPENWEATHER_API_KEY", undefined);

    expect(await fetchWeatherForecastRaw()).toBeNull();
  });

  it("fetches the forecast endpoint on success", async () => {
    stubEnv("OPENWEATHER_API_KEY", "key123");
    stubEnv("OPENWEATHER_CITY_ID", "1234");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ list: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchWeatherForecastRaw();

    expect(result).toEqual({ list: [] });
    expect(fetchMock.mock.calls[0]![0]).toContain("/forecast?id=1234");
  });

  it("returns null and logs on a non-ok response", async () => {
    stubEnv("OPENWEATHER_API_KEY", "key123");
    stubEnv("OPENWEATHER_CITY_ID", "1234");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(null, false, 502)));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await fetchWeatherForecastRaw()).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith("Forecast request failed (502)");
  });

  it("returns null and logs when fetch throws", async () => {
    stubEnv("OPENWEATHER_API_KEY", "key123");
    stubEnv("OPENWEATHER_CITY_ID", "1234");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await fetchWeatherForecastRaw()).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith("Forecast fetch error:", expect.any(Error));
  });
});

describe("minForecastTempInWindow", () => {
  const now = Date.parse("2024-01-01T00:00:00Z");

  it("returns null for a missing or empty list", () => {
    expect(minForecastTempInWindow(null, 24, now)).toBeNull();
    expect(minForecastTempInWindow({ list: [] }, 24, now)).toBeNull();
  });

  it("finds the minimum temp within the window and ignores entries outside it", () => {
    const raw = {
      city: { name: "Chicago" },
      list: [
        { dt: now / 1000 - 3600, main: { temp: 100 } }, // before now, excluded
        { dt: now / 1000 + 3600, main: { temp: 20 } },
        { dt: now / 1000 + 7200, main: { temp: 10 } },
        { dt: now / 1000 + 100 * 3600, main: { temp: -50 } }, // beyond window
      ],
    };

    const result = minForecastTempInWindow(raw, 24, now);

    expect(result).toEqual({ minTempF: 10, cityName: "Chicago", hoursAhead: 24 });
  });

  it("returns null when no entries fall within the window", () => {
    const raw = { list: [{ dt: now / 1000 + 1000 * 3600, main: { temp: 10 } }] };

    expect(minForecastTempInWindow(raw, 24, now)).toBeNull();
  });

  it("clamps hoursAhead to at least 1 hour", () => {
    const raw = { list: [{ dt: now / 1000 + 1800, main: { temp: 15 } }] };

    const result = minForecastTempInWindow(raw, 0, now);

    expect(result?.minTempF).toBe(15);
  });
});

describe("fetchForecastMinTemp / fetchForecastMinTempByCoords", () => {
  it("fetches the forecast and reduces it to the min temp window", async () => {
    stubEnv("OPENWEATHER_API_KEY", "key123");
    stubEnv("OPENWEATHER_CITY_ID", "1234");
    const now = Date.now();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({ list: [{ dt: (now + 3600_000) / 1000, main: { temp: 22 } }] }),
      ),
    );

    const result = await fetchForecastMinTemp(undefined, 24);

    expect(result?.minTempF).toBe(22);
  });

  it("uses the coords-based forecast fetch", async () => {
    stubEnv("OPENWEATHER_API_KEY", "key123");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ list: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchForecastMinTempByCoords(41.8, -87.6, 24);

    expect(fetchMock.mock.calls[0]![0]).toContain("lat=41.8&lon=-87.6");
  });
});

describe("fetchWeatherByCoords / fetchWeatherForecastByCoords", () => {
  it("returns null when the api key is missing", async () => {
    stubEnv("OPENWEATHER_API_KEY", undefined);

    expect(await fetchWeatherByCoords(41.8, -87.6)).toBeNull();
    expect(await fetchWeatherForecastByCoords(41.8, -87.6)).toBeNull();
  });

  it("returns null for non-finite coordinates", async () => {
    stubEnv("OPENWEATHER_API_KEY", "key123");

    expect(await fetchWeatherByCoords(Number.NaN, -87.6)).toBeNull();
  });

  it("fetches by coords on success", async () => {
    stubEnv("OPENWEATHER_API_KEY", "key123");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ main: { temp: 40 } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchWeatherByCoords(41.8, -87.6);

    expect(result).toEqual({ main: { temp: 40 } });
    expect(fetchMock.mock.calls[0]![0]).toContain("lat=41.8&lon=-87.6");
  });

  it("returns null on a non-ok response or thrown fetch (silent, no console call)", async () => {
    stubEnv("OPENWEATHER_API_KEY", "key123");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(null, false)));
    expect(await fetchWeatherByCoords(41.8, -87.6)).toBeNull();

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    expect(await fetchWeatherForecastByCoords(41.8, -87.6)).toBeNull();
  });
});

describe("nightsAtRiskFromForecast", () => {
  it("returns an empty array for a missing list", () => {
    expect(nightsAtRiskFromForecast(null, 32)).toEqual([]);
  });

  it("groups overnight-ish (<=12 UTC hour) entries by day and takes the min per day", () => {
    const raw = {
      list: [
        { dt: Date.parse("2024-01-01T06:00:00Z") / 1000, main: { temp: 20 } },
        { dt: Date.parse("2024-01-01T09:00:00Z") / 1000, main: { temp: 15 } },
        { dt: Date.parse("2024-01-01T18:00:00Z") / 1000, main: { temp: 50 } }, // afternoon, excluded
        { dt: Date.parse("2024-01-02T03:00:00Z") / 1000, main: { temp: 40 } },
      ],
    };

    const result = nightsAtRiskFromForecast(raw, 32, 5);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ minTempF: 15, atRisk: true });
    expect(result[1]).toMatchObject({ minTempF: 40, atRisk: false });
  });

  it("caps the result at the requested number of nights", () => {
    const raw = {
      list: [
        { dt: Date.parse("2024-01-01T06:00:00Z") / 1000, main: { temp: 20 } },
        { dt: Date.parse("2024-01-02T06:00:00Z") / 1000, main: { temp: 20 } },
        { dt: Date.parse("2024-01-03T06:00:00Z") / 1000, main: { temp: 20 } },
      ],
    };

    expect(nightsAtRiskFromForecast(raw, 32, 2)).toHaveLength(2);
  });
});

describe("fetchNightsAtRisk", () => {
  it("uses the coords-based forecast when lat/lon are given", async () => {
    stubEnv("OPENWEATHER_API_KEY", "key123");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ list: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchNightsAtRisk({ lat: 41.8, lon: -87.6, freezeThresholdF: 32 });

    expect(fetchMock.mock.calls[0]![0]).toContain("lat=41.8&lon=-87.6");
  });

  it("falls back to the cityId-based forecast when no coords are given", async () => {
    stubEnv("OPENWEATHER_API_KEY", "key123");
    stubEnv("OPENWEATHER_CITY_ID", "1234");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ list: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchNightsAtRisk({ cityId: "chicago-ignored-non-numeric", freezeThresholdF: 32 });

    expect(fetchMock.mock.calls[0]![0]).toContain("id=1234");
  });
});
