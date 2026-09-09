import { describe, expect, it } from "vitest";
import type { ChartPoint } from "./garageTempsHistory";
import { buildIndoorOutdoorSeries, computeIndoorOutdoorDelta } from "./indoorOutdoorDelta";

const points: ChartPoint[] = [
  {
    timestamp: "2026-01-02T12:00:00.000Z",
    tempf: 50,
    humidity: 40,
    probeLabel: "Bay",
  },
  {
    timestamp: "2026-01-02T10:00:00.000Z",
    tempf: 40,
    humidity: 42,
    probeLabel: "Bay",
  },
  {
    timestamp: "2026-01-02T11:00:00.000Z",
    tempf: 45,
    humidity: 41,
    probeLabel: "Bay",
  },
];

describe("buildIndoorOutdoorSeries", () => {
  it("returns empty for non-finite outdoor temps", () => {
    expect(buildIndoorOutdoorSeries(points, Number.NaN)).toEqual([]);
    expect(buildIndoorOutdoorSeries(points, Number.POSITIVE_INFINITY)).toEqual([]);
  });

  it("sorts points and computes per-point deltas", () => {
    expect(buildIndoorOutdoorSeries(points, 30)).toEqual([
      {
        timestamp: "2026-01-02T10:00:00.000Z",
        indoorF: 40,
        outdoorF: 30,
        deltaF: 10,
      },
      {
        timestamp: "2026-01-02T11:00:00.000Z",
        indoorF: 45,
        outdoorF: 30,
        deltaF: 15,
      },
      {
        timestamp: "2026-01-02T12:00:00.000Z",
        indoorF: 50,
        outdoorF: 30,
        deltaF: 20,
      },
    ]);
  });

  it("returns an empty series for empty input", () => {
    expect(buildIndoorOutdoorSeries([], 20)).toEqual([]);
  });
});

describe("computeIndoorOutdoorDelta", () => {
  it("returns null for empty points or non-finite outdoor", () => {
    expect(computeIndoorOutdoorDelta([], 30, "Clear", "Boston")).toBeNull();
    expect(computeIndoorOutdoorDelta(points, Number.NaN, "Clear", "Boston")).toBeNull();
  });

  it("averages indoor temps and computes delta", () => {
    expect(computeIndoorOutdoorDelta(points, 30, "Cloudy", "Portland")).toEqual({
      outdoorF: 30,
      outdoorDescription: "Cloudy",
      indoorAvgF: 45,
      deltaF: 15,
      cityName: "Portland",
    });
  });

  it("allows a null city name", () => {
    expect(computeIndoorOutdoorDelta(points.slice(0, 1), 20, "Fair", null)).toEqual({
      outdoorF: 20,
      outdoorDescription: "Fair",
      indoorAvgF: 50,
      deltaF: 30,
      cityName: null,
    });
  });
});
