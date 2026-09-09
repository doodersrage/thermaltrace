import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUserById = vi.fn();
vi.mock("./supabase", () => ({
  createAdminClient: () => ({ auth: { admin: { getUserById: (...a: unknown[]) => mockGetUserById(...a) } } }),
}));

const mockFetchTemps = vi.fn();
vi.mock("./FetchTemps", () => ({
  fetchTemps: (...a: unknown[]) => mockFetchTemps(...a),
}));

const mockGetUserDevicesAsTempConfig = vi.fn();
vi.mock("./devices", () => ({
  getUserDevicesAsTempConfig: (...a: unknown[]) => mockGetUserDevicesAsTempConfig(...a),
}));

const mockListAllHouseholdOwnerUserIds = vi.fn();
const mockListHouseholdIdsForCron = vi.fn();
const mockListHouseholdMembers = vi.fn();
vi.mock("./households", () => ({
  listAllHouseholdOwnerUserIds: (...a: unknown[]) => mockListAllHouseholdOwnerUserIds(...a),
  listHouseholdIdsForCron: (...a: unknown[]) => mockListHouseholdIdsForCron(...a),
  listHouseholdMembers: (...a: unknown[]) => mockListHouseholdMembers(...a),
}));

const mockMaybeSendRateAndOutageAlerts = vi.fn();
const mockMaybeSendDeviceHealthAlerts = vi.fn();
const mockMaybeSendThresholdAlerts = vi.fn();
vi.mock("./alertNotifications", () => ({
  maybeSendRateAndOutageAlerts: (...a: unknown[]) => mockMaybeSendRateAndOutageAlerts(...a),
  maybeSendDeviceHealthAlerts: (...a: unknown[]) => mockMaybeSendDeviceHealthAlerts(...a),
  maybeSendThresholdAlerts: (...a: unknown[]) => mockMaybeSendThresholdAlerts(...a),
}));

const mockGetAlertSettingsForUser = vi.fn();
vi.mock("./notify", () => ({
  getAlertSettingsForUser: (...a: unknown[]) => mockGetAlertSettingsForUser(...a),
}));

const mockCollectThermostatSnapshotsForAllHouseholds = vi.fn();
vi.mock("./thermostatSnapshots", () => ({
  collectThermostatSnapshotsForAllHouseholds: (...a: unknown[]) =>
    mockCollectThermostatSnapshotsForAllHouseholds(...a),
}));

beforeEach(() => {
  mockGetUserById.mockReset().mockResolvedValue({ data: { user: { email: "owner@example.com" } } });
  mockFetchTemps.mockReset();
  mockGetUserDevicesAsTempConfig.mockReset();
  mockListAllHouseholdOwnerUserIds.mockReset();
  mockListHouseholdIdsForCron.mockReset();
  mockListHouseholdMembers.mockReset().mockResolvedValue({ members: [] });
  mockMaybeSendRateAndOutageAlerts.mockReset();
  mockMaybeSendDeviceHealthAlerts.mockReset();
  mockMaybeSendThresholdAlerts.mockReset();
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue({});
  mockCollectThermostatSnapshotsForAllHouseholds
    .mockReset()
    .mockResolvedValue({ errors: [], warnings: [] });
});

describe("checkFeedHealth", () => {
  it("passes through a device-config error without calling fetchTemps", async () => {
    mockGetUserDevicesAsTempConfig.mockResolvedValue({ error: "no devices", feeds: [], probes: [], devices: [] });
    const { checkFeedHealth } = await import("./collectHistory");

    const result = await checkFeedHealth("user-1");

    expect(result).toEqual({ statuses: [], error: "no devices" });
    expect(mockFetchTemps).not.toHaveBeenCalled();
  });

  it("only probes enabled feeds and reports ok/probeCount per feed", async () => {
    mockGetUserDevicesAsTempConfig.mockResolvedValue({
      error: null,
      feeds: [
        { id: "feed-1", name: "Garage", url: "https://a", enabled: true },
        { id: "feed-2", name: "Attic", url: "https://b", enabled: false },
      ],
      probes: [],
      devices: [],
      householdId: "house-1",
    });
    mockFetchTemps.mockResolvedValue([{ id: "feed-1", probes: { p1: 42, p2: 43 } }]);
    const { checkFeedHealth } = await import("./collectHistory");

    const result = await checkFeedHealth("user-1");

    expect(mockFetchTemps).toHaveBeenCalledWith(
      expect.objectContaining({
        feeds: [expect.objectContaining({ id: "feed-1" })],
        saveToDatabase: false,
      }),
    );
    expect(result.error).toBeNull();
    expect(result.statuses).toEqual([
      expect.objectContaining({ feedId: "feed-1", ok: true, probeCount: 2 }),
    ]);
  });

  it("reports a feed as unhealthy when fetchTemps returns an error for it", async () => {
    mockGetUserDevicesAsTempConfig.mockResolvedValue({
      error: null,
      feeds: [{ id: "feed-1", name: "Garage", url: "https://a", enabled: true }],
      probes: [],
      devices: [],
    });
    mockFetchTemps.mockResolvedValue([{ id: "feed-1", error: "timeout", probes: {} }]);
    const { checkFeedHealth } = await import("./collectHistory");

    const result = await checkFeedHealth("user-1");

    expect(result.statuses[0]).toMatchObject({ ok: false, message: "timeout", probeCount: 0 });
  });

  it("reports a feed as unhealthy with a default message when fetchTemps returns nothing for it", async () => {
    mockGetUserDevicesAsTempConfig.mockResolvedValue({
      error: null,
      feeds: [{ id: "feed-1", name: "Garage", url: "https://a", enabled: true }],
      probes: [],
      devices: [],
    });
    mockFetchTemps.mockResolvedValue([]);
    const { checkFeedHealth } = await import("./collectHistory");

    const result = await checkFeedHealth("user-1");

    expect(result.statuses[0]).toMatchObject({ ok: false, message: "Feed unreachable" });
  });
});

describe("collectAllUsersFeedHealth", () => {
  it("aggregates statuses across users and attaches each owner's email", async () => {
    mockListAllHouseholdOwnerUserIds.mockResolvedValue(["user-1"]);
    mockGetUserDevicesAsTempConfig.mockResolvedValue({
      error: null,
      feeds: [{ id: "feed-1", name: "Garage", url: "https://a", enabled: true }],
      probes: [],
      devices: [],
    });
    mockFetchTemps.mockResolvedValue([{ id: "feed-1", probes: { p1: 1 } }]);
    const { collectAllUsersFeedHealth } = await import("./collectHistory");

    const result = await collectAllUsersFeedHealth();

    expect(result.errors).toEqual([]);
    expect(result.statuses).toEqual([
      expect.objectContaining({ feedId: "feed-1", userEmail: "owner@example.com" }),
    ]);
  });

  it("records a per-user error (keyed by email when available) instead of aborting the whole run", async () => {
    mockListAllHouseholdOwnerUserIds.mockResolvedValue(["user-1", "user-2"]);
    mockGetUserDevicesAsTempConfig
      .mockResolvedValueOnce({ error: "device config broken", feeds: [], probes: [], devices: [] })
      .mockResolvedValueOnce({ error: null, feeds: [], probes: [], devices: [] });
    mockFetchTemps.mockResolvedValue([]);
    const { collectAllUsersFeedHealth } = await import("./collectHistory");

    const result = await collectAllUsersFeedHealth();

    expect(result.errors).toEqual(["owner@example.com: device config broken"]);
    // The second user must still be processed even though the first failed.
    expect(mockGetUserDevicesAsTempConfig).toHaveBeenCalledTimes(2);
  });
});

describe("collectHistoryForAllUsers", () => {
  function baseConfig(overrides: Record<string, unknown> = {}) {
    return {
      error: null,
      feeds: [],
      probes: [{ id: "p1", visible: true }, { id: "p2", visible: false }],
      devices: [],
      householdId: "house-1",
      ...overrides,
    };
  }

  it("records a config error for one household and still continues to process others", async () => {
    mockListHouseholdIdsForCron.mockResolvedValue([
      { householdId: "house-1", ownerUserId: "owner-1" },
      { householdId: "house-2", ownerUserId: "owner-2" },
    ]);
    mockGetUserDevicesAsTempConfig
      .mockResolvedValueOnce({ error: "bad config" })
      .mockResolvedValueOnce(baseConfig());
    mockFetchTemps.mockResolvedValue([]);
    const { collectHistoryForAllUsers } = await import("./collectHistory");

    const result = await collectHistoryForAllUsers();

    expect(result.errors).toEqual(["owner-1: bad config"]);
    expect(result.householdsProcessed).toBe(1);
  });

  it("only forwards visible probes to fetchTemps for history collection", async () => {
    mockListHouseholdIdsForCron.mockResolvedValue([{ householdId: "house-1", ownerUserId: "owner-1" }]);
    mockGetUserDevicesAsTempConfig.mockResolvedValue(baseConfig());
    mockFetchTemps.mockResolvedValue([]);
    const { collectHistoryForAllUsers } = await import("./collectHistory");

    await collectHistoryForAllUsers();

    expect(mockFetchTemps).toHaveBeenCalledWith(
      expect.objectContaining({
        probes: [{ id: "p1", visible: true }],
        saveToDatabase: true,
        sendAlerts: false,
      }),
    );
  });

  it("runs the full alert pipeline once per household member and counts them", async () => {
    mockListHouseholdIdsForCron.mockResolvedValue([{ householdId: "house-1", ownerUserId: "owner-1" }]);
    mockGetUserDevicesAsTempConfig.mockResolvedValue(baseConfig());
    mockFetchTemps.mockResolvedValue([{ id: "p1", probes: {} }]);
    mockListHouseholdMembers.mockResolvedValue({
      members: [{ user_id: "member-1" }, { user_id: "member-2" }],
    });
    const { collectHistoryForAllUsers } = await import("./collectHistory");

    const result = await collectHistoryForAllUsers();

    expect(result.usersProcessed).toBe(2);
    expect(result.householdsProcessed).toBe(1);
    expect(mockMaybeSendThresholdAlerts).toHaveBeenCalledTimes(2);
    expect(mockMaybeSendRateAndOutageAlerts).toHaveBeenCalledTimes(2);
    expect(mockMaybeSendDeviceHealthAlerts).toHaveBeenCalledTimes(2);
  });

  it("catches a thrown exception for one household without losing the others", async () => {
    mockListHouseholdIdsForCron.mockResolvedValue([
      { householdId: "house-1", ownerUserId: "owner-1" },
      { householdId: "house-2", ownerUserId: "owner-2" },
    ]);
    mockGetUserDevicesAsTempConfig
      .mockImplementationOnce(() => {
        throw new Error("boom");
      })
      .mockResolvedValueOnce(baseConfig());
    mockFetchTemps.mockResolvedValue([]);
    const { collectHistoryForAllUsers } = await import("./collectHistory");

    const result = await collectHistoryForAllUsers();

    expect(result.errors).toEqual(["owner-1: boom"]);
    expect(result.householdsProcessed).toBe(1);
  });

  it("prefixes and merges thermostat snapshot errors and warnings into the overall result", async () => {
    mockListHouseholdIdsForCron.mockResolvedValue([]);
    mockCollectThermostatSnapshotsForAllHouseholds.mockResolvedValue({
      errors: ["nest auth expired"],
      warnings: ["ecobee rate limited"],
    });
    const { collectHistoryForAllUsers } = await import("./collectHistory");

    const result = await collectHistoryForAllUsers();

    expect(result.errors).toEqual(["thermostat: nest auth expired"]);
    expect(result.warnings).toEqual(["thermostat: ecobee rate limited"]);
  });
});
