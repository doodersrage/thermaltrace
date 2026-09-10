import { describe, expect, it } from "vitest";
import { kioskLandingPath, kioskRouteToRecord } from "./dashboardKiosk";

describe("kioskLandingPath", () => {
  it("stays on Live", () => {
    expect(kioskLandingPath("/dashboard/live", null)).toBe("/dashboard/live");
    expect(kioskLandingPath("/dashboard/live/", "/dashboard/portfolio")).toBe(
      "/dashboard/live",
    );
  });

  it("uses last Live or Portfolio route from Overview", () => {
    expect(kioskLandingPath("/dashboard", "/dashboard/live")).toBe(
      "/dashboard/live",
    );
    expect(kioskLandingPath("/dashboard", "/dashboard/portfolio")).toBe(
      "/dashboard/portfolio",
    );
  });

  it("stays on Portfolio when already there", () => {
    expect(kioskLandingPath("/dashboard/portfolio", "/dashboard/live")).toBe(
      "/dashboard/portfolio",
    );
  });

  it("defaults to Live from account pages", () => {
    expect(kioskLandingPath("/dashboard/settings", null)).toBe("/dashboard/live");
    expect(kioskLandingPath("/dashboard/alerts", "/dashboard/settings")).toBe(
      "/dashboard/live",
    );
  });
});

describe("kioskRouteToRecord", () => {
  it("records glance pages only", () => {
    expect(kioskRouteToRecord("/dashboard/live")).toBe("/dashboard/live");
    expect(kioskRouteToRecord("/dashboard/portfolio")).toBe(
      "/dashboard/portfolio",
    );
    expect(kioskRouteToRecord("/dashboard")).toBeNull();
    expect(kioskRouteToRecord("/dashboard/settings")).toBeNull();
  });
});
