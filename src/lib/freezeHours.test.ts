import { describe, expect, it } from "vitest";
import { computeDailyFreezeHours, computeFreezeHours } from "./freezeHours";

describe("freeze hours", () => {
  it("estimates hours and degree-hours below threshold", () => {
    const summary = computeFreezeHours([
      { timestamp: "2026-01-01T00:00:00Z", tempf: 30, humidity: 50, probeLabel: "A" },
      { timestamp: "2026-01-01T02:00:00Z", tempf: 30, humidity: 50, probeLabel: "A" },
    ]);
    expect(summary.hoursBelow34).toBeGreaterThan(0);
    expect(summary.degreeHoursBelow).toBeGreaterThan(0);
    expect(summary.coldestF).toBe(30);
  });

  it("buckets freeze hours by local calendar day", () => {
    const daily = computeDailyFreezeHours(
      [
        { timestamp: "2026-01-01T00:00:00Z", tempf: 30, humidity: 50, probeLabel: "A" },
        { timestamp: "2026-01-01T12:00:00Z", tempf: 30, humidity: 50, probeLabel: "A" },
        { timestamp: "2026-01-02T00:00:00Z", tempf: 40, humidity: 50, probeLabel: "A" },
        { timestamp: "2026-01-02T12:00:00Z", tempf: 40, humidity: 50, probeLabel: "A" },
      ],
      34,
    );
    expect(daily.length).toBeGreaterThanOrEqual(2);
    const coldDay = daily.find((d) => d.hoursBelow > 0);
    expect(coldDay).toBeTruthy();
    expect(coldDay!.coldestF).toBe(30);
    const warmish = daily.filter((d) => d.dayKey !== coldDay!.dayKey);
    expect(warmish.some((d) => d.hoursBelow === 0)).toBe(true);
  });
});
