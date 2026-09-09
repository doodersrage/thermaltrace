import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
}));

const mockFetchCrossPropertySnapshots = vi.fn();
vi.mock("../../../lib/crossProperty", () => ({
  fetchCrossPropertySnapshots: (...a: unknown[]) => mockFetchCrossPropertySnapshots(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("../../../lib/entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

const mockScorePropertyHealth = vi.fn();
vi.mock("../../../lib/portfolioHealth", () => ({
  scorePropertyHealth: (...a: unknown[]) => mockScorePropertyHealth(...a),
}));

function makeContext(): APIContext {
  return {
    cookies: {},
    request: new Request("https://example.com/api/user/portfolio"),
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1" },
  });
  mockGetUserEntitlements.mockReset().mockResolvedValue({ canUsePortfolio: true });
  mockFetchCrossPropertySnapshots.mockReset().mockResolvedValue({
    properties: [
      {
        householdId: "house-1",
        name: "Cabin",
        role: "owner",
        minTempF: 42,
        freezeThresholdF: 40,
        atRisk: false,
        lastReadingAt: "2024-01-01T00:00:00Z",
        deviceCount: 2,
        floodWet: false,
      },
    ],
    error: null,
  });
  mockScorePropertyHealth.mockReset().mockReturnValue({
    score: 90,
    label: "healthy",
    detail: "All good",
  });
});

describe("GET /api/user/portfolio", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./portfolio");

    const response = await GET(makeContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 when portfolio is not entitled", async () => {
    mockGetUserEntitlements.mockResolvedValue({ canUsePortfolio: false });
    const { GET } = await import("./portfolio");

    const response = await GET(makeContext());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: "Portfolio requires Pro or Portfolio plan",
    });
  });

  it("returns 500 when snapshot fetch fails", async () => {
    mockFetchCrossPropertySnapshots.mockResolvedValue({
      properties: [],
      error: "db down",
    });
    const { GET } = await import("./portfolio");

    const response = await GET(makeContext());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "db down" });
  });

  it("returns mapped properties with health scores", async () => {
    const { GET } = await import("./portfolio");

    const response = await GET(makeContext());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(mockScorePropertyHealth).toHaveBeenCalled();
    expect(json).toEqual({
      properties: [
        {
          household_id: "house-1",
          name: "Cabin",
          role: "owner",
          min_temp_f: 42,
          freeze_threshold_f: 40,
          at_risk: false,
          last_reading_at: "2024-01-01T00:00:00Z",
          device_count: 2,
          health_score: 90,
          health_label: "healthy",
          health_detail: "All good",
          flood_wet: false,
        },
      ],
    });
  });
});
