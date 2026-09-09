import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
}));

const mockGetUserHouseholdId = vi.fn();
vi.mock("../../../lib/households", () => ({
  getUserHouseholdId: (...a: unknown[]) => mockGetUserHouseholdId(...a),
}));

const mockGetAlertSettingsForUser = vi.fn();
vi.mock("../../../lib/notify", () => ({
  getAlertSettingsForUser: (...a: unknown[]) => mockGetAlertSettingsForUser(...a),
}));

const mockGetUserPreferences = vi.fn();
vi.mock("../../../lib/userPreferences", () => ({
  getUserPreferences: (...a: unknown[]) => mockGetUserPreferences(...a),
}));

const mockFetchGarageTempHistory = vi.fn();
const mockFetchGarageTempChartData = vi.fn();
vi.mock("../../../lib/garageTempsHistory", () => ({
  fetchGarageTempHistory: (...a: unknown[]) => mockFetchGarageTempHistory(...a),
  fetchGarageTempChartData: (...a: unknown[]) => mockFetchGarageTempChartData(...a),
}));

const mockListHouseholdDevices = vi.fn();
vi.mock("../../../lib/devices", () => ({
  listHouseholdDevices: (...a: unknown[]) => mockListHouseholdDevices(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("../../../lib/entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

function makeContext(): APIContext {
  return {
    request: new Request("https://example.com/api/user/export"),
    cookies: {},
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1", email: "user@example.com", user_metadata: {} },
  });
  mockGetUserHouseholdId.mockReset().mockResolvedValue("house-1");
  mockGetUserPreferences.mockReset().mockResolvedValue({ useCelsius: false });
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue({ enabled: true });
  mockFetchGarageTempHistory.mockReset().mockResolvedValue({
    readings: [{ id: 1 }],
  });
  mockFetchGarageTempChartData.mockReset().mockResolvedValue({
    points: [{ timestamp: "2024-01-01", tempf: 40 }],
  });
  mockListHouseholdDevices.mockReset().mockResolvedValue({
    devices: [
      {
        name: "Garage Pi",
        source: "push",
        space: "garage",
        sensors: [{ key: "0", label: "North", kind: "temperature" }],
        meta: { rssi: -50 },
      },
    ],
  });
  mockGetUserEntitlements.mockReset().mockResolvedValue({
    tier: "pro",
    canDownloadCsv: true,
    canUseClaimsPack: true,
    canCreateShareLinks: true,
    canCreateFamilyShareLink: false,
    canUsePush: true,
    canUseSms: false,
    historyDays: 365,
  });
});

describe("GET /api/user/export", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./export");

    const response = await GET(makeContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns a downloadable export payload for the user", async () => {
    const { GET } = await import("./export");

    const response = await GET(makeContext());
    const body = (await response.json()) as {
      user: unknown;
      history: unknown;
      devices: unknown;
      entitlements: { tier: string };
      exported_at: unknown;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain(
      "thermaltrace-export.json",
    );
    expect(body.user).toEqual({ id: "user-1", email: "user@example.com" });
    expect(body.history).toEqual([{ id: 1 }]);
    expect(body.devices).toEqual([
      {
        name: "Garage Pi",
        source: "push",
        space: "garage",
        sensors: [{ key: "0", label: "North", kind: "temperature" }],
        meta: { rssi: -50 },
      },
    ]);
    expect(body.entitlements.tier).toBe("pro");
    expect(typeof body.exported_at).toBe("string");
  });
});
