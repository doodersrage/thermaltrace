/**
 * Copy helpers for noisy alerts — freeze placement, leak contact bounce, and smarter snooze.
 */

export type FalseAlarmHint = {
  id: string;
  title: string;
  detail: string;
  href?: string;
  hrefLabel?: string;
};

/** Tips shown on Alerts when users are fighting repeat freeze noise. */
export const FALSE_ALARM_TIPS: FalseAlarmHint[] = [
  {
    id: "placement",
    title: "Check probe placement",
    detail:
      "Probes on door tracks, near exhaust fans, or in sun-loaded walls swing hard and trip freeze alerts that the pipes never see. Move toward the coldest pipe run or slab corner.",
    href: "/about/probe-demo",
    hrefLabel: "Probe simulator",
  },
  {
    id: "unplugged",
    title: "Stale often means unplugged",
    detail:
      "If a probe goes quiet for hours, treat it as power/Wi‑Fi first, not a freeze. Enable outage alerts and confirm the ESP still POSTs from Devices.",
    href: "/about/debugging-stale-readings",
    hrefLabel: "Stale readings guide",
  },
  {
    id: "threshold",
    title: "Raise the threshold a degree or two",
    detail:
      "A 32°F trip fires on every brief draft. Many households use 34–36°F so they act before ice forms without waking for every door open.",
    href: "/dashboard/alerts#alert-section-essentials",
    hrefLabel: "Alert essentials",
  },
  {
    id: "snooze",
    title: "Snooze while you fix it",
    detail:
      "Working in a cold bay? Snooze 4–24 hours so threshold noise stops while you weatherstrip, drip faucets, or reseat the probe: forecast and flood alerts still get through on vacation mode.",
  },
];

/** Tips for wet-contact / sump noise (flood still bypasses snooze). */
export const FLOOD_FALSE_ALARM_TIPS: FalseAlarmHint[] = [
  {
    id: "splash",
    title: "Splash and condensation bounce",
    detail:
      "A contact under a water heater or laundry tub can flicker wet from condensation or a drip that already stopped. Mount on the pan floor away from drip lines, and wipe/dry after a false trip.",
  },
  {
    id: "sump_cycle",
    title: "Sump duty cycle ≠ leak",
    detail:
      "Rising sump level during a storm is normal. Use a flood/leak contact for standing water, and a custom level_above rule only if you want pump-failure early warning, not every pump cycle.",
    href: "/dashboard/alerts#alert-section-rules",
    hrefLabel: "Alert rules",
  },
  {
    id: "test_wet",
    title: "Test with a damp cloth, then dry",
    detail:
      "Flood alerts fire automatically when wet (even during vacation). After a placement test, dry the contact so you do not leave a sticky wet state overnight.",
  },
];

export function staleProbeDetail(staleCount: number): string {
  const n = Math.max(1, staleCount);
  const probe = n === 1 ? "probe looks" : "probes look";
  return `${n} ${probe} stale: likely unplugged, offline Wi‑Fi, or a dead battery. Check power and Devices before treating it as a freeze.`;
}

export function likelyFalseAlarmFromStale(staleSensorCount: number): boolean {
  return staleSensorCount > 0;
}

export function wetFloodDetail(wetCount: number): string {
  const n = Math.max(1, wetCount);
  const sensor = n === 1 ? "flood/leak sensor is" : "flood/leak sensors are";
  return `${n} ${sensor} wet right now: flood alerts bypass snooze and vacation. Check the pan, sump, or supply line.`;
}

export function suggestFalseAlarmTip(kind: string): FalseAlarmHint {
  if (kind === "flood") {
    return FLOOD_FALSE_ALARM_TIPS[0] ?? FALSE_ALARM_TIPS[0]!;
  }
  if (kind === "outage" || kind.includes("stale")) {
    return FALSE_ALARM_TIPS.find((t) => t.id === "unplugged") ?? FALSE_ALARM_TIPS[0]!;
  }
  return FALSE_ALARM_TIPS.find((t) => t.id === "threshold") ?? FALSE_ALARM_TIPS[0]!;
}

export function formatAlertWhyMeta(meta: {
  thresholdF?: number;
  probeLabel?: string;
  probeTempF?: number;
  outdoorTempF?: number | null;
  deltaTF?: number | null;
  runwayHours?: number | null;
  doorOpen?: boolean;
  reasonSummary?: string;
}): string | null {
  if (meta.reasonSummary?.trim()) return meta.reasonSummary.trim();
  const parts: string[] = [];
  if (meta.probeLabel && meta.probeTempF != null) {
    parts.push(`${meta.probeLabel} at ${meta.probeTempF.toFixed(1)}°F`);
  } else if (meta.probeTempF != null) {
    parts.push(`Probe at ${meta.probeTempF.toFixed(1)}°F`);
  }
  if (meta.thresholdF != null) {
    parts.push(`threshold ${meta.thresholdF}°F`);
  }
  if (meta.outdoorTempF != null) {
    parts.push(`outdoor ${meta.outdoorTempF.toFixed(0)}°F`);
  }
  if (meta.deltaTF != null) {
    parts.push(`ΔT ${meta.deltaTF >= 0 ? "+" : ""}${meta.deltaTF.toFixed(1)}°F`);
  }
  if (meta.runwayHours != null) {
    parts.push(`~${meta.runwayHours.toFixed(1)}h runway`);
  }
  if (meta.doorOpen) parts.push("door open nearby");
  return parts.length > 0 ? parts.join(" · ") : null;
}
