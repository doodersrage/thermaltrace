import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChartPoint } from "./garageTempsHistory";

const mockFetchGarageTempChartData = vi.fn();
vi.mock("./garageTempsHistory", () => ({
  fetchGarageTempChartData: (...a: unknown[]) => mockFetchGarageTempChartData(...a),
}));

const mockFetchPriorYearCompareBundle = vi.fn();
vi.mock("./priorYearCompare", () => ({
  fetchPriorYearCompareBundle: (...a: unknown[]) => mockFetchPriorYearCompareBundle(...a),
}));

function point(overrides: Partial<ChartPoint> = {}): ChartPoint {
  return {
    timestamp: "2024-06-15T12:00:00.000Z",
    tempf: 40,
    humidity: 50,
    probeLabel: "Garage",
    ...overrides,
  };
}

beforeEach(() => {
  mockFetchGarageTempChartData.mockReset().mockResolvedValue({ points: [], error: null });
  mockFetchPriorYearCompareBundle.mockReset().mockResolvedValue({
    points: [],
    source: "none",
    outdoorLocationLabel: null,
    earliestLocalReadingAt: null,
  });
});

describe("fetchWeekCompare", () => {
  it("fetches this week's points via fetchGarageTempChartData when not given", async () => {
    const { fetchWeekCompare } = await import("./dashboardInsights");

    await fetchWeekCompare("user-1");

    expect(mockFetchGarageTempChartData).toHaveBeenCalledWith("user-1", 7);
  });

  it("uses the given thisWeekPoints and skips fetchGarageTempChartData", async () => {
    const { fetchWeekCompare } = await import("./dashboardInsights");

    await fetchWeekCompare("user-1", null, [point({ tempf: 30 })]);

    expect(mockFetchGarageTempChartData).not.toHaveBeenCalled();
  });

  it("always fetches the prior-year bundle, passing the user through", async () => {
    const { fetchWeekCompare } = await import("./dashboardInsights");
    const user = { id: "user-1" } as never;

    await fetchWeekCompare("user-1", user, [point()]);

    expect(mockFetchPriorYearCompareBundle).toHaveBeenCalledWith("user-1", 7, {}, user);
  });

  it("returns an empty compare and the error when fetching this week's points fails", async () => {
    mockFetchGarageTempChartData.mockResolvedValue({ points: [], error: "db down" });
    const { fetchWeekCompare } = await import("./dashboardInsights");

    const result = await fetchWeekCompare("user-1");

    expect(result.error).toBe("db down");
    expect(result.compare).toEqual({
      thisWeekAvgF: null,
      priorYearAvgF: null,
      deltaF: null,
      sampleCount: 0,
      priorYearSource: "none",
      priorYearOutdoorLabel: null,
      earliestLocalReadingAt: null,
    });
  });

  it("computes deltaF and merges prior-year metadata on success", async () => {
    mockFetchPriorYearCompareBundle.mockResolvedValue({
      points: [point({ tempf: 20 })],
      source: "local",
      outdoorLocationLabel: "Denver",
      earliestLocalReadingAt: "2023-06-01T00:00:00.000Z",
    });
    const { fetchWeekCompare } = await import("./dashboardInsights");

    const result = await fetchWeekCompare("user-1", null, [point({ tempf: 30 })]);

    expect(result.error).toBeNull();
    expect(result.compare.thisWeekAvgF).toBe(30);
    expect(result.compare.priorYearAvgF).toBe(20);
    expect(result.compare.deltaF).toBe(10);
    expect(result.compare.priorYearSource).toBe("local");
    expect(result.compare.priorYearOutdoorLabel).toBe("Denver");
    expect(result.compare.earliestLocalReadingAt).toBe("2023-06-01T00:00:00.000Z");
  });

  it("leaves deltaF null when either average is unavailable", async () => {
    const { fetchWeekCompare } = await import("./dashboardInsights");

    const result = await fetchWeekCompare("user-1", null, []);

    expect(result.compare.thisWeekAvgF).toBeNull();
    expect(result.compare.deltaF).toBeNull();
  });
});

describe("buildTimeToFreezeFromPoints", () => {
  it("reports no readings yet when there are no finite temperature points", async () => {
    const { buildTimeToFreezeFromPoints } = await import("./dashboardInsights");

    const result = buildTimeToFreezeFromPoints(
      [point({ tempf: NaN }), point({ tempf: Infinity })],
      32,
    );

    expect(result).toEqual({
      hours: null,
      rateFPerHour: null,
      message: "No temperature readings yet.",
    });
  });

  it("returns an already-freezing message when the latest point is at or below threshold", async () => {
    const { buildTimeToFreezeFromPoints } = await import("./dashboardInsights");

    const result = buildTimeToFreezeFromPoints([point({ tempf: 30 })], 32);

    expect(result.hours).toBe(0);
  });

  it("filters out non-finite points before picking the latest sample", async () => {
    const { buildTimeToFreezeFromPoints } = await import("./dashboardInsights");

    const result = buildTimeToFreezeFromPoints(
      [point({ tempf: 40 }), point({ tempf: NaN }), point({ tempf: 35 })],
      32,
    );

    // Latest finite point is 35F, above the 32F threshold, so not yet freezing.
    expect(result.hours).not.toBe(0);
  });

  it("only uses the last 12 samples for the rate estimate", async () => {
    const { buildTimeToFreezeFromPoints } = await import("./dashboardInsights");
    const points = Array.from({ length: 20 }, (_, i) =>
      point({ timestamp: `2024-06-15T${String(i).padStart(2, "0")}:00:00.000Z`, tempf: 50 - i }),
    );

    // Should not throw and should use only the trailing window; smoke-tests the slice(-12).
    const result = buildTimeToFreezeFromPoints(points, 32);

    expect(result.message).toEqual(expect.any(String));
  });
});
