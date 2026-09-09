import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";
import type { DiscoveredProbe } from "../../../lib/feedDiscovery";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockDiscoverFeedProbes = vi.fn();
const mockFormatProbeReading = vi.fn();
vi.mock("../../../lib/feedDiscovery", () => ({
  discoverFeedProbes: (...a: unknown[]) => mockDiscoverFeedProbes(...a),
  formatProbeReading: (...a: unknown[]) => mockFormatProbeReading(...a),
}));

const mockIsValidFeedUrl = vi.fn();
vi.mock("../../../lib/tempFeedConfig", () => ({
  isValidFeedUrl: (...a: unknown[]) => mockIsValidFeedUrl(...a),
}));

const mockRequireHouseholdEditor = vi.fn();
vi.mock("../../../lib/householdAuth", () => ({
  requireHouseholdEditor: (...a: unknown[]) => mockRequireHouseholdEditor(...a),
}));

const mockCheckFeedTestRateLimit = vi.fn();
vi.mock("../../../lib/feedTestLimits", () => ({
  checkFeedTestRateLimit: (...a: unknown[]) => mockCheckFeedTestRateLimit(...a),
}));

function probe(overrides: Partial<DiscoveredProbe> = {}): DiscoveredProbe {
  return {
    key: "avg",
    suggestedLabel: "Average",
    tempF: 40,
    humidity: null,
    visible: true,
    source: "native",
    ...overrides,
  };
}

function makeContext(body: unknown, clientAddress = "1.2.3.4"): APIContext {
  const request = new Request("https://example.com/api/feeds/test", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { request, cookies: {}, clientAddress } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "t" },
    user: { id: "user-1" },
  });
  mockDiscoverFeedProbes.mockReset();
  mockFormatProbeReading.mockReset().mockReturnValue("40.0°F");
  mockIsValidFeedUrl.mockReset().mockReturnValue(true);
  mockRequireHouseholdEditor.mockReset().mockResolvedValue({ ok: true, ctx: {} });
  mockCheckFeedTestRateLimit.mockReset().mockReturnValue({ ok: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/feeds/test", () => {
  it("requires sign-in", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./test");

    const response = await POST(makeContext({ url: "https://feed.example.com" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, message: "Sign in required." });
  });

  it("returns 429 when rate limited", async () => {
    mockCheckFeedTestRateLimit.mockReturnValue({ ok: false, retryAfterSec: 20 });
    const { POST } = await import("./test");

    const response = await POST(makeContext({ url: "https://feed.example.com" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("20");
  });

  it("rejects view-only (non-editor) household members", async () => {
    mockRequireHouseholdEditor.mockResolvedValue({ ok: false, error: "viewer" });
    const { POST } = await import("./test");

    const response = await POST(makeContext({ url: "https://feed.example.com" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, message: "View-only access." });
  });

  it("rejects a missing or invalid feed url with a 400", async () => {
    mockIsValidFeedUrl.mockReturnValue(false);
    const { POST } = await import("./test");

    const response = await POST(makeContext({ url: "ftp://bad" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, message: "Enter a valid HTTPS feed URL." });
  });

  it("rejects when no url is given at all", async () => {
    const { POST } = await import("./test");

    const response = await POST(makeContext({}));

    expect(response.status).toBe(400);
  });

  it("reports a non-ok upstream response as a 200 failure message (not an error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const { POST } = await import("./test");

    const response = await POST(makeContext({ url: "https://feed.example.com" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: false, message: "Feed request failed (503)." });
  });

  it("discovers probes and reports a success summary including the average temp", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({ temp: [40] }) }),
    );
    mockDiscoverFeedProbes.mockReturnValue({
      format: "native",
      jsonRoot: "temp",
      probes: [probe({ key: "avg", tempF: 41.2 })],
    });
    const { POST } = await import("./test");

    const response = await POST(makeContext({ url: "https://feed.example.com" }));
    const json = (await response.json()) as { ok: boolean; message: string; probes: unknown[] };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.message).toBe("Found 1 probe (native JSON), average 41.2°F.");
    expect(json.probes).toEqual([
      {
        key: "avg",
        suggestedLabel: "Average",
        label: "Average",
        tempF: 41.2,
        humidity: null,
        visible: true,
        source: "native",
        reading: "40.0°F",
      },
    ]);
  });

  it("pluralizes the probe count and omits the average clause when there's no avg probe", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
    );
    mockDiscoverFeedProbes.mockReturnValue({
      format: "senml",
      jsonRoot: "data",
      probes: [probe({ key: "1" }), probe({ key: "2" })],
    });
    const { POST } = await import("./test");

    const response = await POST(makeContext({ url: "https://feed.example.com" }));
    const json = (await response.json()) as { message: string };

    expect(json.message).toBe("Found 2 probes (senml JSON).");
  });

  it("passes a custom jsonRoot through to discovery, defaulting to 'temp'", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) }),
    );
    mockDiscoverFeedProbes.mockReturnValue({ format: "native", jsonRoot: "readings", probes: [] });
    const { POST } = await import("./test");

    await POST(makeContext({ url: "https://feed.example.com", jsonRoot: "readings" }));

    expect(mockDiscoverFeedProbes).toHaveBeenCalledWith(expect.anything(), "readings");
  });

  it("catches a thrown fetch (e.g. timeout) and returns a 200 failure message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("The operation timed out")));
    const { POST } = await import("./test");

    const response = await POST(makeContext({ url: "https://feed.example.com" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: false, message: "The operation timed out" });
  });
});
