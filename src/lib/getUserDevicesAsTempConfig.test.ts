import { beforeEach, describe, expect, it, vi } from "vitest";

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order"]) {
    builder[method] = vi.fn(() => builder);
  }
  (builder as { then: unknown }).then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

const mockFrom = vi.fn();
vi.mock("./supabase", () => ({
  createServerClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}));

const mockGetOrCreateHouseholdForUser = vi.fn();
vi.mock("./households", () => ({
  getOrCreateHouseholdForUser: (...args: unknown[]) => mockGetOrCreateHouseholdForUser(...args),
}));

const mockMigrateLegacyTempTablesToDevices = vi.fn();
vi.mock("./userTempConfig", () => ({
  migrateLegacyTempTablesToDevices: (...args: unknown[]) =>
    mockMigrateLegacyTempTablesToDevices(...args),
}));

beforeEach(() => {
  mockFrom.mockReset().mockReturnValue(mockQuery({ data: [] }));
  mockGetOrCreateHouseholdForUser.mockReset().mockResolvedValue({
    householdId: "house-1",
    error: null,
  });
  mockMigrateLegacyTempTablesToDevices.mockReset().mockResolvedValue({
    migratedFeeds: 0,
    createdDevices: 0,
  });
});

describe("getUserDevicesAsTempConfig", () => {
  it("runs the legacy migration before ensuring/listing devices", async () => {
    const { getUserDevicesAsTempConfig } = await import("./devices");

    await getUserDevicesAsTempConfig("user-1", "user@example.com");

    expect(mockMigrateLegacyTempTablesToDevices).toHaveBeenCalledWith(
      "user-1",
      "user@example.com",
    );
    expect(mockGetOrCreateHouseholdForUser).toHaveBeenCalledWith(
      "user-1",
      "user@example.com",
    );
  });

  it("swallows a migration failure and still returns the household's devices", async () => {
    mockMigrateLegacyTempTablesToDevices.mockRejectedValue(new Error("legacy migration boom"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getUserDevicesAsTempConfig } = await import("./devices");

    const result = await getUserDevicesAsTempConfig("user-1");

    expect(result.error).toBeNull();
    expect(result.householdId).toBe("house-1");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Legacy temp-config migration failed:",
      expect.any(Error),
    );
    consoleErrorSpy.mockRestore();
  });

  it("propagates a household-creation error with empty devices and the legacy defaults", async () => {
    mockGetOrCreateHouseholdForUser.mockResolvedValue({
      householdId: "",
      error: "could not create household",
    });
    const { getUserDevicesAsTempConfig } = await import("./devices");

    const result = await getUserDevicesAsTempConfig("user-1");

    expect(result.error).toBe("could not create household");
    expect(result.devices).toEqual([]);
    expect(result.feeds.length).toBeGreaterThan(0);
    expect(result.probes.length).toBeGreaterThan(0);
  });

  it("maps the household's real devices into feeds/probes on success", async () => {
    const devicesBuilder = mockQuery({
      data: [
        {
          id: "d1",
          household_id: "house-1",
          name: "Garage",
          source: "pull_url",
          pull_url: "https://example.com/feed.json",
          enabled: true,
          sort_order: 0,
          meta: {},
        },
      ],
    });
    const sensorsBuilder = mockQuery({
      data: [
        {
          id: "s1",
          device_id: "d1",
          key: "0",
          label: "Bay 0",
          kind: "temperature",
          unit: "F",
          visible: true,
          sort_order: 0,
          offset_num: 0,
        },
      ],
    });
    mockFrom.mockReturnValueOnce(devicesBuilder).mockReturnValueOnce(sensorsBuilder);
    const { getUserDevicesAsTempConfig } = await import("./devices");

    const result = await getUserDevicesAsTempConfig("user-1");

    expect(result.error).toBeNull();
    expect(result.householdId).toBe("house-1");
    expect(result.devices).toHaveLength(1);
    expect(result.feeds).toEqual([
      expect.objectContaining({ id: "d1", url: "https://example.com/feed.json" }),
    ]);
    expect(result.probes).toEqual([
      expect.objectContaining({ id: "d1:0", feedId: "d1", key: "0" }),
    ]);
  });
});
