import { describe, expect, it } from "vitest";
import {
  buildMonthlyReportHtmlDocument,
  buildMonthlyReportHtmlEmail,
  buildMonthlyReportPlainText,
  summarizeProbesForReport,
} from "./monthlyReportHtml";

const sampleData = {
  monthLabel: "August 2026",
  periodDays: 30,
  reportKind: "monthly" as const,
  readingCount: 42,
  minTempF: 28.5,
  maxTempF: 72.1,
  avgTempF: 48.3,
  freezeThresholdF: 34,
  nightsAtRisk: 2,
  nights: [
    { dateLabel: "Mon Aug 28", minTempF: 31, atRisk: true },
    { dateLabel: "Tue Aug 29", minTempF: 40, atRisk: false },
  ],
  freezeHours: {
    hoursBelow34: 12.5,
    degreeHoursBelow: 40,
    readingsBelow34: 8,
    totalReadings: 42,
    coldestF: 28.5,
  },
  probes: [
    {
      label: "Garage",
      minF: 28.5,
      maxF: 55,
      avgHumidity: 62,
      readingCount: 30,
    },
  ],
  alertsUrl: "https://example.com/dashboard/alerts",
  historyUrl: "https://example.com/dashboard/history",
};

describe("monthly report html", () => {
  it("summarizes probes", () => {
    const probes = summarizeProbesForReport([
      { timestamp: "t1", tempf: 40, humidity: 50, probeLabel: "A" },
      { timestamp: "t2", tempf: 50, humidity: 60, probeLabel: "A" },
    ]);
    expect(probes[0]?.minF).toBe(40);
    expect(probes[0]?.maxF).toBe(50);
  });

  it("includes stats in plain text", () => {
    const text = buildMonthlyReportPlainText(sampleData);
    expect(text).toContain("August 2026");
    expect(text).toContain("Readings (30-day)");
    expect(text).toContain("12.5");
    expect(text).toContain("HTML report is attached");
  });

  it("uses quarterly copy when reportKind is quarterly", () => {
    const text = buildMonthlyReportPlainText({
      ...sampleData,
      reportKind: "quarterly",
      periodDays: 90,
      monthLabel: "Q4 2025 (Oct–Dec)",
    });
    expect(text).toContain("quarterly report");
    expect(text).toContain("Readings (90-day)");
  });

  it("builds printable html document", () => {
    const html = buildMonthlyReportHtmlDocument(sampleData);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Garage");
    expect(html).toContain("At risk");
    expect(html).toContain("Print this page");
  });

  it("builds a sectioned email instead of a stats bullet list", () => {
    const html = buildMonthlyReportHtmlEmail(sampleData);
    expect(html).toContain("Freeze exposure");
    expect(html).toContain("12.5 h at or below 34°F");
    expect(html).toContain("Coldest");
    expect(html).toContain("28.5°F");
    expect(html).toContain("By probe");
    expect(html).toContain("Garage");
    expect(html).toContain("Forecast nights");
    expect(html).toContain("At risk");
    expect(html).not.toContain("<ul");
    expect(html).toContain("full HTML report is attached");
  });

  it("escapes probe labels in html", () => {
    const html = buildMonthlyReportHtmlDocument({
      ...sampleData,
      probes: [{ ...sampleData.probes[0]!, label: "<script>" }],
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
