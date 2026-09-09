import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockCheckDemoTempsRateLimit = vi.fn();
vi.mock("../../../lib/demoTempsLimits", () => ({
  checkDemoTempsRateLimit: (...a: unknown[]) => mockCheckDemoTempsRateLimit(...a),
}));

const mockGetExampleFeedUrl = vi.fn();
vi.mock("../../../lib/exampleFeed", () => ({
  getExampleFeedUrl: (...a: unknown[]) => mockGetExampleFeedUrl(...a),
}));

const mockFetchWeatherSimulatedFeed = vi.fn();
const mockFormatExampleFeedResponse = vi.fn();
vi.mock("../../../lib/weatherSimulatedFeed", () => ({
  fetchWeatherSimulatedFeed: (...a: unknown[]) => mockFetchWeatherSimulatedFeed(...a),
  formatExampleFeedResponse: (...a: unknown[]) => mockFormatExampleFeedResponse(...a),
}));

const mockResolveSiteUrl = vi.fn();
vi.mock("../../../lib/schemaMarkup", () => ({
  resolveSiteUrl: (...a: unknown[]) => mockResolveSiteUrl(...a),
}));

function makeContext(query: string, clientAddress = "1.2.3.4"): APIContext {
  const url = new URL(`https://example.com/api/feeds/example${query}`);
  return { url, clientAddress, site: undefined } as unknown as APIContext;
}

beforeEach(() => {
  mockCheckDemoTempsRateLimit.mockReset().mockReturnValue({ ok: true });
  mockGetExampleFeedUrl.mockReset().mockReturnValue("https://thermaltrace.dev/api/feeds/example");
  mockFetchWeatherSimulatedFeed.mockReset().mockResolvedValue({ tempF: 40 });
  mockFormatExampleFeedResponse.mockReset().mockReturnValue({ ok: true });
  mockResolveSiteUrl.mockReset().mockReturnValue("https://thermaltrace.dev");
});

describe("GET /api/feeds/example", () => {
  it("returns 429 with Retry-After when rate limited", async () => {
    mockCheckDemoTempsRateLimit.mockReturnValue({ ok: false, retryAfterSec: 15 });
    const { GET } = await import("./example");

    const response = await GET(makeContext(""));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("15");
    expect(mockFetchWeatherSimulatedFeed).not.toHaveBeenCalled();
  });

  it("scopes the rate limit key by client address", async () => {
    const { GET } = await import("./example");

    await GET(makeContext("", "9.9.9.9"));

    expect(mockCheckDemoTempsRateLimit).toHaveBeenCalledWith("example-feed:9.9.9.9");
  });

  it("defaults to pull format and parses no query params", async () => {
    const { GET } = await import("./example");

    await GET(makeContext(""));

    expect(mockFetchWeatherSimulatedFeed).toHaveBeenCalledWith({
      cityId: undefined,
      doorOpen: undefined,
      sunIntensity: undefined,
      noisy: true,
    });
    expect(mockFormatExampleFeedResponse).toHaveBeenCalledWith(
      "pull",
      { tempF: 40 },
      "https://thermaltrace.dev/api/feeds/example",
    );
  });

  it("parses format, cityId, door, sun, and noise query params", async () => {
    const { GET } = await import("./example");

    await GET(makeContext("?format=senml&cityId=chicago&door=1&sun=150&noise=0"));

    expect(mockFetchWeatherSimulatedFeed).toHaveBeenCalledWith({
      cityId: "chicago",
      doorOpen: true,
      sunIntensity: 100,
      noisy: false,
    });
    expect(mockFormatExampleFeedResponse).toHaveBeenCalledWith(
      "senml",
      { tempF: 40 },
      "https://thermaltrace.dev/api/feeds/example",
    );
  });

  it("maps the 'ha' alias to homeassistant format", async () => {
    const { GET } = await import("./example");

    await GET(makeContext("?format=ha"));

    expect(mockFormatExampleFeedResponse).toHaveBeenCalledWith(
      "homeassistant",
      expect.anything(),
      expect.anything(),
    );
  });

  it("falls back to pull format for an unrecognized format value", async () => {
    const { GET } = await import("./example");

    await GET(makeContext("?format=nonsense"));

    expect(mockFormatExampleFeedResponse).toHaveBeenCalledWith(
      "pull",
      expect.anything(),
      expect.anything(),
    );
  });

  it("clamps sun intensity into 0-100 and ignores non-numeric values", async () => {
    const { GET } = await import("./example");

    await GET(makeContext("?sun=-40"));
    expect(mockFetchWeatherSimulatedFeed).toHaveBeenCalledWith(
      expect.objectContaining({ sunIntensity: 0 }),
    );

    await GET(makeContext("?sun=not-a-number"));
    expect(mockFetchWeatherSimulatedFeed).toHaveBeenLastCalledWith(
      expect.objectContaining({ sunIntensity: undefined }),
    );
  });

  it("returns the formatted body with a 200 and the feed headers", async () => {
    mockFormatExampleFeedResponse.mockReturnValue({ someKey: "value" });
    const { GET } = await import("./example");

    const response = await GET(makeContext(""));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("X-ThermalTrace-Feed")).toBe("weather-simulated-example");
    expect(await response.json()).toEqual({ someKey: "value" });
  });
});
