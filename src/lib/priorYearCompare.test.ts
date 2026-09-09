import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchGarageTempChartDataPriorYear = vi.fn();
const mockFetchEarliestSensorReadingAt = vi.fn();
vi.mock("./garageTempsHistory", () => ({
  fetchGarageTempChartDataPriorYear: (...a: unknown[]) =>
    mockFetchGarageTempChartDataPriorYear(...a),
  fetchEarliestSensorReadingAt: (...a: unknown[]) => mockFetchEarliestSensorReadingAt(...a),
}));

const mockGetUserHouseholdId = vi.fn();
vi.mock("./households", () => ({
  getUserHouseholdId: (...a: unknown[]) => mockGetUserHouseholdId(...a),
}));

const mockResolveOutdoorCompareCoords = vi.fn();
vi.mock("./outdoorCompareCoords", () => ({
  resolveOutdoorCompareCoords: (...a: unknown[]) => mockResolveOutdoorCompareCoords(...a),
}));

const mockAverageOpenMeteoTempF = vi.fn();
const mockFetchOpenMeteoHourlyHistory = vi.fn();
const mockOpenMeteoPointsToChartPoints = vi.fn();
const mockPriorYearWindow = vi.fn();
vi.mock("./openMeteoHistory", () => ({
  averageOpenMeteoTempF: (...a: unknown[]) => mockAverageOpenMeteoTempF(...a),
  fetchOpenMeteoHourlyHistory: (...a: unknown[]) => mockFetchOpenMeteoHourlyHistory(...a),
  openMeteoPointsToChartPoints: (...a: unknown[]) => mockOpenMeteoPointsToChartPoints(...a),
  priorYearWindow: (...a: unknown[]) => mockPriorYearWindow(...a),
}));

beforeEach(() => {
  mockFetchGarageTempChartDataPriorYear.mockReset().mockResolvedValue({ points: [], error: null });
  mockFetchEarliestSensorReadingAt.mockReset().mockResolvedValue("2023-01-01T00:00:00.000Z");
  mockGetUserHouseholdId.mockReset().mockResolvedValue("house-1");
  mockResolveOutdoorCompareCoords.mockReset().mockResolvedValue(null);
  mockAverageOpenMeteoTempF.mockReset().mockReturnValue(null);
  mockFetchOpenMeteoHourlyHistory.mockReset().mockResolvedValue([]);
  mockOpenMeteoPointsToChartPoints.mockReset().mockReturnValue([]);
  mockPriorYearWindow.mockReset().mockReturnValue({ start: new Date("2023-06-08"), end: new Date("2023-06-15") });
});

describe("fetchPriorYearCompareBundle", () => {
  it("returns the local points and source when local history exists", async () => {
    mockFetchGarageTempChartDataPriorYear.mockResolvedValue({
      points: [{ timestamp: "t", tempf: 10, humidity: 5, probeLabel: "Garage" }],
      error: null,
    });
    const { fetchPriorYearCompareBundle } = await import("./priorYearCompare");

    const result = await fetchPriorYearCompareBundle("user-1", 7);

    expect(result.source).toBe("local");
    expect(result.points).toHaveLength(1);
    expect(result.outdoorLocationLabel).toBeNull();
    expect(result.earliestLocalReadingAt).toBe("2023-01-01T00:00:00.000Z");
    expect(mockResolveOutdoorCompareCoords).not.toHaveBeenCalled();
  });

  it("does not look up the earliest reading when there is no household", async () => {
    mockGetUserHouseholdId.mockResolvedValue(null);
    const { fetchPriorYearCompareBundle } = await import("./priorYearCompare");

    const result = await fetchPriorYearCompareBundle("user-1", 7);

    expect(mockFetchEarliestSensorReadingAt).not.toHaveBeenCalled();
    expect(result.earliestLocalReadingAt).toBeNull();
  });

  it("falls back to outdoor coords when there are no local points, returning 'none' if unresolved", async () => {
    mockResolveOutdoorCompareCoords.mockResolvedValue(null);
    const { fetchPriorYearCompareBundle } = await import("./priorYearCompare");

    const result = await fetchPriorYearCompareBundle("user-1", 7);

    expect(result).toEqual({
      points: [],
      source: "none",
      outdoorLocationLabel: null,
      earliestLocalReadingAt: "2023-01-01T00:00:00.000Z",
    });
    expect(mockFetchOpenMeteoHourlyHistory).not.toHaveBeenCalled();
  });

  it("uses the resolved coords and priorYearWindow(days) to fetch outdoor history", async () => {
    mockResolveOutdoorCompareCoords.mockResolvedValue({ lat: 39.7, lon: -104.9, label: "Denver" });
    const { fetchPriorYearCompareBundle } = await import("./priorYearCompare");

    await fetchPriorYearCompareBundle("user-1", 14);

    expect(mockPriorYearWindow).toHaveBeenCalledWith(14);
    expect(mockFetchOpenMeteoHourlyHistory).toHaveBeenCalledWith(
      39.7,
      -104.9,
      expect.any(Date),
      expect.any(Date),
    );
  });

  it("returns 'none' with the outdoor label when the hourly history is empty", async () => {
    mockResolveOutdoorCompareCoords.mockResolvedValue({ lat: 39.7, lon: -104.9, label: "Denver" });
    mockFetchOpenMeteoHourlyHistory.mockResolvedValue([]);
    const { fetchPriorYearCompareBundle } = await import("./priorYearCompare");

    const result = await fetchPriorYearCompareBundle("user-1", 7);

    expect(result).toEqual({
      points: [],
      source: "none",
      outdoorLocationLabel: "Denver",
      earliestLocalReadingAt: "2023-01-01T00:00:00.000Z",
    });
  });

  it("returns 'none' with the outdoor label when the average temp cannot be computed", async () => {
    mockResolveOutdoorCompareCoords.mockResolvedValue({ lat: 39.7, lon: -104.9, label: "Denver" });
    mockFetchOpenMeteoHourlyHistory.mockResolvedValue([{ timestamp: "t", tempf: NaN }]);
    mockAverageOpenMeteoTempF.mockReturnValue(null);
    const { fetchPriorYearCompareBundle } = await import("./priorYearCompare");

    const result = await fetchPriorYearCompareBundle("user-1", 7);

    expect(result.source).toBe("none");
    expect(result.outdoorLocationLabel).toBe("Denver");
  });

  it("returns the outdoor_estimate source and converted points on success", async () => {
    mockResolveOutdoorCompareCoords.mockResolvedValue({ lat: 39.7, lon: -104.9, label: "Denver" });
    const hourly = [{ timestamp: "t", tempf: 30 }];
    mockFetchOpenMeteoHourlyHistory.mockResolvedValue(hourly);
    mockAverageOpenMeteoTempF.mockReturnValue(30);
    const chartPoints = [{ timestamp: "t", tempf: 30, humidity: 0, probeLabel: "Outdoor (estimated)" }];
    mockOpenMeteoPointsToChartPoints.mockReturnValue(chartPoints);
    const { fetchPriorYearCompareBundle } = await import("./priorYearCompare");

    const result = await fetchPriorYearCompareBundle("user-1", 7);

    expect(mockOpenMeteoPointsToChartPoints).toHaveBeenCalledWith(hourly);
    expect(result).toEqual({
      points: chartPoints,
      source: "outdoor_estimate",
      outdoorLocationLabel: "Denver",
      earliestLocalReadingAt: "2023-01-01T00:00:00.000Z",
    });
  });

  it("passes the user through to resolveOutdoorCompareCoords", async () => {
    const user = { id: "user-1" } as never;
    const { fetchPriorYearCompareBundle } = await import("./priorYearCompare");

    await fetchPriorYearCompareBundle("user-1", 7, {}, user);

    expect(mockResolveOutdoorCompareCoords).toHaveBeenCalledWith("user-1", user);
  });
});
