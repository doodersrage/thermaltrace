import { describe, expect, it } from "vitest";
import { computeGarageRiskStatus } from "./garageRiskStatus";

const base = {
  hasDevices: true,
  hasLiveReading: true,
  coldestProbeTempF: 45,
  freezeThresholdF: 34,
  staleSensorCount: 0,
  nightsRiskCount: 0,
  alertsEnabled: true,
  hasEmailAlerts: true,
  outdoorTempF: 40,
  showColdSnapChecklist: false,
};

describe("computeGarageRiskStatus", () => {
  it("asks for a device when none exist", () => {
    const status = computeGarageRiskStatus({ ...base, hasDevices: false });
    expect(status.level).toBe("watch");
    expect(status.actionHref).toContain("devices");
  });

  it("flags freeze risk when coldest probe is at threshold", () => {
    const status = computeGarageRiskStatus({
      ...base,
      coldestProbeTempF: 32,
    });
    expect(status.level).toBe("risk");
  });

  it("flags a remaining-hours freeze clock before threshold", () => {
    const status = computeGarageRiskStatus({
      ...base,
      hoursUntilFreeze: 3.2,
      hitsAtLabel: "4:12 AM",
    });
    expect(status.level).toBe("risk");
    expect(status.detail).toMatch(/4:12 AM/);
    expect(status.actionHref).toBe("#time-to-freeze");
  });

  it("returns ok when readings and alerts are healthy", () => {
    const status = computeGarageRiskStatus(base);
    expect(status.level).toBe("ok");
    expect(status.actionHref).toBe("/dashboard/live");
  });

  it("sends near-freeze watch to Live, not marketing home", () => {
    const status = computeGarageRiskStatus({ ...base, coldestProbeTempF: 36 });
    expect(status.level).toBe("watch");
    expect(status.actionHref).toBe("/dashboard/live");
  });

  it("treats stale probes as likely unplugged", () => {
    const status = computeGarageRiskStatus({ ...base, staleSensorCount: 2 });
    expect(status.level).toBe("watch");
    expect(status.title).toMatch(/unplugged/i);
    expect(status.detail).toMatch(/stale/i);
  });

  it("prioritizes wet flood contacts as risk", () => {
    const status = computeGarageRiskStatus({ ...base, wetFloodCount: 1 });
    expect(status.level).toBe("risk");
    expect(status.title).toMatch(/flood|leak|wet/i);
    expect(status.actionHref).toBe("/dashboard/live");
  });

  it("sends nights-at-risk to Live when the checklist is off the page", () => {
    const status = computeGarageRiskStatus({ ...base, nightsRiskCount: 2 });
    expect(status.level).toBe("watch");
    expect(status.actionHref).toBe("/dashboard/live");
  });

  it("links cold-snap checklist only when that card is shown", () => {
    const status = computeGarageRiskStatus({
      ...base,
      showColdSnapChecklist: true,
    });
    expect(status.actionHref).toBe("#cold-snap");
  });

  it("prefers the checklist hash when nights-at-risk and the card is on the page", () => {
    const status = computeGarageRiskStatus({
      ...base,
      nightsRiskCount: 2,
      showColdSnapChecklist: true,
    });
    expect(status.actionHref).toBe("#cold-snap");
  });

  it("nudges alert setup when space is otherwise fine", () => {
    const status = computeGarageRiskStatus({
      ...base,
      alertsEnabled: false,
      hasEmailAlerts: false,
    });
    expect(status.level).toBe("watch");
    expect(status.actionHref).toContain("alerts");
    expect(status.actionHref).toContain("tab=settings");
  });
});
