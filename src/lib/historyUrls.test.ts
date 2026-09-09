import { describe, expect, it } from "vitest";
import {
  buildHistoryChartUrl,
  isoDayUtc,
  timeWindowToHistoryDates,
  trailingHistoryWindowDays,
} from "./historyUrls";

describe("historyUrls", () => {
  it("formats UTC day strings", () => {
    expect(isoDayUtc(new Date("2026-09-09T21:15:00.000Z"))).toBe("2026-09-09");
  });

  it("builds an inclusive trailing window", () => {
    expect(trailingHistoryWindowDays(7, new Date("2026-09-09T12:00:00.000Z"))).toEqual({
      from: "2026-09-03",
      to: "2026-09-09",
    });
    expect(trailingHistoryWindowDays(1, new Date("2026-09-09T12:00:00.000Z"))).toEqual({
      from: "2026-09-09",
      to: "2026-09-09",
    });
  });

  it("converts a chart time window to day params", () => {
    expect(
      timeWindowToHistoryDates({
        minTs: Date.parse("2026-01-02T15:00:00.000Z"),
        maxTs: Date.parse("2026-01-05T02:00:00.000Z"),
      }),
    ).toEqual({ from: "2026-01-02", to: "2026-01-05" });
  });

  it("builds absolute and path-only History URLs", () => {
    expect(
      buildHistoryChartUrl("https://thermaltrace.dev/", {
        from: "2026-09-01",
        to: "2026-09-09",
        tab: "exports",
        highlightAlertId: 42,
      }),
    ).toBe(
      "https://thermaltrace.dev/dashboard/history?from=2026-09-01&to=2026-09-09&tab=exports&alert=42",
    );
    expect(
      buildHistoryChartUrl(null, { from: "2026-09-01", to: "2026-09-09" }),
    ).toBe("/dashboard/history?from=2026-09-01&to=2026-09-09");
  });
});
