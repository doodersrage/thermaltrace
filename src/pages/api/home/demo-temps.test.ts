import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockCheckDemoTempsRateLimit = vi.fn();
vi.mock("../../../lib/demoTempsLimits", () => ({
  checkDemoTempsRateLimit: (...a: unknown[]) => mockCheckDemoTempsRateLimit(...a),
}));

const mockFetchWeatherSimulatedFeed = vi.fn();
vi.mock("../../../lib/weatherSimulatedFeed", () => ({
  fetchWeatherSimulatedFeed: (...a: unknown[]) =>
    mockFetchWeatherSimulatedFeed(...a),
}));

function makeContext(search = "", clientAddress = "1.2.3.4"): APIContext {
  const url = new URL(`https://example.com/api/home/demo-temps${search}`);
  return { url, clientAddress } as unknown as APIContext;
}

beforeEach(() => {
  mockCheckDemoTempsRateLimit.mockReset().mockReturnValue({ ok: true });
  mockFetchWeatherSimulatedFeed.mockReset().mockResolvedValue({
    pull: {
      temp: {
        "0": { f: 68, c: 20, h: 40 },
        "1": { f: 70, c: 21.1, h: 42 },
        avg: { f: 69, c: 20.6, h: 41 },
      },
    },
    meta: {
      generated_at: "2024-01-01T12:00:00Z",
      outdoor_temp_f: 45,
    },
  });
});

describe("GET /api/home/demo-temps", () => {
  it("returns 429 with Retry-After when rate limited", async () => {
    mockCheckDemoTempsRateLimit.mockReturnValue({
      ok: false,
      retryAfterSec: 20,
    });
    const { GET } = await import("./demo-temps");

    const response = await GET(makeContext());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("20");
    expect(await response.json()).toEqual({ error: "Too many requests" });
  });

  it("returns simulated demo probe temperatures", async () => {
    const { GET } = await import("./demo-temps");

    const response = await GET(makeContext("?cityId=5128581"));

    expect(mockFetchWeatherSimulatedFeed).toHaveBeenCalledWith({
      cityId: "5128581",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("max-age=30");
    expect(await response.json()).toEqual({
      updatedAt: "2024-01-01T12:00:00Z",
      outdoorTempF: 45,
      groups: [
        {
          feedId: "example",
          feedName: "Example shop (weather simulated)",
          enabled: true,
          probes: [
            { key: "0", label: "North wall", data: { f: 68, c: 20, h: 40 } },
            { key: "1", label: "Door zone", data: { f: 70, c: 21.1, h: 42 } },
            { key: "avg", label: "Average", data: { f: 69, c: 20.6, h: 41 } },
          ],
        },
      ],
    });
  });
});
