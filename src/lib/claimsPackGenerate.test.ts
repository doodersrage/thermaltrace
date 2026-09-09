import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Entitlements } from "./entitlements";

const mockFetchGarageTempChartData = vi.fn();
vi.mock("./garageTempsHistory", () => ({
  fetchGarageTempChartData: (...a: unknown[]) => mockFetchGarageTempChartData(...a),
}));

const mockGetAlertSettingsForUser = vi.fn();
vi.mock("./notify", () => ({
  getAlertSettingsForUser: (...a: unknown[]) => mockGetAlertSettingsForUser(...a),
}));

const mockGetUserHouseholdId = vi.fn();
vi.mock("./households", () => ({
  getUserHouseholdId: (...a: unknown[]) => mockGetUserHouseholdId(...a),
}));

const mockListHouseholdDevices = vi.fn();
vi.mock("./devices", () => ({
  listHouseholdDevices: (...a: unknown[]) => mockListHouseholdDevices(...a),
}));

const mockListAlertEventsInRange = vi.fn();
vi.mock("./alertEvents", () => ({
  listAlertEventsInRange: (...a: unknown[]) => mockListAlertEventsInRange(...a),
}));

const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();
vi.mock("./supabase", () => ({
  createServerClient: () => ({ from: (...a: unknown[]) => mockFrom(...a) }),
}));

const mockBuildClaimsPackData = vi.fn();
vi.mock("./claimsPack", () => ({
  buildClaimsPackData: (...a: unknown[]) => mockBuildClaimsPackData(...a),
}));

function entitlements(overrides: Partial<Entitlements> = {}): Entitlements {
  return { tier: "free", historyDays: 30, ...overrides } as unknown as Entitlements;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));

  mockFetchGarageTempChartData.mockReset().mockResolvedValue({ points: [], error: null });
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue({ freezeThresholdF: 35 });
  mockGetUserHouseholdId.mockReset().mockResolvedValue("house-1");
  mockListHouseholdDevices.mockReset().mockResolvedValue({ devices: [], error: null });
  mockListAlertEventsInRange.mockReset().mockResolvedValue([]);
  mockMaybeSingle.mockReset().mockResolvedValue({ data: { name: "The Smiths" } });
  mockFrom.mockReset().mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
  });
  mockBuildClaimsPackData.mockReset().mockReturnValue({ exportedAt: "stub" });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("parseClaimsDateParam", () => {
  it("returns undefined for a blank, null, or undefined value", async () => {
    const { parseClaimsDateParam } = await import("./claimsPackGenerate");

    expect(parseClaimsDateParam(undefined)).toBeUndefined();
    expect(parseClaimsDateParam(null)).toBeUndefined();
    expect(parseClaimsDateParam("   ")).toBeUndefined();
  });

  it("returns undefined for an unparseable date", async () => {
    const { parseClaimsDateParam } = await import("./claimsPackGenerate");

    expect(parseClaimsDateParam("not-a-date")).toBeUndefined();
  });

  it("normalizes to start-of-day by default", async () => {
    const { parseClaimsDateParam } = await import("./claimsPackGenerate");

    expect(parseClaimsDateParam("2024-06-15")).toBe("2024-06-15T00:00:00.000Z");
  });

  it("normalizes to end-of-day when endOfDay is true", async () => {
    const { parseClaimsDateParam } = await import("./claimsPackGenerate");

    expect(parseClaimsDateParam("2024-06-15", true)).toBe("2024-06-15T23:59:59.999Z");
  });
});

describe("claimsDateQueryValue", () => {
  it("returns the date-only prefix of an ISO string", async () => {
    const { claimsDateQueryValue } = await import("./claimsPackGenerate");

    expect(claimsDateQueryValue("2024-06-15T23:59:59.999Z")).toBe("2024-06-15");
  });
});

describe("generateClaimsPackForUser", () => {
  const baseUser = { id: "user-1", email: "owner@example.com", user_metadata: {} };

  it("defaults the range to the plan's history window ending now", async () => {
    const { generateClaimsPackForUser } = await import("./claimsPackGenerate");

    const result = await generateClaimsPackForUser(baseUser, entitlements({ historyDays: 30 }), {}, "https://example.com");

    // historyCutoffIso(min(30, 30)) from "now" (2024-06-15T12:00:00Z) = 2024-05-16T12:00:00.000Z
    expect(result.fromQ).toBe("2024-05-16");
    expect(result.toQ).toBe("2024-06-15");
  });

  it("uses an explicit from/to range when given, clamped to the history window", async () => {
    const { generateClaimsPackForUser } = await import("./claimsPackGenerate");

    const result = await generateClaimsPackForUser(
      baseUser,
      entitlements({ historyDays: 30 }),
      { from: "2024-06-01", to: "2024-06-10" },
      "https://example.com",
    );

    expect(result.fromQ).toBe("2024-06-01");
    expect(result.toQ).toBe("2024-06-10");
  });

  it("clamps an out-of-window 'from' date to the history cutoff", async () => {
    const { generateClaimsPackForUser } = await import("./claimsPackGenerate");

    const result = await generateClaimsPackForUser(
      baseUser,
      entitlements({ historyDays: 7 }),
      { from: "2020-01-01" },
      "https://example.com",
    );

    // historyCutoffIso(7) from 2024-06-15T12:00:00Z = 2024-06-08
    expect(result.fromQ).toBe("2024-06-08");
  });

  it("skips the devices and household lookups when there is no household", async () => {
    mockGetUserHouseholdId.mockResolvedValue(null);
    const { generateClaimsPackForUser } = await import("./claimsPackGenerate");

    const result = await generateClaimsPackForUser(baseUser, entitlements(), {}, "https://example.com");

    expect(mockListHouseholdDevices).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(result.householdId).toBeNull();
    expect(mockBuildClaimsPackData).toHaveBeenCalledWith(
      expect.objectContaining({ householdLabel: "owner@example.com", devices: [] }),
    );
  });

  it("maps devices, filtering out invisible sensors", async () => {
    mockListHouseholdDevices.mockResolvedValue({
      devices: [
        {
          name: "Garage",
          space: "Outbuilding",
          sensors: [
            { label: "Probe 1", kind: "temperature", visible: true },
            { label: "Hidden", kind: "humidity", visible: false },
          ],
        },
      ],
      error: null,
    });
    const { generateClaimsPackForUser } = await import("./claimsPackGenerate");

    await generateClaimsPackForUser(baseUser, entitlements(), {}, "https://example.com");

    expect(mockBuildClaimsPackData).toHaveBeenCalledWith(
      expect.objectContaining({
        devices: [
          { name: "Garage", space: "Outbuilding", sensors: [{ label: "Probe 1", kind: "temperature" }] },
        ],
      }),
    );
  });

  it("falls back from the household row name to the user's email, then 'Household'", async () => {
    const { generateClaimsPackForUser } = await import("./claimsPackGenerate");

    await generateClaimsPackForUser(baseUser, entitlements(), {}, "https://example.com");
    expect(mockBuildClaimsPackData).toHaveBeenCalledWith(
      expect.objectContaining({ householdLabel: "The Smiths" }),
    );

    mockMaybeSingle.mockResolvedValue({ data: { name: "  " } });
    await generateClaimsPackForUser(baseUser, entitlements(), {}, "https://example.com");
    expect(mockBuildClaimsPackData).toHaveBeenCalledWith(
      expect.objectContaining({ householdLabel: "owner@example.com" }),
    );

    mockMaybeSingle.mockResolvedValue({ data: null });
    await generateClaimsPackForUser(
      { ...baseUser, email: null },
      entitlements(),
      {},
      "https://example.com",
    );
    expect(mockBuildClaimsPackData).toHaveBeenCalledWith(
      expect.objectContaining({ householdLabel: "Household" }),
    );
  });

  it("strips a trailing slash from siteUrl and builds csv export urls with the query range", async () => {
    const { generateClaimsPackForUser } = await import("./claimsPackGenerate");

    await generateClaimsPackForUser(
      baseUser,
      entitlements(),
      { from: "2024-06-01", to: "2024-06-10" },
      "https://example.com/",
    );

    expect(mockBuildClaimsPackData).toHaveBeenCalledWith(
      expect.objectContaining({
        readingsCsvUrl: "https://example.com/api/garage-temps/export.csv?from=2024-06-01&to=2024-06-10",
        alertsCsvUrl: "https://example.com/api/alerts/export.csv?from=2024-06-01&to=2024-06-10",
        historyUrl:
          "https://example.com/dashboard/history?from=2024-06-01&to=2024-06-10",
      }),
    );
  });

  it("caps the chart window at the plan's history days even when the requested range is wider", async () => {
    const { generateClaimsPackForUser } = await import("./claimsPackGenerate");

    // "now" is frozen at 2024-06-15T12:00:00Z; requesting a future end date makes
    // the raw from->to span (~16 days) far exceed the 5-day plan history window.
    await generateClaimsPackForUser(
      baseUser,
      entitlements({ historyDays: 5 }),
      { to: "2024-06-25" },
      "https://example.com",
    );

    expect(mockFetchGarageTempChartData).toHaveBeenCalledWith("user-1", 5, {
      from: "2024-06-10T12:00:00.000Z",
      to: "2024-06-25T23:59:59.999Z",
    });
  });

  it("returns the pack, householdId, fromQ, and toQ", async () => {
    mockBuildClaimsPackData.mockReturnValue({ exportedAt: "pack-stub" });
    const { generateClaimsPackForUser } = await import("./claimsPackGenerate");

    const result = await generateClaimsPackForUser(
      baseUser,
      entitlements(),
      { from: "2024-06-01", to: "2024-06-10" },
      "https://example.com",
    );

    expect(result).toEqual({
      pack: { exportedAt: "pack-stub" },
      householdId: "house-1",
      fromQ: "2024-06-01",
      toQ: "2024-06-10",
    });
  });
});
