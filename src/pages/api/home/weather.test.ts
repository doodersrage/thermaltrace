import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockFetchWeatherSnapshot = vi.fn();
const mockResolveWeatherCityId = vi.fn();
vi.mock("../../../lib/FetchWeather", () => ({
  fetchWeatherSnapshot: (...a: unknown[]) => mockFetchWeatherSnapshot(...a),
  resolveWeatherCityId: (...a: unknown[]) => mockResolveWeatherCityId(...a),
}));

const mockCheckWeatherSearchRateLimit = vi.fn();
vi.mock("../../../lib/weatherSearchLimits", () => ({
  checkWeatherSearchRateLimit: (...a: unknown[]) =>
    mockCheckWeatherSearchRateLimit(...a),
}));

const mockFetchWeatherSnapshotForConfig = vi.fn();
const mockGetPersonalWeatherConfig = vi.fn();
vi.mock("../../../lib/weatherContext", () => ({
  fetchWeatherSnapshotForConfig: (...a: unknown[]) =>
    mockFetchWeatherSnapshotForConfig(...a),
  getPersonalWeatherConfig: (...a: unknown[]) => mockGetPersonalWeatherConfig(...a),
}));

function makeContext(search = "", clientAddress = "1.2.3.4"): APIContext {
  const url = new URL(`https://example.com/api/home/weather${search}`);
  return { url, cookies: {}, clientAddress } as unknown as APIContext;
}

beforeEach(() => {
  mockCheckWeatherSearchRateLimit.mockReset().mockReturnValue({ ok: true });
  mockGetAuthFromCookies.mockReset().mockResolvedValue({ user: null });
  mockResolveWeatherCityId.mockReset().mockReturnValue("5128581");
  mockFetchWeatherSnapshot.mockReset().mockResolvedValue({
    temp_f: 55,
    description: "Clear",
  });
  mockGetPersonalWeatherConfig.mockReset().mockReturnValue({
    source: "openweather",
    openWeatherCityId: "5128581",
  });
  mockFetchWeatherSnapshotForConfig.mockReset().mockResolvedValue(null);
});

describe("GET /api/home/weather", () => {
  it("returns 429 when rate limited", async () => {
    mockCheckWeatherSearchRateLimit.mockReturnValue({
      ok: false,
      retryAfterSec: 45,
    });
    const { GET } = await import("./weather");

    const response = await GET(makeContext());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("45");
    expect(await response.json()).toEqual({ error: "Too many requests" });
  });

  it("returns 502 when weather cannot be loaded", async () => {
    mockFetchWeatherSnapshot.mockResolvedValue(null);
    const { GET } = await import("./weather");

    const response = await GET(makeContext("?cityId=5128581"));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "Unable to load weather for this location.",
      cityId: "5128581",
    });
  });

  it("returns openweather snapshot for anonymous visitors", async () => {
    const { GET } = await import("./weather");

    const response = await GET(makeContext("?cityId=5128581"));

    expect(mockResolveWeatherCityId).toHaveBeenCalledWith("5128581");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      weather: { temp_f: 55, description: "Clear", source: "openweather" },
      cityId: "5128581",
      source: "openweather",
    });
  });

  it("uses personal weather config when the user is signed in", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ user: { id: "user-1" } });
    mockGetPersonalWeatherConfig.mockReturnValue({
      source: "nws",
      openWeatherCityId: "5128581",
    });
    mockFetchWeatherSnapshotForConfig.mockResolvedValue({
      temp_f: 60,
      source: "nws",
    });
    const { GET } = await import("./weather");

    const response = await GET(makeContext());

    expect(mockFetchWeatherSnapshotForConfig).toHaveBeenCalled();
    expect(mockFetchWeatherSnapshot).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      weather: { temp_f: 60, source: "nws" },
      cityId: "5128581",
      source: "nws",
    });
  });
});
