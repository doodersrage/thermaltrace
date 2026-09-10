import { staleProbeDetail, wetFloodDetail } from "./falseAlarmHints";

/**
 * Single Overview status: is the monitored space OK, worth watching, or at freeze/flood risk?
 */

export type GarageRiskLevel = "ok" | "watch" | "risk" | "offline";

export type GarageRiskStatus = {
  level: GarageRiskLevel;
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
};

export function computeGarageRiskStatus(input: {
  hasDevices: boolean;
  hasLiveReading: boolean;
  coldestProbeTempF: number | null;
  freezeThresholdF: number;
  staleSensorCount: number;
  nightsRiskCount: number;
  alertsEnabled: boolean;
  hasEmailAlerts: boolean;
  outdoorTempF: number | null;
  showColdSnapChecklist: boolean;
  hoursUntilFreeze?: number | null;
  hitsAtLabel?: string | null;
  /** Currently wet flood/leak contacts (from latest readings). */
  wetFloodCount?: number;
}): GarageRiskStatus {
  if (!input.hasDevices) {
    return {
      level: "watch",
      title: "Add a probe to start",
      detail: "Create a push device, then POST a reading, or try the demo feed without hardware.",
      actionLabel: "Connect a device",
      actionHref: "/dashboard/devices",
    };
  }

  if (!input.hasLiveReading) {
    return {
      level: "offline",
      title: "Waiting for a reading",
      detail:
        "Your device is set up but has not reported yet. Finish ingest, then confirm freeze and flood alerts.",
      actionLabel: "Finish device setup",
      actionHref: "/dashboard/devices",
    };
  }

  const wetCount = input.wetFloodCount ?? 0;
  if (wetCount > 0) {
    return {
      level: "risk",
      title: wetCount === 1 ? "Flood / leak wet now" : "Flood / leak sensors wet",
      detail: wetFloodDetail(wetCount),
      actionLabel: "Open flood card",
      actionHref: "#flood-level",
    };
  }

  if (input.staleSensorCount > 0) {
    return {
      level: "watch",
      title: "Probe may be unplugged",
      detail: staleProbeDetail(input.staleSensorCount),
      actionLabel: "Check devices",
      actionHref: "/dashboard/devices",
    };
  }

  const belowFreeze =
    input.coldestProbeTempF != null &&
    Number.isFinite(input.coldestProbeTempF) &&
    input.coldestProbeTempF <= input.freezeThresholdF;

  if (belowFreeze) {
    return {
      level: "risk",
      title: "Freeze risk right now",
      detail: `Coldest probe is ${input.coldestProbeTempF!.toFixed(1)}°F (threshold ${input.freezeThresholdF}°F).`,
      actionLabel: "Open alerts",
      actionHref: "/dashboard/alerts",
    };
  }

  const hoursUntil = input.hoursUntilFreeze;
  if (hoursUntil != null && Number.isFinite(hoursUntil) && hoursUntil > 0) {
    const clock = input.hitsAtLabel ? ` around ${input.hitsAtLabel}` : "";
    if (hoursUntil <= 4) {
      return {
        level: "risk",
        title: "Freeze in a few hours",
        detail: `This space is projected to hit ${input.freezeThresholdF}°F${clock}. Drip faucets or turn on heat while you still have time.`,
        actionLabel: "Open time to freeze",
        actionHref: "#time-to-freeze",
      };
    }
    if (hoursUntil <= 12) {
      return {
        level: "watch",
        title: input.hitsAtLabel
          ? `Freeze around ${input.hitsAtLabel}`
          : "Freeze later today",
        detail: `About ${hoursUntil < 10 ? hoursUntil.toFixed(1) : Math.round(hoursUntil)} hours until ${input.freezeThresholdF}°F at this space's lag vs outdoor.`,
        actionLabel: "Open time to freeze",
        actionHref: "#time-to-freeze",
      };
    }
  }

  if (input.showColdSnapChecklist || input.nightsRiskCount > 0) {
    return {
      level: "watch",
      title:
        input.nightsRiskCount > 0
          ? `${input.nightsRiskCount} night${input.nightsRiskCount === 1 ? "" : "s"} at freeze risk`
          : "Cold snap ahead",
      detail: "Outdoor conditions look cold: run the checklist and confirm forecast alerts are on.",
      actionLabel: "Cold-snap checklist",
      actionHref: "#cold-snap",
    };
  }

  if (!input.alertsEnabled || !input.hasEmailAlerts) {
    return {
      level: "watch",
      title: "Space looks fine: finish alerts",
      detail:
        "Turn on alerts and email so freeze and flood reach you: wet contacts auto-notify once alerts are on.",
      actionLabel: "Set freeze + email",
      actionHref: "/dashboard/alerts#alert-section-essentials",
    };
  }

  const nearFreeze =
    input.coldestProbeTempF != null &&
    Number.isFinite(input.coldestProbeTempF) &&
    input.coldestProbeTempF <= input.freezeThresholdF + 5;

  if (nearFreeze) {
    return {
      level: "watch",
      title: "Close to freeze threshold",
      detail: `Coldest probe ${input.coldestProbeTempF!.toFixed(1)}°F, within 5°F of ${input.freezeThresholdF}°F.`,
      actionLabel: "View Home",
      actionHref: "/",
    };
  }

  return {
    level: "ok",
    title: "Looking good",
    detail: "Probes are reporting: nothing at freeze threshold, no wet flood contacts.",
    actionLabel: "View Home",
    actionHref: "/",
  };
}
