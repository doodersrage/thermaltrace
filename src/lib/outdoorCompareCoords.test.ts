import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFetchWeatherSnapshotForConfig = vi.fn();
const mockGetPersonalWeatherConfig = vi.fn();
vi.mock("./weatherContext", () => ({
  fetchWeatherSnapshotForConfig: (...a: unknown[]) => mockFetchWeatherSnapshotForConfig(...a),
  getPersonalWeatherConfig: (...a: unknown[]) => mockGetPersonalWeatherConfig(...a),
}));

const mockGetUserHouseholdId = vi.fn();
vi.mock("./households", () => ({
  getUserHouseholdId: (...a: unknown[]) => mockGetUserHouseholdId(...a),
}));

const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();
vi.mock("./supabase", () => ({
  createServerClient: () => ({ from: (...a: unknown[]) => mockFrom(...a) }),
}));

beforeEach(() => {
  mockFetchWeatherSnapshotForConfig.mockReset().mockResolvedValue(null);
  mockGetPersonalWeatherConfig.mockReset().mockReturnValue({ source: "openweather" });
  mockGetUserHouseholdId.mockReset().mockResolvedValue(null);
  mockMaybeSingle.mockReset().mockResolvedValue({ data: null, error: null });
  mockFrom.mockReset().mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
  });
});

describe("resolveOutdoorCompareCoords", () => {
  it("uses the user's live weather snapshot when it has lat/lon", async () => {
    mockFetchWeatherSnapshotForConfig.mockResolvedValue({ lat: 1, lon: 2, name: "My Station" });
    const { resolveOutdoorCompareCoords } = await import("./outdoorCompareCoords");
    const user = { id: "user-1" } as never;

    const result = await resolveOutdoorCompareCoords("user-1", user);

    expect(mockGetPersonalWeatherConfig).toHaveBeenCalledWith(user);
    expect(result).toEqual({ lat: 1, lon: 2, label: "My Station" });
    expect(mockGetUserHouseholdId).not.toHaveBeenCalled();
  });

  it("falls back to 'Weather location' when the snapshot has no name", async () => {
    mockFetchWeatherSnapshotForConfig.mockResolvedValue({ lat: 1, lon: 2, name: "  " });
    const { resolveOutdoorCompareCoords } = await import("./outdoorCompareCoords");

    const result = await resolveOutdoorCompareCoords("user-1", { id: "user-1" } as never);

    expect(result?.label).toBe("Weather location");
  });

  it("does not attempt a weather lookup when no user is given", async () => {
    const { resolveOutdoorCompareCoords } = await import("./outdoorCompareCoords");

    await resolveOutdoorCompareCoords("user-1");

    expect(mockFetchWeatherSnapshotForConfig).not.toHaveBeenCalled();
  });

  it("falls back to the household freeze map when the snapshot has no lat/lon", async () => {
    mockFetchWeatherSnapshotForConfig.mockResolvedValue({ lat: null, lon: null });
    mockGetUserHouseholdId.mockResolvedValue("house-1");
    mockMaybeSingle.mockResolvedValue({
      data: { freeze_map_lat: 5, freeze_map_lon: 6, freeze_map_label: "My Freeze Map" },
    });
    const { resolveOutdoorCompareCoords } = await import("./outdoorCompareCoords");

    const result = await resolveOutdoorCompareCoords("user-1", { id: "user-1" } as never);

    expect(result).toEqual({ lat: 5, lon: 6, label: "My Freeze Map" });
  });

  it("returns null when there is no household", async () => {
    mockGetUserHouseholdId.mockResolvedValue(null);
    const { resolveOutdoorCompareCoords } = await import("./outdoorCompareCoords");

    expect(await resolveOutdoorCompareCoords("user-1")).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns null when the household lookup errors", async () => {
    mockGetUserHouseholdId.mockResolvedValue("house-1");
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "db down" } });
    const { resolveOutdoorCompareCoords } = await import("./outdoorCompareCoords");

    expect(await resolveOutdoorCompareCoords("user-1")).toBeNull();
  });

  it("returns null when the freeze map lat/lon are missing or non-finite", async () => {
    mockGetUserHouseholdId.mockResolvedValue("house-1");
    const { resolveOutdoorCompareCoords } = await import("./outdoorCompareCoords");

    mockMaybeSingle.mockResolvedValue({ data: { freeze_map_lat: null, freeze_map_lon: 6 } });
    expect(await resolveOutdoorCompareCoords("user-1")).toBeNull();

    mockMaybeSingle.mockResolvedValue({ data: { freeze_map_lat: NaN, freeze_map_lon: 6 } });
    expect(await resolveOutdoorCompareCoords("user-1")).toBeNull();
  });

  it("falls back to 'Freeze map location' when the row has no label", async () => {
    mockGetUserHouseholdId.mockResolvedValue("house-1");
    mockMaybeSingle.mockResolvedValue({
      data: { freeze_map_lat: 5, freeze_map_lon: 6, freeze_map_label: "   " },
    });
    const { resolveOutdoorCompareCoords } = await import("./outdoorCompareCoords");

    const result = await resolveOutdoorCompareCoords("user-1");

    expect(result?.label).toBe("Freeze map location");
  });
});
