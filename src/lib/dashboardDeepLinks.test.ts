import { describe, expect, it } from "vitest";
import {
  alertsActivityPath,
  alertsSettingsPath,
  devicesOpsPath,
  devicesSetupPath,
  historyExportsPath,
} from "./dashboardDeepLinks";

describe("dashboardDeepLinks", () => {
  it("puts alert hashes on the Settings tab", () => {
    expect(alertsSettingsPath("alert-section-essentials")).toBe(
      "/dashboard/alerts?tab=settings#alert-section-essentials",
    );
    expect(alertsSettingsPath("#send-test-alert")).toBe(
      "/dashboard/alerts?tab=settings#send-test-alert",
    );
  });

  it("opens Alerts Activity without a hash", () => {
    expect(alertsActivityPath()).toBe("/dashboard/alerts?tab=activity");
  });

  it("puts claims pack on History Exports", () => {
    expect(historyExportsPath()).toBe("/dashboard/history?tab=exports#claims-pack");
  });

  it("opens Devices Status vs Setup", () => {
    expect(devicesOpsPath()).toBe("/dashboard/devices?view=ops");
    expect(devicesSetupPath()).toBe("/dashboard/devices?view=setup");
    expect(devicesSetupPath({ tab: "pull", hash: "indoor-reference" })).toBe(
      "/dashboard/devices?view=setup&tab=pull#indoor-reference",
    );
  });
});
