import type { ChartPoint } from "./garageTempsHistory";

export type ProbeSpreadPoint = {
  timestamp: string;
  spreadF: number;
  minF: number;
  maxF: number;
  probeCount: number;
};

/** Bucket multi-probe readings and compute warmest−coldest spread over time. */
export function buildProbeSpreadSeries(
  points: ChartPoint[],
  bucketMs = 60 * 60 * 1000,
): ProbeSpreadPoint[] {
  if (points.length === 0 || bucketMs <= 0) return [];

  const buckets = new Map<number, Map<string, number[]>>();
  for (const point of points) {
    const ts = Date.parse(point.timestamp);
    if (!Number.isFinite(ts) || !Number.isFinite(point.tempf)) continue;
    const key = Math.floor(ts / bucketMs) * bucketMs;
    const byProbe = buckets.get(key) ?? new Map<string, number[]>();
    const label = point.probeLabel || "Probe";
    const list = byProbe.get(label) ?? [];
    list.push(point.tempf);
    byProbe.set(label, list);
    buckets.set(key, byProbe);
  }

  const series: ProbeSpreadPoint[] = [];
  for (const [bucketTs, byProbe] of [...buckets.entries()].sort((a, b) => a[0] - b[0])) {
    if (byProbe.size < 2) continue;
    const probeAvgs = [...byProbe.values()].map(
      (temps) => temps.reduce((sum, t) => sum + t, 0) / temps.length,
    );
    const minF = Math.min(...probeAvgs);
    const maxF = Math.max(...probeAvgs);
    series.push({
      timestamp: new Date(bucketTs).toISOString(),
      spreadF: maxF - minF,
      minF,
      maxF,
      probeCount: probeAvgs.length,
    });
  }
  return series;
}
