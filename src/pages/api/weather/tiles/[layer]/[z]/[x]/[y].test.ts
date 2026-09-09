import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetOpenWeatherApiKey = vi.fn();
vi.mock("../../../../../../../lib/FetchWeather", () => ({
  getOpenWeatherApiKey: () => mockGetOpenWeatherApiKey(),
}));

const mockCheckWeatherTileRateLimit = vi.fn();
vi.mock("../../../../../../../lib/weatherTileLimits", () => ({
  checkWeatherTileRateLimit: (...a: unknown[]) =>
    mockCheckWeatherTileRateLimit(...a),
}));

function makeContext(
  params: Partial<{ layer: string; z: string; x: string; y: string }> = {},
  clientAddress = "1.2.3.4",
): APIContext {
  return {
    params: {
      layer: params.layer ?? "temp_new",
      z: params.z ?? "5",
      x: params.x ?? "10",
      y: params.y ?? "12",
    },
    clientAddress,
  } as unknown as APIContext;
}

beforeEach(() => {
  mockCheckWeatherTileRateLimit.mockReset().mockReturnValue({ ok: true });
  mockGetOpenWeatherApiKey.mockReset().mockReturnValue("owm-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/weather/tiles/[layer]/[z]/[x]/[y]", () => {
  it("returns 429 when rate limited", async () => {
    mockCheckWeatherTileRateLimit.mockReturnValue({
      ok: false,
      retryAfterSec: 10,
    });
    const { GET } = await import("./[y]");

    const response = await GET(makeContext());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("10");
    expect(await response.text()).toBe("Too many requests");
  });

  it("returns 404 for a disallowed layer or non-numeric tile coords", async () => {
    const { GET } = await import("./[y]");

    const badLayer = await GET(makeContext({ layer: "clouds_new" }));
    expect(badLayer.status).toBe(404);

    const badCoord = await GET(makeContext({ z: "abc" }));
    expect(badCoord.status).toBe(404);
  });

  it("returns 503 when the API key is missing", async () => {
    mockGetOpenWeatherApiKey.mockReturnValue("");
    const { GET } = await import("./[y]");

    const response = await GET(makeContext());

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("Weather tiles unavailable");
  });

  it("proxies a successful upstream tile response", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "Content-Type": "image/png" }),
        arrayBuffer: async () => bytes.buffer,
      }),
    );
    const { GET } = await import("./[y]");

    const response = await GET(makeContext());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=1800");
    expect(await response.arrayBuffer()).toEqual(bytes.buffer);
  });
});
