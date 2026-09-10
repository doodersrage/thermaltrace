import { describe, expect, it } from "vitest";
import {
  adminTabIdFromPath,
  isAdminDashboardPath,
  mobileMonitorHrefs,
  newestRecordedAt,
} from "./dashboardNav";

describe("isAdminDashboardPath", () => {
  it("matches admin hub routes", () => {
    expect(isAdminDashboardPath("/dashboard/ops")).toBe(true);
    expect(isAdminDashboardPath("/dashboard/feeds")).toBe(true);
    expect(isAdminDashboardPath("/dashboard/users")).toBe(true);
    expect(isAdminDashboardPath("/dashboard")).toBe(false);
    expect(isAdminDashboardPath("/dashboard/alerts")).toBe(false);
  });
});

describe("adminTabIdFromPath", () => {
  it("resolves the longest matching tab", () => {
    expect(adminTabIdFromPath("/dashboard/ops")).toBe("ops");
    expect(adminTabIdFromPath("/dashboard/email-suppressions")).toBe("email");
    expect(adminTabIdFromPath("/dashboard/alerts")).toBe("ops");
  });
});

describe("mobileMonitorHrefs", () => {
  it("swaps History for Portfolio when portfolio is in Monitor", () => {
    expect(mobileMonitorHrefs(false)).toEqual([
      "/dashboard",
      "/dashboard/live",
      "/dashboard/devices",
      "/dashboard/alerts",
      "/dashboard/history",
    ]);
    expect(mobileMonitorHrefs(true)).toEqual([
      "/dashboard",
      "/dashboard/live",
      "/dashboard/portfolio",
      "/dashboard/devices",
      "/dashboard/alerts",
    ]);
  });
});

describe("newestRecordedAt", () => {
  it("returns the latest recorded_at", () => {
    expect(newestRecordedAt([])).toBeNull();
    expect(
      newestRecordedAt([
        { recorded_at: "2026-01-01T00:00:00Z" },
        { recorded_at: "2026-01-02T00:00:00Z" },
        { recorded_at: null },
      ]),
    ).toBe("2026-01-02T00:00:00Z");
  });
});
