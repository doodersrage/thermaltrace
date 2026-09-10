import { describe, expect, it } from "vitest";
import {
  getPinnedOverviewMetrics,
  isCriticalOverviewBanner,
  isDashboardQuietActive,
  parsePinnedOverviewMetricsInput,
  quietUntilSevenDaysFromNow,
  shouldForceSimpleOverview,
} from "./dashboardComfort";

describe("dashboardComfort", () => {
  it("forces simple overview for viewers", () => {
    expect(shouldForceSimpleOverview("viewer")).toBe(true);
    expect(shouldForceSimpleOverview("alert_only")).toBe(true);
    expect(shouldForceSimpleOverview("member")).toBe(false);
  });

  it("treats lowBattery and stale as critical", () => {
    expect(isCriticalOverviewBanner("lowBattery")).toBe(true);
    expect(isCriticalOverviewBanner("stale")).toBe(true);
    expect(isCriticalOverviewBanner("story")).toBe(false);
  });

  it("parses pinned metrics with max 5", () => {
    const parsed = parsePinnedOverviewMetricsInput([
      "last_reading",
      "sensors",
      "feeds",
      "alerts",
      "coldest_margin",
      "probe_spread",
      "bogus",
    ]);
    expect(parsed).toEqual([
      "last_reading",
      "sensors",
      "feeds",
      "alerts",
      "coldest_margin",
    ]);
  });

  it("reads quiet until from metadata", () => {
    const until = quietUntilSevenDaysFromNow(1_700_000_000_000);
    const user = {
      user_metadata: { dashboard_quiet_until: until },
    } as { user_metadata: Record<string, unknown> };
    expect(isDashboardQuietActive(user as never, 1_700_000_000_000)).toBe(true);
    expect(isDashboardQuietActive(user as never, 1_800_000_000_000)).toBe(false);
  });

  it("defaults pinned metrics when missing", () => {
    expect(getPinnedOverviewMetrics(null).length).toBeGreaterThan(0);
  });
});
