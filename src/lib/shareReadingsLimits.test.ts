import { beforeEach, describe, expect, it } from "vitest";
import {
  SHARE_READINGS_RATE_LIMIT_MAX,
  SHARE_READINGS_RATE_LIMIT_WINDOW_MS,
  checkShareReadingsRateLimit,
  resetShareReadingsRateLimitStateForTests,
} from "./shareReadingsLimits";

beforeEach(() => {
  resetShareReadingsRateLimitStateForTests();
});

describe("checkShareReadingsRateLimit", () => {
  it("allows the first request for a fresh key", () => {
    expect(checkShareReadingsRateLimit("key-1", 0)).toEqual({ ok: true });
  });

  it("allows requests up through the configured max within the window", () => {
    const now = 1000;
    for (let i = 0; i < SHARE_READINGS_RATE_LIMIT_MAX; i++) {
      expect(checkShareReadingsRateLimit("key-1", now).ok).toBe(true);
    }
  });

  it("blocks the request once the max is exceeded within the window", () => {
    const now = 1000;
    for (let i = 0; i < SHARE_READINGS_RATE_LIMIT_MAX; i++) {
      checkShareReadingsRateLimit("key-1", now);
    }

    const result = checkShareReadingsRateLimit("key-1", now);

    expect(result.ok).toBe(false);
    expect(result.retryAfterSec).toBeGreaterThan(0);
  });

  it("computes retryAfterSec from the remaining time in the window", () => {
    const now = 0;
    for (let i = 0; i < SHARE_READINGS_RATE_LIMIT_MAX; i++) {
      checkShareReadingsRateLimit("key-1", now);
    }

    const halfwayThroughWindow = SHARE_READINGS_RATE_LIMIT_WINDOW_MS / 2;
    const result = checkShareReadingsRateLimit("key-1", halfwayThroughWindow);

    expect(result.ok).toBe(false);
    expect(result.retryAfterSec).toBe(Math.ceil(halfwayThroughWindow / 1000));
  });

  it("resets the count once the window has elapsed", () => {
    const now = 0;
    for (let i = 0; i < SHARE_READINGS_RATE_LIMIT_MAX; i++) {
      checkShareReadingsRateLimit("key-1", now);
    }
    expect(checkShareReadingsRateLimit("key-1", now).ok).toBe(false);

    const afterWindow = SHARE_READINGS_RATE_LIMIT_WINDOW_MS + 1;
    expect(checkShareReadingsRateLimit("key-1", afterWindow)).toEqual({ ok: true });
  });

  it("tracks separate keys independently", () => {
    const now = 0;
    for (let i = 0; i < SHARE_READINGS_RATE_LIMIT_MAX; i++) {
      checkShareReadingsRateLimit("key-1", now);
    }
    expect(checkShareReadingsRateLimit("key-1", now).ok).toBe(false);
    expect(checkShareReadingsRateLimit("key-2", now).ok).toBe(true);
  });

  it("defaults 'now' to Date.now() when not provided", () => {
    expect(checkShareReadingsRateLimit("key-1")).toEqual({ ok: true });
  });
});
