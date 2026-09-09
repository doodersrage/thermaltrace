import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockGetOrCreateHouseholdForUser = vi.fn();
vi.mock("../../../lib/households", () => ({
  getOrCreateHouseholdForUser: (...a: unknown[]) => mockGetOrCreateHouseholdForUser(...a),
}));

const mockListHouseholdDevices = vi.fn();
vi.mock("../../../lib/devices", () => ({
  listHouseholdDevices: (...a: unknown[]) => mockListHouseholdDevices(...a),
}));

const mockFetchLatestSensorValues = vi.fn();
vi.mock("../../../lib/sensorReadings", () => ({
  fetchLatestSensorValues: (...a: unknown[]) => mockFetchLatestSensorValues(...a),
}));

function makeContext(): APIContext {
  return { cookies: {} } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    user: { id: "user-1", email: "user@example.com" },
  });
  mockGetOrCreateHouseholdForUser.mockReset().mockResolvedValue({ householdId: "house-1" });
  mockListHouseholdDevices.mockReset().mockResolvedValue({ devices: [] });
  mockFetchLatestSensorValues.mockReset().mockResolvedValue([]);
});

describe("GET /api/devices/ingest-status", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ user: null });
    const { GET } = await import("./ingest-status");

    const response = await GET(makeContext());

    expect(response.status).toBe(401);
  });

  it("returns an empty summary when the user has no household", async () => {
    mockGetOrCreateHouseholdForUser.mockResolvedValue({ householdId: null });
    const { GET } = await import("./ingest-status");

    const response = await GET(makeContext());

    expect(await response.json()).toEqual({ waiting: false, devices: [], latestCount: 0 });
    expect(mockListHouseholdDevices).not.toHaveBeenCalled();
  });

  it("lists push devices that haven't been seen yet", async () => {
    mockListHouseholdDevices.mockResolvedValue({
      devices: [
        { id: "d1", name: "Garage", source: "push", last_seen_at: null, sensors: [] },
        { id: "d2", name: "Attic", source: "push", last_seen_at: "2024-01-01", sensors: [{ key: "temp" }] },
        { id: "d3", name: "Pull feed", source: "pull", last_seen_at: null, sensors: [] },
      ],
    });
    mockFetchLatestSensorValues.mockResolvedValue([{ id: "r1" }]);
    const { GET } = await import("./ingest-status");

    const response = await GET(makeContext());
    const json = (await response.json()) as Record<string, unknown>;

    expect(json).toMatchObject({
      waiting: true,
      waitingCount: 1,
      seenCount: 1,
      latestCount: 1,
    });
    expect(json.devices).toEqual([
      { id: "d1", name: "Garage", sensorKeys: [], autoMap: true, lastSeenAt: null },
    ]);
  });
});
