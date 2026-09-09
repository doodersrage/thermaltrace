import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DeviceWithSensors } from "./devices";
import type { TempFeedConfig, TempProbeConfig } from "./tempFeedConfig";

const mockMaybeSendThresholdAlerts = vi.fn();
vi.mock("./alertNotifications", () => ({
  maybeSendThresholdAlerts: (...a: unknown[]) => mockMaybeSendThresholdAlerts(...a),
}));

const mockBuildReadingRowsFromTempResults = vi.fn();
const mockInsertSensorReadings = vi.fn();
vi.mock("./sensorReadings", () => ({
  buildReadingRowsFromTempResults: (...a: unknown[]) => mockBuildReadingRowsFromTempResults(...a),
  insertSensorReadings: (...a: unknown[]) => mockInsertSensorReadings(...a),
}));

const mockEnsureDefaultPullDevice = vi.fn();
const mockGetUserDevicesAsTempConfig = vi.fn();
const mockTouchDeviceLastSeen = vi.fn();
const mockUpdateDeviceMeta = vi.fn();
vi.mock("./devices", () => ({
  ensureDefaultPullDevice: (...a: unknown[]) => mockEnsureDefaultPullDevice(...a),
  getUserDevicesAsTempConfig: (...a: unknown[]) => mockGetUserDevicesAsTempConfig(...a),
  touchDeviceLastSeen: (...a: unknown[]) => mockTouchDeviceLastSeen(...a),
  updateDeviceMeta: (...a: unknown[]) => mockUpdateDeviceMeta(...a),
}));

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

function device(id: string): DeviceWithSensors {
  return { id } as unknown as DeviceWithSensors;
}

beforeEach(() => {
  mockMaybeSendThresholdAlerts.mockReset();
  mockBuildReadingRowsFromTempResults.mockReset().mockReturnValue([]);
  mockInsertSensorReadings.mockReset().mockResolvedValue({ error: null });
  mockEnsureDefaultPullDevice.mockReset();
  mockGetUserDevicesAsTempConfig.mockReset();
  mockTouchDeviceLastSeen.mockReset().mockResolvedValue(undefined);
  mockUpdateDeviceMeta.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchTempFeed", () => {
  const feed: TempFeedConfig = {
    id: "garage",
    name: "Garage",
    url: "https://example.com/temp.json",
    enabled: true,
  };

  it("parses probes and device meta from a successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          temp: { "0": { c: 5, f: 41, h: 50 } },
          battery_pct: 87,
          rssi: -60,
        }),
      ),
    );
    const { fetchTempFeed } = await import("./FetchTemps");

    const result = await fetchTempFeed(feed);

    expect(result.id).toBe("garage");
    expect(result.probes["0"]).toEqual({ c: 5, f: 41, h: 50 });
    expect(result.deviceMeta).toEqual({ battery_pct: 87, rssi: -60 });
    expect(result.error).toBeUndefined();
  });

  it("returns an error result when the response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, false, 503)));
    const { fetchTempFeed } = await import("./FetchTemps");

    const result = await fetchTempFeed(feed);

    expect(result.probes).toEqual({});
    expect(result.error).toContain("503");
  });

  it("returns an error result when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const { fetchTempFeed } = await import("./FetchTemps");

    const result = await fetchTempFeed(feed);

    expect(result.probes).toEqual({});
    expect(result.error).toBe("network down");
  });

  it("returns an error result when the payload cannot be parsed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(null)));
    const { fetchTempFeed } = await import("./FetchTemps");

    const result = await fetchTempFeed(feed);

    expect(result.probes).toEqual({});
    expect(result.error).toBe("Invalid temperature feed payload");
  });
});

describe("fetchTemps", () => {
  it("uses default feeds/probes for anonymous callers with none provided", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ temp: {} })));
    const { fetchTemps } = await import("./FetchTemps");

    const results = await fetchTemps({});

    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("garage");
    expect(mockGetUserDevicesAsTempConfig).not.toHaveBeenCalled();
    expect(mockInsertSensorReadings).not.toHaveBeenCalled();
  });

  it("skips the database/alerts path entirely when there is no userId", async () => {
    const feeds: TempFeedConfig[] = [
      { id: "a", name: "A", url: "https://a", enabled: true },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ temp: {} })));
    const { fetchTemps } = await import("./FetchTemps");

    await fetchTemps({ feeds, probes: [], householdId: "h1", devices: [device("d1")] });

    expect(mockInsertSensorReadings).not.toHaveBeenCalled();
    expect(mockMaybeSendThresholdAlerts).not.toHaveBeenCalled();
  });

  it("does not call getUserDevicesAsTempConfig when all config is already supplied", async () => {
    const feeds: TempFeedConfig[] = [
      { id: "a", name: "A", url: "https://a", enabled: true },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ temp: {} })));
    const { fetchTemps } = await import("./FetchTemps");

    await fetchTemps({
      userId: "user-1",
      feeds,
      probes: [],
      devices: [device("d1")],
      householdId: "h1",
      sendAlerts: false,
    });

    expect(mockGetUserDevicesAsTempConfig).not.toHaveBeenCalled();
  });

  it("fetches user device config when any piece is missing", async () => {
    const feeds: TempFeedConfig[] = [
      { id: "a", name: "A", url: "https://a", enabled: true },
    ];
    mockGetUserDevicesAsTempConfig.mockResolvedValue({
      householdId: "h1",
      devices: [device("d1")],
      feeds,
      probes: [],
      error: null,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ temp: {} })));
    const { fetchTemps } = await import("./FetchTemps");

    await fetchTemps({ userId: "user-1", sendAlerts: false });

    expect(mockGetUserDevicesAsTempConfig).toHaveBeenCalledWith("user-1", undefined);
    expect(mockEnsureDefaultPullDevice).not.toHaveBeenCalled();
  });

  it("ensures a default pull device and re-maps config when the user has no devices yet", async () => {
    const mappedFeeds: TempFeedConfig[] = [
      { id: "mapped", name: "Mapped", url: "https://mapped", enabled: true },
    ];
    mockGetUserDevicesAsTempConfig
      .mockResolvedValueOnce({ householdId: "", devices: [], feeds: [], probes: [], error: null })
      .mockResolvedValueOnce({
        householdId: "h2",
        devices: [device("d2")],
        feeds: mappedFeeds,
        probes: [],
        error: null,
      });
    mockEnsureDefaultPullDevice.mockResolvedValue({
      householdId: "h2",
      devices: [],
      error: null,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ temp: {} })));
    const { fetchTemps } = await import("./FetchTemps");

    const results = await fetchTemps({ userId: "user-2", sendAlerts: false });

    expect(mockGetUserDevicesAsTempConfig).toHaveBeenCalledTimes(2);
    expect(mockEnsureDefaultPullDevice).toHaveBeenCalledWith("user-2", undefined);
    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("mapped");
  });

  it("only fetches enabled feeds", async () => {
    const feeds: TempFeedConfig[] = [
      { id: "on", name: "On", url: "https://on", enabled: true },
      { id: "off", name: "Off", url: "https://off", enabled: false },
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ temp: {} }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchTemps } = await import("./FetchTemps");

    const results = await fetchTemps({ feeds, probes: [] });

    expect(results).toHaveLength(1);
    expect(results[0]!.id).toBe("on");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("saves readings, touches devices, and sends alerts by default when config is present", async () => {
    const feeds: TempFeedConfig[] = [
      { id: "a", name: "A", url: "https://a", enabled: true },
    ];
    const probes: TempProbeConfig[] = [
      { id: "a-0", feedId: "a", key: "0", label: "Probe", visible: true },
    ];
    const devices = [device("d1")];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ temp: { "0": { c: 1, f: 34, h: 40 } }, battery_pct: 90 })),
    );
    const { fetchTemps } = await import("./FetchTemps");

    const results = await fetchTemps({
      userId: "user-3",
      feeds,
      probes,
      devices,
      householdId: "h1",
    });

    expect(mockBuildReadingRowsFromTempResults).toHaveBeenCalledWith(
      "h1",
      devices,
      results,
      probes,
    );
    expect(mockInsertSensorReadings).toHaveBeenCalled();
    expect(mockTouchDeviceLastSeen).toHaveBeenCalledWith("a");
    expect(mockUpdateDeviceMeta).toHaveBeenCalledWith("a", { battery_pct: 90 });
    expect(mockMaybeSendThresholdAlerts).toHaveBeenCalledWith(
      "user-3",
      undefined,
      undefined,
      feeds,
      probes,
      results,
      "h1",
      devices,
    );
  });

  it("does not touch devices or update meta for a feed result that errored", async () => {
    const feeds: TempFeedConfig[] = [
      { id: "a", name: "A", url: "https://a", enabled: true },
    ];
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    const { fetchTemps } = await import("./FetchTemps");

    await fetchTemps({
      userId: "user-4",
      feeds,
      probes: [],
      devices: [device("d1")],
      householdId: "h1",
      sendAlerts: false,
    });

    expect(mockTouchDeviceLastSeen).not.toHaveBeenCalled();
    expect(mockUpdateDeviceMeta).not.toHaveBeenCalled();
  });

  it("skips updateDeviceMeta when deviceMeta is empty", async () => {
    const feeds: TempFeedConfig[] = [
      { id: "a", name: "A", url: "https://a", enabled: true },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ temp: { "0": { c: 1, f: 34, h: 40 } } })),
    );
    const { fetchTemps } = await import("./FetchTemps");

    await fetchTemps({
      userId: "user-5",
      feeds,
      probes: [],
      devices: [device("d1")],
      householdId: "h1",
      sendAlerts: false,
    });

    expect(mockTouchDeviceLastSeen).toHaveBeenCalledWith("a");
    expect(mockUpdateDeviceMeta).not.toHaveBeenCalled();
  });

  it("skips saving to the database when saveToDatabase is false", async () => {
    const feeds: TempFeedConfig[] = [
      { id: "a", name: "A", url: "https://a", enabled: true },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ temp: {} })));
    const { fetchTemps } = await import("./FetchTemps");

    await fetchTemps({
      userId: "user-6",
      feeds,
      probes: [],
      devices: [device("d1")],
      householdId: "h1",
      saveToDatabase: false,
    });

    expect(mockInsertSensorReadings).not.toHaveBeenCalled();
    expect(mockTouchDeviceLastSeen).not.toHaveBeenCalled();
    expect(mockMaybeSendThresholdAlerts).not.toHaveBeenCalled();
  });

  it("saves readings but skips alerts when sendAlerts is false", async () => {
    const feeds: TempFeedConfig[] = [
      { id: "a", name: "A", url: "https://a", enabled: true },
    ];
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ temp: {} })));
    const { fetchTemps } = await import("./FetchTemps");

    await fetchTemps({
      userId: "user-7",
      feeds,
      probes: [],
      devices: [device("d1")],
      householdId: "h1",
      sendAlerts: false,
    });

    expect(mockInsertSensorReadings).toHaveBeenCalled();
    expect(mockMaybeSendThresholdAlerts).not.toHaveBeenCalled();
  });
});

describe("fetchLegacyTempPayload", () => {
  it("fetches the first enabled feed and returns its probes as `temp`", async () => {
    const feeds: TempFeedConfig[] = [
      { id: "disabled", name: "Disabled", url: "https://disabled", enabled: false },
      { id: "enabled", name: "Enabled", url: "https://enabled", enabled: true },
    ];
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ temp: { "0": { c: 2, f: 36, h: 45 } } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchLegacyTempPayload } = await import("./FetchTemps");

    const result = await fetchLegacyTempPayload({ feeds, probes: [] });

    expect(fetchMock).toHaveBeenCalledWith("https://enabled", expect.anything());
    expect(result.temp["0"]).toEqual({ c: 2, f: 36, h: 45 });
  });

  it("returns empty temp when the only feed is disabled (fetchTemps filters it out)", async () => {
    // fetchLegacyTempPayload falls back to feeds[0] when none are enabled, but
    // fetchTemps always filters to enabled feeds before fetching, so a fully
    // disabled feed list still yields no network call and an empty result.
    const feeds: TempFeedConfig[] = [
      { id: "only", name: "Only", url: "https://only", enabled: false },
    ];
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ temp: {} }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchLegacyTempPayload } = await import("./FetchTemps");

    const result = await fetchLegacyTempPayload({ feeds, probes: [] });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toEqual({ temp: {} });
  });

  it("returns empty temp when there are no feeds at all", async () => {
    const { fetchLegacyTempPayload } = await import("./FetchTemps");

    const result = await fetchLegacyTempPayload({ feeds: [], probes: [] });

    expect(result).toEqual({ temp: {} });
  });
});
