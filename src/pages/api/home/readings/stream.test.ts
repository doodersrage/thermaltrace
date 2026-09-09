import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockFetchTemps = vi.fn();
vi.mock("../../../../lib/FetchTemps", () => ({
  fetchTemps: (...a: unknown[]) => mockFetchTemps(...a),
}));

const mockGetUserPreferences = vi.fn();
vi.mock("../../../../lib/userPreferences", () => ({
  getUserPreferences: (...a: unknown[]) => mockGetUserPreferences(...a),
}));

const mockGetUserDevicesAsTempConfig = vi.fn();
vi.mock("../../../../lib/devices", () => ({
  getUserDevicesAsTempConfig: (...a: unknown[]) =>
    mockGetUserDevicesAsTempConfig(...a),
}));

const mockFetchLatestSensorValues = vi.fn();
vi.mock("../../../../lib/sensorReadings", () => ({
  fetchLatestSensorValues: (...a: unknown[]) => mockFetchLatestSensorValues(...a),
}));

function makeContext(): { context: APIContext; abort: AbortController } {
  const abort = new AbortController();
  const request = new Request("https://example.com/api/home/readings/stream", {
    signal: abort.signal,
  });
  return {
    abort,
    context: { cookies: {}, request } as unknown as APIContext,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: {
      id: "user-1",
      email: "user@example.com",
      user_metadata: {},
    },
  });
  mockGetUserPreferences.mockReset().mockResolvedValue({
    tempFeeds: [],
    tempProbes: [],
  });
  mockGetUserDevicesAsTempConfig.mockReset().mockResolvedValue({
    feeds: [],
    probes: [],
    devices: [],
    householdId: "house-1",
  });
  mockFetchTemps.mockReset().mockResolvedValue([{ id: "feed-1" }]);
  mockFetchLatestSensorValues.mockReset().mockResolvedValue([{ id: "s1" }, { id: "s2" }]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/home/readings/stream", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./stream");
    const { context } = makeContext();

    const response = await GET(context);

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
  });

  it("streams a connected event then a readings event", async () => {
    const { GET } = await import("./stream");
    const { context, abort } = makeContext();

    const response = await GET(context);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.body).not.toBeNull();

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const connected = await reader.read();
    buffer += decoder.decode(connected.value);
    expect(buffer).toContain('"type":"connected"');

    const readingsPromise = reader.read();
    await vi.advanceTimersByTimeAsync(0);
    const readings = await readingsPromise;
    buffer += decoder.decode(readings.value);
    expect(buffer).toContain('"type":"readings"');
    expect(buffer).toContain('"feedCount":1');
    expect(buffer).toContain('"sensorCount":2');
    expect(mockFetchTemps).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        householdId: "house-1",
        saveToDatabase: false,
      }),
    );

    abort.abort();
    await vi.advanceTimersByTimeAsync(30000);
    await reader.cancel().catch(() => undefined);
  });
});
