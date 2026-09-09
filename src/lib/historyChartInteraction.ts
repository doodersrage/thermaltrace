export type ChartSeriesPoint = {
  timestamp: string;
  tempf: number;
  humidity: number;
  probeLabel: string;
};

export type HoverSeriesHit = {
  probeLabel: string;
  color: string;
  tempf: number;
  humidity: number;
  timestamp: string;
  dewPointF: number | null;
};

export type PlotBounds = {
  padLeft: number;
  padRight: number;
  padTop: number;
  padBottom: number;
  width: number;
  height: number;
  minTs: number;
  maxTs: number;
  minTemp: number;
  maxTemp: number;
};

export type TimeWindow = {
  minTs: number;
  maxTs: number;
};

/** Narrowest zoom span (15 minutes). */
export const MIN_ZOOM_SPAN_MS = 15 * 60 * 1000;

/** Map a CSS-pixel x on the canvas to a timestamp along the plot domain. */
export function xToTimestamp(x: number, bounds: PlotBounds): number | null {
  const innerW = bounds.width - bounds.padLeft - bounds.padRight;
  if (innerW <= 0) return null;
  const clamped = Math.min(Math.max(x, bounds.padLeft), bounds.width - bounds.padRight);
  const t = (clamped - bounds.padLeft) / innerW;
  const tsRange = bounds.maxTs - bounds.minTs || 1;
  return bounds.minTs + t * tsRange;
}

export function timestampToX(ts: number, bounds: PlotBounds): number {
  const innerW = bounds.width - bounds.padLeft - bounds.padRight;
  const tsRange = bounds.maxTs - bounds.minTs || 1;
  return bounds.padLeft + ((ts - bounds.minTs) / tsRange) * innerW;
}

export function tempToY(tempf: number, bounds: PlotBounds): number {
  const innerH = bounds.height - bounds.padTop - bounds.padBottom;
  const range = bounds.maxTemp - bounds.minTemp || 1;
  return bounds.padTop + innerH - ((tempf - bounds.minTemp) / range) * innerH;
}

/** Closest point in a series by timestamp (series should be time-sorted). */
export function nearestPointByTime(
  series: ChartSeriesPoint[],
  targetTs: number,
): ChartSeriesPoint | null {
  if (series.length === 0) return null;
  let best = series[0]!;
  let bestDelta = Math.abs(Date.parse(best.timestamp) - targetTs);
  for (let i = 1; i < series.length; i++) {
    const point = series[i]!;
    const delta = Math.abs(Date.parse(point.timestamp) - targetTs);
    if (delta < bestDelta) {
      best = point;
      bestDelta = delta;
    }
  }
  return best;
}

export function collectHoverHits(options: {
  targetTs: number;
  byProbe: Map<string, ChartSeriesPoint[]>;
  probeColors: string[];
  visibleProbes: Set<string>;
  housePoints?: ChartSeriesPoint[];
  houseLegend?: string | null;
  houseColor?: string;
  dewPointF?: (tempF: number, rhPct: number) => number | null;
}): HoverSeriesHit[] {
  const {
    targetTs,
    byProbe,
    probeColors,
    visibleProbes,
    housePoints = [],
    houseLegend = "House",
    houseColor = "#f59e0b",
    dewPointF,
  } = options;

  const hits: HoverSeriesHit[] = [];
  let colorIndex = 0;
  for (const [label, series] of byProbe.entries()) {
    const color = probeColors[colorIndex % probeColors.length]!;
    colorIndex += 1;
    if (!visibleProbes.has(label)) continue;
    const nearest = nearestPointByTime(series, targetTs);
    if (!nearest) continue;
    hits.push({
      probeLabel: label,
      color,
      tempf: nearest.tempf,
      humidity: nearest.humidity,
      timestamp: nearest.timestamp,
      dewPointF:
        dewPointF && Number.isFinite(nearest.humidity) && nearest.humidity > 0
          ? dewPointF(nearest.tempf, nearest.humidity)
          : null,
    });
  }

  if (housePoints.length > 0) {
    const nearest = nearestPointByTime(housePoints, targetTs);
    if (nearest) {
      hits.push({
        probeLabel: houseLegend ?? "House",
        color: houseColor,
        tempf: nearest.tempf,
        humidity: nearest.humidity,
        timestamp: nearest.timestamp,
        dewPointF: null,
      });
    }
  }

  return hits;
}

export function formatHoverTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function timeDomainFromPoints(
  points: Array<{ timestamp: string }>,
): TimeWindow | null {
  if (points.length === 0) return null;
  let minTs = Number.POSITIVE_INFINITY;
  let maxTs = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    const ts = Date.parse(point.timestamp);
    if (!Number.isFinite(ts)) continue;
    if (ts < minTs) minTs = ts;
    if (ts > maxTs) maxTs = ts;
  }
  if (!Number.isFinite(minTs) || !Number.isFinite(maxTs)) return null;
  if (maxTs <= minTs) maxTs = minTs + 1;
  return { minTs, maxTs };
}

export function clampTimeWindow(
  view: TimeWindow,
  domain: TimeWindow,
  minSpanMs: number = MIN_ZOOM_SPAN_MS,
): TimeWindow {
  const domainSpan = Math.max(domain.maxTs - domain.minTs, 1);
  const minSpan = Math.min(Math.max(minSpanMs, 1), domainSpan);
  let span = Math.max(view.maxTs - view.minTs, minSpan);
  span = Math.min(span, domainSpan);
  let minTs = view.minTs;
  let maxTs = minTs + span;
  if (maxTs > domain.maxTs) {
    maxTs = domain.maxTs;
    minTs = maxTs - span;
  }
  if (minTs < domain.minTs) {
    minTs = domain.minTs;
    maxTs = minTs + span;
  }
  return { minTs, maxTs };
}

/**
 * Zoom a time window around an anchor timestamp.
 * `factor` < 1 zooms in; `factor` > 1 zooms out.
 */
export function zoomTimeWindow(
  view: TimeWindow,
  domain: TimeWindow,
  anchorTs: number,
  factor: number,
  minSpanMs: number = MIN_ZOOM_SPAN_MS,
): TimeWindow {
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
  const span = Math.max(view.maxTs - view.minTs, 1);
  const anchor = Math.min(Math.max(anchorTs, view.minTs), view.maxTs);
  const leftRatio = (anchor - view.minTs) / span;
  const nextSpan = span * safeFactor;
  const next: TimeWindow = {
    minTs: anchor - nextSpan * leftRatio,
    maxTs: anchor + nextSpan * (1 - leftRatio),
  };
  return clampTimeWindow(next, domain, minSpanMs);
}

export function panTimeWindow(
  view: TimeWindow,
  domain: TimeWindow,
  deltaTs: number,
): TimeWindow {
  return clampTimeWindow(
    {
      minTs: view.minTs + deltaTs,
      maxTs: view.maxTs + deltaTs,
    },
    domain,
    view.maxTs - view.minTs,
  );
}

export function isFullyZoomedOut(
  view: TimeWindow,
  domain: TimeWindow,
  epsilonMs: number = 1,
): boolean {
  return (
    Math.abs(view.minTs - domain.minTs) <= epsilonMs &&
    Math.abs(view.maxTs - domain.maxTs) <= epsilonMs
  );
}

export function formatAxisTime(ts: number, spanMs: number): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  if (spanMs <= 36 * 60 * 60 * 1000) {
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString();
}

export const CHART_VIEW_PRESETS = [
  { id: "24h", label: "24h", spanMs: 24 * 60 * 60 * 1000 },
  { id: "7d", label: "7d", spanMs: 7 * 24 * 60 * 60 * 1000 },
  { id: "30d", label: "30d", spanMs: 30 * 24 * 60 * 60 * 1000 },
] as const;

export type ChartViewPresetId = (typeof CHART_VIEW_PRESETS)[number]["id"];

/** Trailing window ending at domain.maxTs, clamped to available data. */
export function windowForTrailingSpan(
  domain: TimeWindow,
  spanMs: number,
): TimeWindow {
  const domainSpan = Math.max(domain.maxTs - domain.minTs, 1);
  const safeSpan = Math.max(1, Math.min(spanMs, domainSpan));
  return clampTimeWindow(
    {
      minTs: domain.maxTs - safeSpan,
      maxTs: domain.maxTs,
    },
    domain,
    Math.min(MIN_ZOOM_SPAN_MS, safeSpan),
  );
}

export function matchingPresetId(
  view: TimeWindow | null,
  domain: TimeWindow,
  epsilonMs: number = 60_000,
): ChartViewPresetId | "all" | "custom" {
  if (!view || isFullyZoomedOut(view, domain, epsilonMs)) return "all";
  const span = view.maxTs - view.minTs;
  const endDelta = Math.abs(view.maxTs - domain.maxTs);
  for (const preset of CHART_VIEW_PRESETS) {
    const targetSpan = Math.min(preset.spanMs, domain.maxTs - domain.minTs);
    if (endDelta <= epsilonMs && Math.abs(span - targetSpan) <= epsilonMs) {
      return preset.id;
    }
  }
  return "custom";
}

/** Convert a horizontal brush in CSS pixels into a clamped time window. */
export function brushPixelsToWindow(
  x0: number,
  x1: number,
  bounds: PlotBounds,
  domain: TimeWindow,
  minPixelWidth: number = 10,
): TimeWindow | null {
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  if (right - left < minPixelWidth) return null;
  const t0 = xToTimestamp(left, bounds);
  const t1 = xToTimestamp(right, bounds);
  if (t0 == null || t1 == null) return null;
  return clampTimeWindow(
    { minTs: Math.min(t0, t1), maxTs: Math.max(t0, t1) },
    domain,
  );
}

export function downloadCanvasPng(
  canvas: HTMLCanvasElement,
  filename: string,
): boolean {
  try {
    const href = canvas.toDataURL("image/png");
    if (!href || href === "data:,") return false;
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return true;
  } catch {
    return false;
  }
}
