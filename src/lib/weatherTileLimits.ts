/**
 * Per-isolate abuse controls for the public OpenWeather tile proxy.
 * Maps request many tiles per pan/zoom; keep the budget well above city-search.
 */

export const WEATHER_TILE_RATE_LIMIT_WINDOW_MS = 60 * 1000;
export const WEATHER_TILE_RATE_LIMIT_MAX = 120;

type RateBucket = { count: number; resetAt: number };

const rateBuckets = new Map<string, RateBucket>();

export function resetWeatherTileRateLimitStateForTests(): void {
  rateBuckets.clear();
}

export function checkWeatherTileRateLimit(
  key: string,
  now = Date.now(),
): { ok: boolean; retryAfterSec?: number } {
  const existing = rateBuckets.get(key);
  if (!existing || now >= existing.resetAt) {
    rateBuckets.set(key, {
      count: 1,
      resetAt: now + WEATHER_TILE_RATE_LIMIT_WINDOW_MS,
    });
    return { ok: true };
  }

  if (existing.count >= WEATHER_TILE_RATE_LIMIT_MAX) {
    const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
    return { ok: false, retryAfterSec };
  }

  existing.count += 1;
  return { ok: true };
}
