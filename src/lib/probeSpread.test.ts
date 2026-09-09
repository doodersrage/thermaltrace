import { describe, expect, it } from "vitest";
import { buildProbeSpreadSeries } from "./probeSpread";

describe("buildProbeSpreadSeries", () => {
  it("returns empty when fewer than two probes share a bucket", () => {
    expect(
      buildProbeSpreadSeries([
        { timestamp: "2026-01-01T00:00:00Z", tempf: 40, humidity: 50, probeLabel: "A" },
        { timestamp: "2026-01-01T01:00:00Z", tempf: 41, humidity: 50, probeLabel: "A" },
      ]),
    ).toEqual([]);
  });

  it("computes warmest-minus-coldest per hourly bucket", () => {
    const series = buildProbeSpreadSeries(
      [
        { timestamp: "2026-01-01T00:10:00Z", tempf: 40, humidity: 50, probeLabel: "Bay" },
        { timestamp: "2026-01-01T00:20:00Z", tempf: 48, humidity: 50, probeLabel: "Attic" },
        { timestamp: "2026-01-01T01:10:00Z", tempf: 42, humidity: 50, probeLabel: "Bay" },
        { timestamp: "2026-01-01T01:20:00Z", tempf: 44, humidity: 50, probeLabel: "Attic" },
      ],
      60 * 60 * 1000,
    );
    expect(series).toHaveLength(2);
    expect(series[0]?.spreadF).toBe(8);
    expect(series[0]?.minF).toBe(40);
    expect(series[0]?.maxF).toBe(48);
    expect(series[1]?.spreadF).toBe(2);
  });
});
