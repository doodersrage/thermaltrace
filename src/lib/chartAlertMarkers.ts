import { CLAIMS_CRITICAL_KINDS } from "./claimsPack";
import type { AlertEventRow } from "./alertEvents";
import { timestampToX, type PlotBounds } from "./historyChartInteraction";

/** Lightweight alert tick for history canvas overlays. */
export type ChartAlertMarker = {
  id: number;
  createdAt: string;
  kind: string;
  title: string;
  acknowledgedAt?: string | null;
};

const MARKER_COLORS: Record<string, string> = {
  threshold: "#38bdf8",
  flood: "#60a5fa",
  rate: "#f472b6",
  nws: "#fbbf24",
  forecast: "#a78bfa",
  runway: "#fb923c",
};

export function alertMarkerColor(kind: string): string {
  return MARKER_COLORS[kind] ?? "#94a3b8";
}

/** Map DB rows to chart markers; defaults to claims-critical kinds. */
export function toChartAlertMarkers(
  events: AlertEventRow[],
  kinds: Set<string> = CLAIMS_CRITICAL_KINDS,
): ChartAlertMarker[] {
  return events
    .filter((event) => kinds.has(event.kind))
    .map((event) => ({
      id: event.id,
      createdAt: event.created_at,
      kind: event.kind,
      title: event.title,
      acknowledgedAt: event.acknowledged_at,
    }));
}

/** Draw vertical alert ticks along the top of the plot. */
export function drawAlertMarkers(
  g: CanvasRenderingContext2D,
  markers: ChartAlertMarker[],
  bounds: PlotBounds,
  options?: { highlightId?: number | null },
): void {
  const top = bounds.padTop;
  const bottom = bounds.height - bounds.padBottom;
  for (const marker of markers) {
    const ts = Date.parse(marker.createdAt);
    if (!Number.isFinite(ts) || ts < bounds.minTs || ts > bounds.maxTs) continue;
    const x = timestampToX(ts, bounds);
    const color = alertMarkerColor(marker.kind);
    const highlight = options?.highlightId === marker.id;
    const alpha = marker.acknowledgedAt ? 0.45 : highlight ? 1 : 0.85;

    g.save();
    g.globalAlpha = alpha;
    g.strokeStyle = color;
    g.fillStyle = color;
    g.lineWidth = highlight ? 2 : 1;
    g.setLineDash(marker.acknowledgedAt ? [2, 3] : []);
    g.beginPath();
    g.moveTo(x, top);
    g.lineTo(x, bottom);
    g.stroke();
    g.setLineDash([]);

    // Triangle tick at the top edge.
    const size = highlight ? 7 : 5;
    g.beginPath();
    g.moveTo(x, top);
    g.lineTo(x - size, top + size * 1.4);
    g.lineTo(x + size, top + size * 1.4);
    g.closePath();
    g.fill();
    g.restore();
  }
}

/** Nearest marker within `maxPx` of a canvas-local x. */
export function nearestAlertMarker(
  markers: ChartAlertMarker[],
  bounds: PlotBounds,
  localX: number,
  maxPx = 10,
): ChartAlertMarker | null {
  let best: ChartAlertMarker | null = null;
  let bestDelta = maxPx;
  for (const marker of markers) {
    const ts = Date.parse(marker.createdAt);
    if (!Number.isFinite(ts) || ts < bounds.minTs || ts > bounds.maxTs) continue;
    const x = timestampToX(ts, bounds);
    const delta = Math.abs(x - localX);
    if (delta <= bestDelta) {
      best = marker;
      bestDelta = delta;
    }
  }
  return best;
}
