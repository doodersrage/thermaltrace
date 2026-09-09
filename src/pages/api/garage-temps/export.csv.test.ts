import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockCanDownloadHistoryCsv = vi.fn();
vi.mock("../../../lib/adminAccess", () => ({
  canDownloadHistoryCsv: (...a: unknown[]) => mockCanDownloadHistoryCsv(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("../../../lib/entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

const mockClampIsoToHistoryWindow = vi.fn();
vi.mock("../../../lib/retentionSchedule", () => ({
  clampIsoToHistoryWindow: (...a: unknown[]) => mockClampIsoToHistoryWindow(...a),
}));

const mockBuildGarageTempsCsv = vi.fn();
const mockFetchAllGarageTempReadings = vi.fn();
vi.mock("../../../lib/garageTempsHistory", () => ({
  buildGarageTempsCsv: (...a: unknown[]) => mockBuildGarageTempsCsv(...a),
  fetchAllGarageTempReadings: (...a: unknown[]) => mockFetchAllGarageTempReadings(...a),
}));

function makeContext(query: string): APIContext {
  const url = new URL(`https://example.com/api/garage-temps/export.csv${query}`);
  return { url, cookies: {} } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "t" },
    user: { id: "user-1" },
  });
  mockCanDownloadHistoryCsv.mockReset().mockResolvedValue(true);
  mockGetUserEntitlements.mockReset().mockResolvedValue({ historyDays: 90 });
  mockClampIsoToHistoryWindow.mockReset().mockImplementation((from: string | undefined) => from ?? "clamped-from");
  mockFetchAllGarageTempReadings.mockReset().mockResolvedValue({ readings: [], error: null });
  mockBuildGarageTempsCsv.mockReset().mockReturnValue("timestamp,tempF\n");
});

describe("GET /api/garage-temps/export.csv", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./export.csv");

    const response = await GET(makeContext(""));

    expect(response.status).toBe(401);
  });

  it("returns 403 when the user lacks csv download access", async () => {
    mockCanDownloadHistoryCsv.mockResolvedValue(false);
    const { GET } = await import("./export.csv");

    const response = await GET(makeContext(""));

    expect(response.status).toBe(403);
    expect(await response.text()).toBe(
      "CSV export requires an active subscription or admin access",
    );
  });

  it("passes trimmed feed/probe filters and the clamped date range through", async () => {
    const { GET } = await import("./export.csv");
    const expectedFrom = new Date("2024-01-01");
    expectedFrom.setHours(0, 0, 0, 0);

    await GET(makeContext("?feed=%20Garage%20&probe=avg&from=2024-01-01"));

    expect(mockFetchAllGarageTempReadings).toHaveBeenCalledWith("user-1", {
      feedName: "Garage",
      probeKey: "avg",
      from: expectedFrom.toISOString(),
      to: undefined,
    });
    expect(mockClampIsoToHistoryWindow).toHaveBeenCalledWith(expectedFrom.toISOString(), 90);
  });

  it("omits empty feed/probe filters", async () => {
    const { GET } = await import("./export.csv");

    await GET(makeContext(""));

    expect(mockFetchAllGarageTempReadings).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ feedName: undefined, probeKey: undefined }),
    );
  });

  it("returns 500 with the error text when fetching readings fails", async () => {
    mockFetchAllGarageTempReadings.mockResolvedValue({ readings: [], error: "db down" });
    const { GET } = await import("./export.csv");

    const response = await GET(makeContext(""));

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("db down");
  });

  it("returns the built csv with the correct headers", async () => {
    mockBuildGarageTempsCsv.mockReturnValue("timestamp,tempF\n2024-01-01,40\n");
    const { GET } = await import("./export.csv");

    const response = await GET(makeContext(""));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toContain(
      "attachment; filename=\"thermaltrace-readings-",
    );
    expect(await response.text()).toBe("timestamp,tempF\n2024-01-01,40\n");
  });
});
