import { describe, expect, it } from "vitest";
import {
  clampTimeWindow,
  collectHoverHits,
  formatHoverTime,
  isFullyZoomedOut,
  matchingPresetId,
  nearestPointByTime,
  panTimeWindow,
  brushPixelsToWindow,
  tempToY,
  timeDomainFromPoints,
  timestampToX,
  windowForTrailingSpan,
  xToTimestamp,
  zoomTimeWindow,
  type ChartSeriesPoint,
  type PlotBounds,
} from "./historyChartInteraction";

const bounds: PlotBounds = {
  padLeft: 40,
  padRight: 16,
  padTop: 16,
  padBottom: 28,
  width: 400,
  height: 200,
  minTs: 1_000,
  maxTs: 5_000,
  minTemp: 30,
  maxTemp: 50,
};

const series: ChartSeriesPoint[] = [
  { timestamp: new Date(1_000).toISOString(), tempf: 40, humidity: 50, probeLabel: "A" },
  { timestamp: new Date(3_000).toISOString(), tempf: 42, humidity: 55, probeLabel: "A" },
  { timestamp: new Date(5_000).toISOString(), tempf: 38, humidity: 60, probeLabel: "A" },
];

describe("historyChartInteraction", () => {
  it("maps x within the plot to a timestamp", () => {
    expect(xToTimestamp(40, bounds)).toBe(1_000);
    expect(xToTimestamp(400 - 16, bounds)).toBe(5_000);
    expect(xToTimestamp(40 + (400 - 40 - 16) / 2, bounds)).toBe(3_000);
  });

  it("clamps x outside the plot edges", () => {
    expect(xToTimestamp(0, bounds)).toBe(1_000);
    expect(xToTimestamp(999, bounds)).toBe(5_000);
  });

  it("round-trips timestamp to x", () => {
    const x = timestampToX(3_000, bounds);
    expect(xToTimestamp(x, bounds)).toBe(3_000);
  });

  it("maps temperature to y (higher temp = lower y)", () => {
    expect(tempToY(50, bounds)).toBe(16);
    expect(tempToY(30, bounds)).toBe(16 + (200 - 16 - 28));
  });

  it("finds the nearest point by time", () => {
    expect(nearestPointByTime(series, 2_900)?.tempf).toBe(42);
    expect(nearestPointByTime(series, 4_800)?.tempf).toBe(38);
    expect(nearestPointByTime([], 1_000)).toBeNull();
  });

  it("collects hover hits for visible probes only", () => {
    const byProbe = new Map<string, ChartSeriesPoint[]>([
      ["Bay", series],
      [
        "Attic",
        [
          {
            timestamp: new Date(3_100).toISOString(),
            tempf: 55,
            humidity: 40,
            probeLabel: "Attic",
          },
        ],
      ],
    ]);
    const hits = collectHoverHits({
      targetTs: 3_000,
      byProbe,
      probeColors: ["#60a5fa", "#34d399"],
      visibleProbes: new Set(["Bay"]),
      dewPointF: () => 32,
    });
    expect(hits).toHaveLength(1);
    expect(hits[0]?.probeLabel).toBe("Bay");
    expect(hits[0]?.tempf).toBe(42);
    expect(hits[0]?.dewPointF).toBe(32);
  });

  it("includes house series when provided", () => {
    const byProbe = new Map<string, ChartSeriesPoint[]>([["Bay", series]]);
    const hits = collectHoverHits({
      targetTs: 3_000,
      byProbe,
      probeColors: ["#60a5fa"],
      visibleProbes: new Set(["Bay"]),
      housePoints: [
        {
          timestamp: new Date(2_900).toISOString(),
          tempf: 68,
          humidity: 0,
          probeLabel: "House",
        },
      ],
      houseLegend: "Nest",
    });
    expect(hits.map((h) => h.probeLabel)).toEqual(["Bay", "Nest"]);
    expect(hits[1]?.tempf).toBe(68);
  });

  it("formats hover timestamps for display", () => {
    const label = formatHoverTime("2026-01-15T18:30:00.000Z");
    expect(label.length).toBeGreaterThan(4);
    expect(label).toMatch(/Jan|15|6|30|PM|AM|\d/i);
  });

  it("derives a time domain from points", () => {
    expect(timeDomainFromPoints(series)).toEqual({ minTs: 1_000, maxTs: 5_000 });
    expect(timeDomainFromPoints([])).toBeNull();
  });

  it("zooms in around an anchor without leaving the domain", () => {
    const domain = { minTs: 0, maxTs: 10_000 };
    const view = { minTs: 0, maxTs: 10_000 };
    const next = zoomTimeWindow(view, domain, 5_000, 0.5, 100);
    expect(next.maxTs - next.minTs).toBe(5_000);
    expect(next.minTs).toBe(2_500);
    expect(next.maxTs).toBe(7_500);
  });

  it("clamps zoom-out to the full domain", () => {
    const domain = { minTs: 0, maxTs: 10_000 };
    const view = { minTs: 2_000, maxTs: 4_000 };
    const next = zoomTimeWindow(view, domain, 3_000, 10, 100);
    expect(isFullyZoomedOut(next, domain)).toBe(true);
  });

  it("pans within the domain", () => {
    const domain = { minTs: 0, maxTs: 10_000 };
    const view = { minTs: 2_000, maxTs: 4_000 };
    expect(panTimeWindow(view, domain, 1_000)).toEqual({
      minTs: 3_000,
      maxTs: 5_000,
    });
    expect(panTimeWindow(view, domain, 20_000)).toEqual({
      minTs: 8_000,
      maxTs: 10_000,
    });
  });

  it("enforces a minimum zoom span", () => {
    const domain = { minTs: 0, maxTs: 10_000 };
    const view = { minTs: 4_000, maxTs: 4_200 };
    const next = clampTimeWindow(view, domain, 1_000);
    expect(next.maxTs - next.minTs).toBe(1_000);
  });

  it("builds trailing preset windows clamped to the domain", () => {
    const domain = { minTs: 0, maxTs: 10_000 };
    expect(windowForTrailingSpan(domain, 3_000)).toEqual({
      minTs: 7_000,
      maxTs: 10_000,
    });
    expect(windowForTrailingSpan(domain, 50_000)).toEqual(domain);
  });

  it("matches trailing presets and all/custom", () => {
    const day = 24 * 60 * 60 * 1000;
    const domain = { minTs: 0, maxTs: 40 * day };
    expect(matchingPresetId(null, domain)).toBe("all");
    expect(
      matchingPresetId(windowForTrailingSpan(domain, day), domain),
    ).toBe("24h");
    expect(
      matchingPresetId(
        { minTs: domain.minTs + 5 * day, maxTs: domain.minTs + 8 * day },
        domain,
      ),
    ).toBe("custom");
  });

  it("converts a brush selection into a time window", () => {
    const day = 24 * 60 * 60 * 1000;
    const domain = { minTs: 0, maxTs: 10 * day };
    const wideBounds: PlotBounds = {
      ...bounds,
      minTs: domain.minTs,
      maxTs: domain.maxTs,
    };
    const next = brushPixelsToWindow(
      40,
      40 + (400 - 40 - 16) / 2,
      wideBounds,
      domain,
    );
    expect(next?.minTs).toBe(0);
    expect(next?.maxTs).toBe(5 * day);
    expect(brushPixelsToWindow(40, 44, wideBounds, domain)).toBeNull();
  });
});
