import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("../../../lib/entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

const mockClampIsoToHistoryWindow = vi.fn();
vi.mock("../../../lib/retentionSchedule", () => ({
  clampIsoToHistoryWindow: (...a: unknown[]) => mockClampIsoToHistoryWindow(...a),
}));

const mockListAlertEventsInRange = vi.fn();
const mockBuildAlertEventsCsv = vi.fn();
vi.mock("../../../lib/alertEvents", () => ({
  listAlertEventsInRange: (...a: unknown[]) => mockListAlertEventsInRange(...a),
  buildAlertEventsCsv: (...a: unknown[]) => mockBuildAlertEventsCsv(...a),
}));

function makeContext(query: string): APIContext {
  const url = new URL(`https://example.com/api/alerts/export.csv${query}`);
  return { url, cookies: {} } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "t" },
    user: { id: "user-1" },
  });
  mockGetUserEntitlements.mockReset().mockResolvedValue({
    canUseClaimsPack: true,
    historyDays: 365,
  });
  mockClampIsoToHistoryWindow.mockReset().mockImplementation((from: string | undefined) => from ?? "clamped-from");
  mockListAlertEventsInRange.mockReset().mockResolvedValue([]);
  mockBuildAlertEventsCsv.mockReset().mockReturnValue("created_at,kind\n");
  vi.useFakeTimers();
  vi.setSystemTime("2024-06-15T12:00:00.000Z");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/alerts/export.csv", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./export.csv");

    const response = await GET(makeContext(""));

    expect(response.status).toBe(401);
    expect(await response.text()).toBe("Unauthorized");
  });

  it("returns 403 when the plan doesn't include claims pack access", async () => {
    mockGetUserEntitlements.mockResolvedValue({ canUseClaimsPack: false, historyDays: 30 });
    const { GET } = await import("./export.csv");

    const response = await GET(makeContext(""));

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Claims pack export requires Pro");
  });

  it("clamps the from date to the plan's history window", async () => {
    const { GET } = await import("./export.csv");

    await GET(makeContext("?from=2020-01-01"));

    expect(mockClampIsoToHistoryWindow).toHaveBeenCalledWith(
      expect.any(String),
      365,
    );
  });

  it("ignores an unparseable from/to date", async () => {
    const { GET } = await import("./export.csv");

    await GET(makeContext("?from=not-a-date"));

    expect(mockClampIsoToHistoryWindow).toHaveBeenCalledWith(undefined, 365);
  });

  it("defaults 'to' to now when not provided", async () => {
    const { GET } = await import("./export.csv");

    await GET(makeContext(""));

    expect(mockListAlertEventsInRange).toHaveBeenCalledWith(
      "user-1",
      "clamped-from",
      "2024-06-15T12:00:00.000Z",
    );
  });

  it("uses the end of the given 'to' day rather than the exact instant given", async () => {
    const { GET } = await import("./export.csv");

    await GET(makeContext("?to=2024-06-01"));

    const [, , to] = mockListAlertEventsInRange.mock.calls[0]!;
    const expected = new Date("2024-06-01");
    expected.setHours(23, 59, 59, 999);
    expect(to).toBe(expected.toISOString());
  });

  it("returns the csv with the correct headers and filename", async () => {
    mockBuildAlertEventsCsv.mockReturnValue("created_at,kind\n2024-06-01,freeze\n");
    const { GET } = await import("./export.csv");

    const response = await GET(makeContext(""));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="thermaltrace-alert-events-2024-06-15.csv"',
    );
    expect(await response.text()).toBe("created_at,kind\n2024-06-01,freeze\n");
  });
});
