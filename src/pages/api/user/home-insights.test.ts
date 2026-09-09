import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
}));

const mockFetchNwsAlerts = vi.fn();
vi.mock("../../../lib/nwsAlerts", () => ({
  fetchNwsAlerts: (...a: unknown[]) => mockFetchNwsAlerts(...a),
}));

const mockGetAlertSettingsForUser = vi.fn();
vi.mock("../../../lib/notify", () => ({
  getAlertSettingsForUser: (...a: unknown[]) => mockGetAlertSettingsForUser(...a),
}));

const mockFetchNightsAtRiskForConfig = vi.fn();
const mockFetchWeatherSnapshotForConfig = vi.fn();
const mockGetPersonalWeatherConfig = vi.fn();
vi.mock("../../../lib/weatherContext", () => ({
  fetchNightsAtRiskForConfig: (...a: unknown[]) => mockFetchNightsAtRiskForConfig(...a),
  fetchWeatherSnapshotForConfig: (...a: unknown[]) =>
    mockFetchWeatherSnapshotForConfig(...a),
  getPersonalWeatherConfig: (...a: unknown[]) => mockGetPersonalWeatherConfig(...a),
}));

const mockGetUserPreferences = vi.fn();
vi.mock("../../../lib/userPreferences", () => ({
  getUserPreferences: (...a: unknown[]) => mockGetUserPreferences(...a),
}));

const mockFetchMobileHousePayloadForUser = vi.fn();
const mockFetchMobileRegionalBenchmarkForUser = vi.fn();
vi.mock("../../../lib/mobileHouseContext", () => ({
  fetchMobileHousePayloadForUser: (...a: unknown[]) =>
    mockFetchMobileHousePayloadForUser(...a),
  fetchMobileRegionalBenchmarkForUser: (...a: unknown[]) =>
    mockFetchMobileRegionalBenchmarkForUser(...a),
}));

const mockFetchGarageTempChartData = vi.fn();
vi.mock("../../../lib/garageTempsHistory", () => ({
  fetchGarageTempChartData: (...a: unknown[]) => mockFetchGarageTempChartData(...a),
}));

const mockFetchLatestSensorValues = vi.fn();
vi.mock("../../../lib/sensorReadings", () => ({
  fetchLatestSensorValues: (...a: unknown[]) => mockFetchLatestSensorValues(...a),
}));

const mockGetUserHouseholdId = vi.fn();
vi.mock("../../../lib/households", () => ({
  getUserHouseholdId: (...a: unknown[]) => mockGetUserHouseholdId(...a),
}));

const mockBuildTimeToFreezeProjection = vi.fn();
const mockOutdoorPointsFromHourly = vi.fn();
const mockTimeToFreezeApiPayload = vi.fn();
vi.mock("../../../lib/spaceThermalModel", () => ({
  buildTimeToFreezeProjection: (...a: unknown[]) => mockBuildTimeToFreezeProjection(...a),
  outdoorPointsFromHourly: (...a: unknown[]) => mockOutdoorPointsFromHourly(...a),
  timeToFreezeApiPayload: (...a: unknown[]) => mockTimeToFreezeApiPayload(...a),
}));

const mockFetchOpenMeteoHourlyWindow = vi.fn();
const mockSplitOpenMeteoPastAndForecast = vi.fn();
vi.mock("../../../lib/openMeteoHistory", () => ({
  fetchOpenMeteoHourlyWindow: (...a: unknown[]) => mockFetchOpenMeteoHourlyWindow(...a),
  splitOpenMeteoPastAndForecast: (...a: unknown[]) =>
    mockSplitOpenMeteoPastAndForecast(...a),
}));

function makeContext(): APIContext {
  return {
    request: new Request("https://example.com/api/user/home-insights"),
    cookies: {},
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1", user_metadata: {} },
  });
  mockGetUserPreferences.mockReset().mockResolvedValue({
    useCelsius: false,
    weatherSource: "nws",
  });
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue({
    freezeThresholdF: 32,
    quietHoursTimezone: "America/New_York",
    forecastHoursAhead: 24,
  });
  mockGetUserHouseholdId.mockReset().mockResolvedValue("house-1");
  mockGetPersonalWeatherConfig.mockReset().mockReturnValue({ lat: 40, lon: -74 });
  mockFetchNightsAtRiskForConfig.mockReset().mockResolvedValue([
    { dateLabel: "Tonight", minTempF: 28, atRisk: true },
  ]);
  mockFetchWeatherSnapshotForConfig.mockReset().mockResolvedValue({
    source: "nws",
    temp: 30,
    lat: 40,
    lon: -74,
  });
  mockFetchMobileHousePayloadForUser.mockReset().mockResolvedValue({ indoor_f: 68 });
  mockFetchMobileRegionalBenchmarkForUser.mockReset().mockResolvedValue({ avg_f: 35 });
  mockFetchGarageTempChartData.mockReset().mockResolvedValue({
    points: [{ timestamp: "2024-01-01T00:00:00Z", tempf: 40 }],
  });
  mockFetchLatestSensorValues.mockReset().mockResolvedValue([
    {
      sensor: { kind: "temperature", label: "Garage", unit: "F" },
      value_num: 38,
      value_bool: null,
      value_text: null,
    },
  ]);
  mockFetchNwsAlerts.mockReset().mockResolvedValue({
    alerts: [
      {
        event: "Freeze Warning",
        headline: "Cold",
        severity: "Severe",
        expires: "2024-01-02",
      },
    ],
  });
  mockFetchOpenMeteoHourlyWindow.mockReset().mockResolvedValue([]);
  mockSplitOpenMeteoPastAndForecast.mockReset().mockReturnValue({
    past: [],
    forecast: [],
  });
  mockOutdoorPointsFromHourly.mockReset().mockReturnValue([]);
  mockBuildTimeToFreezeProjection.mockReset().mockReturnValue({ hours: 5 });
  mockTimeToFreezeApiPayload.mockReset().mockReturnValue({ hours_to_freeze: 5 });
});

describe("GET /api/user/home-insights", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./home-insights");

    const response = await GET(makeContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns weather, nights at risk, and freeze projection", async () => {
    const { GET } = await import("./home-insights");

    const response = await GET(makeContext());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, max-age=120");
    expect(body.freeze_threshold_f).toBe(32);
    expect(body.nights_at_risk).toEqual([
      { date_label: "Tonight", min_temp_f: 28, at_risk: true },
    ]);
    expect(body.nws_alerts).toEqual([
      {
        event: "Freeze Warning",
        headline: "Cold",
        severity: "Severe",
        expires: "2024-01-02",
      },
    ]);
    expect(body.outdoor_temp_f).toBe(30);
    expect(body.time_to_freeze).toEqual({ hours_to_freeze: 5 });
    expect(mockBuildTimeToFreezeProjection).toHaveBeenCalledWith(
      expect.objectContaining({ currentTempF: 38, freezeThresholdF: 32 }),
    );
  });
});
