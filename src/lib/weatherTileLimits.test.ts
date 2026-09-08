import { afterEach, describe, expect, it } from "vitest";
import {
  checkWeatherTileRateLimit,
  resetWeatherTileRateLimitStateForTests,
  WEATHER_TILE_RATE_LIMIT_MAX,
} from "./weatherTileLimits";

afterEach(() => {
  resetWeatherTileRateLimitStateForTests();
});

describe("weather tile rate limit", () => {
  it("allows a burst then blocks", () => {
    const now = Date.parse("2026-09-08T12:00:00.000Z");
    for (let i = 0; i < WEATHER_TILE_RATE_LIMIT_MAX; i += 1) {
      expect(checkWeatherTileRateLimit("1.1.1.1", now).ok).toBe(true);
    }
    const blocked = checkWeatherTileRateLimit("1.1.1.1", now);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("isolates keys", () => {
    const now = Date.parse("2026-09-08T12:00:00.000Z");
    for (let i = 0; i < WEATHER_TILE_RATE_LIMIT_MAX; i += 1) {
      expect(checkWeatherTileRateLimit("a", now).ok).toBe(true);
    }
    expect(checkWeatherTileRateLimit("b", now).ok).toBe(true);
  });
});
