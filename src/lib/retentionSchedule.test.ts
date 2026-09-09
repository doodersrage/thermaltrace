import { describe, expect, it } from "vitest";
import {
  clampIsoToHistoryWindow,
  historyCutoffIso,
  RAW_READING_RETENTION_DAYS,
  shouldRunDailyRetention,
} from "./retentionSchedule";

describe("RAW_READING_RETENTION_DAYS", () => {
  it("is 90 days", () => {
    expect(RAW_READING_RETENTION_DAYS).toBe(90);
  });
});

describe("shouldRunDailyRetention", () => {
  it("is true only at 03:00 UTC", () => {
    expect(shouldRunDailyRetention(new Date("2024-06-15T03:00:00.000Z"))).toBe(true);
    expect(shouldRunDailyRetention(new Date("2024-06-15T03:59:59.000Z"))).toBe(true);
  });

  it("is false outside the 03:00 UTC hour", () => {
    expect(shouldRunDailyRetention(new Date("2024-06-15T02:59:59.000Z"))).toBe(false);
    expect(shouldRunDailyRetention(new Date("2024-06-15T04:00:00.000Z"))).toBe(false);
    expect(shouldRunDailyRetention(new Date("2024-06-15T15:00:00.000Z"))).toBe(false);
  });
});

describe("historyCutoffIso", () => {
  it("subtracts the given number of days in UTC", () => {
    expect(historyCutoffIso(30, new Date("2024-06-15T12:00:00.000Z"))).toBe(
      "2024-05-16T12:00:00.000Z",
    );
  });

  it("rolls back across a month/year boundary", () => {
    expect(historyCutoffIso(10, new Date("2024-01-05T00:00:00.000Z"))).toBe(
      "2023-12-26T00:00:00.000Z",
    );
  });
});

describe("clampIsoToHistoryWindow", () => {
  const now = new Date("2024-06-15T12:00:00.000Z");

  it("returns the cutoff when no `from` is given", () => {
    expect(clampIsoToHistoryWindow(undefined, 30, now)).toBe("2024-05-16T12:00:00.000Z");
  });

  it("clamps a `from` that is older than the plan window up to the cutoff", () => {
    expect(clampIsoToHistoryWindow("2020-01-01T00:00:00.000Z", 30, now)).toBe(
      "2024-05-16T12:00:00.000Z",
    );
  });

  it("keeps a `from` that already falls within the plan window", () => {
    expect(clampIsoToHistoryWindow("2024-06-01T00:00:00.000Z", 30, now)).toBe(
      "2024-06-01T00:00:00.000Z",
    );
  });
});
