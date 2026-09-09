import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
}));

const mockFetchTemps = vi.fn();
vi.mock("../../../lib/FetchTemps", () => ({
  fetchTemps: (...a: unknown[]) => mockFetchTemps(...a),
}));

const mockGetUserPreferences = vi.fn();
vi.mock("../../../lib/userPreferences", () => ({
  getUserPreferences: (...a: unknown[]) => mockGetUserPreferences(...a),
}));

const mockBuildFeedDisplayGroups = vi.fn();
vi.mock("../../../lib/tempFeedConfig", () => ({
  buildFeedDisplayGroups: (...a: unknown[]) => mockBuildFeedDisplayGroups(...a),
}));

const mockGetUserDevicesAsTempConfig = vi.fn();
vi.mock("../../../lib/devices", () => ({
  getUserDevicesAsTempConfig: (...a: unknown[]) =>
    mockGetUserDevicesAsTempConfig(...a),
}));

const mockFetchLatestSensorValues = vi.fn();
vi.mock("../../../lib/sensorReadings", () => ({
  fetchLatestSensorValues: (...a: unknown[]) => mockFetchLatestSensorValues(...a),
}));

function makeContext(search = ""): APIContext {
  const url = new URL(`https://example.com/api/home/readings${search}`);
  return {
    cookies: {},
    url,
    request: new Request(url),
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({
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
    feeds: [{ id: "feed-1", name: "Garage", enabled: true }],
    probes: [{ key: "0", label: "North", visible: true }],
    devices: [
      {
        id: "device-1",
        name: "Garage Pi",
        source: "pull",
        space: "garage",
        enabled: true,
        sensors: [
          {
            key: "0",
            label: "North",
            kind: "temperature",
            unit: "F",
            visible: true,
          },
        ],
      },
    ],
    householdId: "house-1",
  });
  mockFetchTemps.mockReset().mockResolvedValue([]);
  mockBuildFeedDisplayGroups.mockReset().mockReturnValue([
    {
      feedId: "feed-1",
      feedName: "Garage",
      enabled: true,
      error: undefined,
      probes: [{ key: "0", label: "North", data: { f: 72, c: 22.2, h: 40 } }],
    },
  ]);
  mockFetchLatestSensorValues.mockReset().mockResolvedValue([]);
});

describe("GET /api/home/readings", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./readings");

    const response = await GET(makeContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns live groups and sensors for an authenticated user", async () => {
    const { GET } = await import("./readings");

    const response = await GET(makeContext());
    const body = (await response.json()) as {
      groups: unknown;
      sensors: unknown;
      spaces: unknown;
      updatedAt: unknown;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mockFetchTemps).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        householdId: "house-1",
        saveToDatabase: true,
      }),
    );
    expect(body.groups).toEqual([
      {
        feedId: "feed-1",
        feedName: "Garage",
        enabled: true,
        probes: [{ key: "0", label: "North", data: { f: 72, c: 22.2, h: 40 } }],
      },
    ]);
    expect(body.sensors).toEqual([
      expect.objectContaining({
        deviceId: "device-1",
        deviceName: "Garage Pi",
        key: "0",
        kind: "temperature",
        value_num: 72,
        temp: { f: 72, c: 22.2, h: 40 },
        space: "garage",
      }),
    ]);
    expect(body.spaces).toEqual(["garage"]);
    expect(typeof body.updatedAt).toBe("string");
  });

  it("honors save=0 and space filtering", async () => {
    const { GET } = await import("./readings");

    const response = await GET(makeContext("?save=0&space=basement"));
    const body = (await response.json()) as { sensors: unknown };

    expect(mockFetchTemps).toHaveBeenCalledWith(
      expect.objectContaining({ saveToDatabase: false }),
    );
    expect(body.sensors).toEqual([]);
  });
});
