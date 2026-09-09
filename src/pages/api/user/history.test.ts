import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
}));

const mockFetchGarageTempChartData = vi.fn();
const mockFetchGarageTempHistory = vi.fn();
const mockFetchHistoryFilterOptions = vi.fn();
vi.mock("../../../lib/garageTempsHistory", () => ({
  fetchGarageTempChartData: (...a: unknown[]) => mockFetchGarageTempChartData(...a),
  fetchGarageTempHistory: (...a: unknown[]) => mockFetchGarageTempHistory(...a),
  fetchHistoryFilterOptions: (...a: unknown[]) => mockFetchHistoryFilterOptions(...a),
}));

const mockGetUserHouseholdId = vi.fn();
vi.mock("../../../lib/households", () => ({
  getUserHouseholdId: (...a: unknown[]) => mockGetUserHouseholdId(...a),
}));

const mockGetIndoorReferenceSensorId = vi.fn();
vi.mock("../../../lib/indoorReference", () => ({
  getIndoorReferenceSensorId: (...a: unknown[]) => mockGetIndoorReferenceSensorId(...a),
}));

const mockFetchHouseChartOverlay = vi.fn();
vi.mock("../../../lib/houseContext", () => ({
  fetchHouseChartOverlay: (...a: unknown[]) => mockFetchHouseChartOverlay(...a),
}));

const mockListConnectionsForHousehold = vi.fn();
vi.mock("../../../lib/thermostatConnections", () => ({
  listConnectionsForHousehold: (...a: unknown[]) => mockListConnectionsForHousehold(...a),
}));

function makeContext(search = ""): APIContext {
  const url = new URL(`https://example.com/api/user/history${search}`);
  return {
    request: new Request(url),
    cookies: {},
    url,
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1" },
  });
  mockFetchGarageTempChartData.mockReset().mockResolvedValue({
    points: [{ timestamp: "2024-01-01", tempf: 40 }],
    error: null,
  });
  mockFetchGarageTempHistory.mockReset().mockResolvedValue({
    readings: [],
    page: 1,
    pageSize: 20,
    total: 0,
  });
  mockFetchHistoryFilterOptions.mockReset().mockResolvedValue({
    feeds: ["Garage"],
    probes: ["0"],
    error: null,
  });
  mockGetUserHouseholdId.mockReset().mockResolvedValue("house-1");
  mockListConnectionsForHousehold.mockReset().mockResolvedValue([]);
  mockGetIndoorReferenceSensorId.mockReset().mockResolvedValue(null);
  mockFetchHouseChartOverlay.mockReset().mockResolvedValue({
    points: [],
    source: null,
  });
});

describe("GET /api/user/history", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./history");

    const response = await GET(makeContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns chart, readings, and filters with defaults", async () => {
    const { GET } = await import("./history");

    const response = await GET(makeContext());
    const body = (await response.json()) as {
      days: number;
      chart: { points: unknown[] };
      filters: { feeds: string[] };
      house_overlay?: unknown;
    };

    expect(mockFetchGarageTempChartData).toHaveBeenCalledWith("user-1", 7, {
      feedName: undefined,
      probeKey: undefined,
      from: undefined,
      to: undefined,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(body.days).toBe(7);
    expect(body.chart.points).toHaveLength(1);
    expect(body.filters.feeds).toEqual(["Garage"]);
    expect(body.house_overlay).toBeUndefined();
  });

  it("includes house overlay when requested and clamps days", async () => {
    const { GET } = await import("./history");

    const response = await GET(
      makeContext("?days=999&include=house_overlay&feed=Garage"),
    );
    const body = (await response.json()) as {
      days: number;
      house_overlay: unknown;
      chart?: unknown;
    };

    expect(mockFetchHouseChartOverlay).toHaveBeenCalled();
    expect(body.days).toBe(90);
    expect(body.house_overlay).toEqual({ source: null, points: [] });
    expect(body.chart).toBeUndefined();
  });
});
