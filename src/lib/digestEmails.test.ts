import { describe, expect, it } from "vitest";
import {
  buildWeeklyDigestParts,
  formatDigestFreezeLine,
  formatWeeklyDigestSubject,
  summarizePointsByDay,
} from "./digestEmails";
import type { ChartPoint } from "./garageTempsHistory";

describe("summarizePointsByDay", () => {
  it("returns one line per UTC day with min–max and average", () => {
    const points: ChartPoint[] = [
      {
        timestamp: "2026-01-05T08:00:00Z",
        tempf: 40,
        humidity: 50,
        probeLabel: "Garage",
      },
      {
        timestamp: "2026-01-05T20:00:00Z",
        tempf: 50,
        humidity: 45,
        probeLabel: "Garage",
      },
      {
        timestamp: "2026-01-06T12:00:00Z",
        tempf: 32,
        humidity: 60,
        probeLabel: "Garage",
      },
    ];

    const lines = summarizePointsByDay(points);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/^Mon, Jan 5: 40\.0–50\.0 °F \(avg 45\.0°\)$/);
    expect(lines[1]).toMatch(/^Tue, Jan 6: 32\.0–32\.0 °F \(avg 32\.0°\)$/);
  });

  it("notes the coldest probe when multiple probes share a day", () => {
    const points: ChartPoint[] = [
      {
        timestamp: "2026-01-05T08:00:00Z",
        tempf: 42,
        humidity: 50,
        probeLabel: "Garage",
      },
      {
        timestamp: "2026-01-05T09:00:00Z",
        tempf: 34,
        humidity: 55,
        probeLabel: "Pipe bay",
      },
    ];

    const lines = summarizePointsByDay(points);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("34.0–42.0 °F");
    expect(lines[0]).toContain("coldest Pipe bay");
  });

  it("returns empty for no points", () => {
    expect(summarizePointsByDay([])).toEqual([]);
  });
});

describe("weekly digest freeze + subject", () => {
  const points: ChartPoint[] = [
    {
      timestamp: "2026-01-05T08:00:00Z",
      tempf: 40,
      humidity: 50,
      probeLabel: "Garage",
    },
    {
      timestamp: "2026-01-06T04:00:00Z",
      tempf: 30,
      humidity: 55,
      probeLabel: "Garage",
    },
  ];

  it("summarizes freeze exposure against the user threshold", () => {
    expect(formatDigestFreezeLine(points, 34)).toContain("at or below 34°F");
    expect(formatDigestFreezeLine(points, 34)).toContain("30.0°F");
    expect(formatDigestFreezeLine(points, 20)).toBe(
      "Freeze exposure: none at or below 20°F",
    );
  });

  it("puts the coldest day in the subject line", () => {
    expect(formatWeeklyDigestSubject(points)).toMatch(
      /^Weekly digest — coldest Tue, Jan 6 30\.0°F$/,
    );
  });
});

describe("weekly digest layout", () => {
  const mixed: ChartPoint[] = [
    {
      timestamp: "2026-01-05T08:00:00Z",
      tempf: 40,
      humidity: 50,
      probeLabel: "Garage",
    },
    {
      timestamp: "2026-01-05T20:00:00Z",
      tempf: 50,
      humidity: 45,
      probeLabel: "Pipe bay",
    },
    {
      timestamp: "2026-01-06T04:00:00Z",
      tempf: 30,
      humidity: 55,
      probeLabel: "Garage",
    },
  ];

  it("builds HTML with sections, tables, and no catch-all bullet list", () => {
    const digest = buildWeeklyDigestParts({
      points: mixed,
      freezeThresholdF: 34,
      siteUrl: "https://thermaltrace.dev",
    });

    expect(digest.html).toContain("Freeze exposure");
    expect(digest.html).toContain("Highlights");
    expect(digest.html).toContain("By probe");
    expect(digest.html).toContain("Day by day");
    expect(digest.html).toContain("<th");
    expect(digest.html).toContain("Garage");
    expect(digest.html).toContain("Pipe bay");
    expect(digest.html).toContain("30.0°F");
    expect(digest.html).not.toContain("<ul");
    expect(digest.html).not.toContain("• Freeze exposure");
    expect(digest.text).toContain("By probe");
    expect(digest.text).toContain("Day by day");
    expect(digest.text).not.toContain("• Day by day:");
    expect(digest.notifyBody).toContain("Freeze exposure");
    expect(digest.subject).toContain("30.0°F");
  });

  it("uses a success freeze callout when nothing crossed the threshold", () => {
    const digest = buildWeeklyDigestParts({
      points: mixed.filter((point) => point.tempf > 34),
      freezeThresholdF: 34,
      siteUrl: "https://thermaltrace.dev",
    });
    expect(digest.html).toContain("None at or below 34°F");
    expect(digest.html).toContain("#22c55e");
  });
});
