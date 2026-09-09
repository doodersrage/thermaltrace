import { describe, expect, it } from "vitest";
import { shouldSendMonthlyReport } from "./monthlyReportEmails";

describe("shouldSendMonthlyReport", () => {
  it("runs on the 1st of the month at 08:00 UTC", () => {
    expect(shouldSendMonthlyReport(new Date("2026-04-01T08:00:00Z"))).toBe(true);
  });

  it("does not run on other days of the month", () => {
    expect(shouldSendMonthlyReport(new Date("2026-04-02T08:00:00Z"))).toBe(false);
    expect(shouldSendMonthlyReport(new Date("2026-03-31T08:00:00Z"))).toBe(false);
  });

  it("does not run at other hours on the 1st", () => {
    expect(shouldSendMonthlyReport(new Date("2026-04-01T07:00:00Z"))).toBe(false);
    expect(shouldSendMonthlyReport(new Date("2026-04-01T09:00:00Z"))).toBe(false);
  });
});
