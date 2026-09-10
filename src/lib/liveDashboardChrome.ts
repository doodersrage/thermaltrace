/** Custom events for Live page chrome without a full reload. */
export const LIVE_READINGS_EVENT = "tt:live-readings";
export const LIVE_REFRESH_EVENT = "tt:live-refresh";

export type LiveReadingsDetail = {
  lastReadingAt: string | null;
  sensorCount: number;
};

export function newestLiveReadingAt(
  sensors: Array<{ recorded_at: string | null | undefined }>,
  fallback: string | null = null,
): string | null {
  let newest: string | null = null;
  let newestMs = Number.NEGATIVE_INFINITY;
  for (const sensor of sensors) {
    if (!sensor.recorded_at) continue;
    const ms = Date.parse(sensor.recorded_at);
    if (!Number.isFinite(ms) || ms <= newestMs) continue;
    newestMs = ms;
    newest = sensor.recorded_at;
  }
  return newest ?? fallback;
}
