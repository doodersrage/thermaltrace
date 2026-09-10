import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AstroCookies } from "astro";
import type { Session, User } from "@supabase/supabase-js";
import type { DashboardShell } from "./dashboardShell";
import type { Entitlements } from "./entitlements";

const mockGetAuthFromCookies = vi.fn();
const mockIsUserAdmin = vi.fn();
const mockGetUserEntitlements = vi.fn();
const mockCountUnacknowledgedAlerts = vi.fn();
const mockListUserHouseholds = vi.fn();
const mockGetOrCreateHouseholdForUser = vi.fn();
const mockFetchLatestSensorValues = vi.fn();

vi.mock("./auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

vi.mock("./adminAccess", () => ({
  isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a),
}));

vi.mock("./entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

vi.mock("./alertEvents", () => ({
  countUnacknowledgedAlerts: (...a: unknown[]) =>
    mockCountUnacknowledgedAlerts(...a),
}));

vi.mock("./households", () => ({
  listUserHouseholds: (...a: unknown[]) => mockListUserHouseholds(...a),
  getOrCreateHouseholdForUser: (...a: unknown[]) =>
    mockGetOrCreateHouseholdForUser(...a),
}));

vi.mock("./sensorReadings", () => ({
  fetchLatestSensorValues: (...a: unknown[]) =>
    mockFetchLatestSensorValues(...a),
}));

function fakeUser(id = "user-1"): User {
  return { id, email: "u@example.com" } as User;
}

function fakeSession(): Session {
  return { access_token: "a", refresh_token: "r" } as Session;
}

function fakeEntitlements(overrides: Partial<Entitlements> = {}): Entitlements {
  return {
    tier: "free",
    canUsePortfolio: false,
    canDownloadCsv: false,
    maxDevices: 3,
    maxOwnedHouseholds: 1,
    ...overrides,
  } as Entitlements;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset();
  mockIsUserAdmin.mockReset().mockResolvedValue(false);
  mockGetUserEntitlements.mockReset().mockResolvedValue(fakeEntitlements());
  mockCountUnacknowledgedAlerts.mockReset().mockResolvedValue(0);
  mockListUserHouseholds.mockReset().mockResolvedValue({
    households: [{ id: "hh-1", name: "Home" }],
    error: null,
  });
  mockGetOrCreateHouseholdForUser.mockReset().mockResolvedValue({
    householdId: "hh-1",
  });
  mockFetchLatestSensorValues.mockReset().mockResolvedValue([
    { sensor_id: "s1", recorded_at: new Date().toISOString() },
  ]);
});

describe("loadDashboardShell", () => {
  it("returns null when auth is missing", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { loadDashboardShell } = await import("./dashboardShell");

    const result = await loadDashboardShell({} as AstroCookies);

    expect(result).toBeNull();
    expect(mockGetUserEntitlements).not.toHaveBeenCalled();
    expect(mockFetchLatestSensorValues).not.toHaveBeenCalled();
  });

  it("gates portfolio in Monitor from entitlements or multi-household", async () => {
    mockGetAuthFromCookies.mockResolvedValue({
      session: fakeSession(),
      user: fakeUser(),
    });
    mockGetUserEntitlements.mockResolvedValue(
      fakeEntitlements({ canUsePortfolio: true }),
    );
    mockListUserHouseholds.mockResolvedValue({
      households: [{ id: "hh-1", name: "Home" }],
      error: null,
    });

    const { loadDashboardShell } = await import("./dashboardShell");
    const withEntitlement = await loadDashboardShell({} as AstroCookies);
    expect(withEntitlement?.showPortfolioInMonitor).toBe(true);

    mockGetUserEntitlements.mockResolvedValue(
      fakeEntitlements({ canUsePortfolio: false }),
    );
    mockListUserHouseholds.mockResolvedValue({
      households: [
        { id: "hh-1", name: "Home" },
        { id: "hh-2", name: "Cabin" },
      ],
      error: null,
    });
    const withTwoHomes = await loadDashboardShell({} as AstroCookies);
    expect(withTwoHomes?.showPortfolioInMonitor).toBe(true);
    expect(withTwoHomes?.householdCount).toBe(2);
  });

  it("skips latest fetch when includeLiveLag is false", async () => {
    mockGetAuthFromCookies.mockResolvedValue({
      session: fakeSession(),
      user: fakeUser(),
    });
    const { loadDashboardShell } = await import("./dashboardShell");

    const result = await loadDashboardShell({} as AstroCookies, {
      includeLiveLag: false,
    });

    expect(mockFetchLatestSensorValues).not.toHaveBeenCalled();
    expect(result?.latest).toBeNull();
    expect(result?.liveLagging).toBe(false);
  });

  it("stores latest rows when live lag is included", async () => {
    mockGetAuthFromCookies.mockResolvedValue({
      session: fakeSession(),
      user: fakeUser(),
    });
    const rows = [
      {
        sensor_id: "s1",
        recorded_at: new Date(Date.now() - 60_000).toISOString(),
      },
    ];
    mockFetchLatestSensorValues.mockResolvedValue(rows);

    const { loadDashboardShell } = await import("./dashboardShell");
    const result = await loadDashboardShell({} as AstroCookies);

    expect(mockFetchLatestSensorValues).toHaveBeenCalledWith("hh-1");
    expect(result?.latest).toEqual(rows);
    expect(result?.liveLagging).toBe(false);
    expect(result?.activeHouseholdId).toBe("hh-1");
  });
});

describe("latestFromShell", () => {
  it("returns shell latest only when household matches", async () => {
    const { latestFromShell } = await import("./dashboardShell");
    const latest = [{ sensor_id: "s1", recorded_at: "2026-01-01T00:00:00Z" }];
    const shell = {
      activeHouseholdId: "hh-1",
      latest,
    } as unknown as DashboardShell;

    expect(latestFromShell(shell, "hh-1")).toEqual(latest);
    expect(latestFromShell(shell, "hh-other")).toBeNull();
    expect(latestFromShell(null, "hh-1")).toBeNull();
    expect(latestFromShell(shell, null)).toBeNull();
  });
});

describe("computeLiveLagging", () => {
  it("treats empty or stale rows as lagging", async () => {
    const { computeLiveLagging } = await import("./dashboardShell");
    expect(computeLiveLagging([])).toBe(true);
    expect(
      computeLiveLagging([
        {
          sensor_id: "s1",
          recorded_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        },
      ] as never),
    ).toBe(true);
    expect(
      computeLiveLagging([
        {
          sensor_id: "s1",
          recorded_at: new Date().toISOString(),
        },
      ] as never),
    ).toBe(false);
  });
});
