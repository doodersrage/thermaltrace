import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockComputeDoorOpenSessions = vi.fn();
vi.mock("../../../lib/doorDuration", () => ({
  computeDoorOpenSessions: (...a: unknown[]) => mockComputeDoorOpenSessions(...a),
}));

const mockListDoorEvents = vi.fn();
vi.mock("../../../lib/doorEvents", () => ({
  listDoorEvents: (...a: unknown[]) => mockListDoorEvents(...a),
}));

const mockListHouseholdDevices = vi.fn();
vi.mock("../../../lib/devices", () => ({
  listHouseholdDevices: (...a: unknown[]) => mockListHouseholdDevices(...a),
}));

const mockGetOrCreateHouseholdForUser = vi.fn();
vi.mock("../../../lib/households", () => ({
  getOrCreateHouseholdForUser: (...a: unknown[]) => mockGetOrCreateHouseholdForUser(...a),
}));

const mockFetchRecentBoolReadings = vi.fn();
vi.mock("../../../lib/sensorReadings", () => ({
  fetchRecentBoolReadings: (...a: unknown[]) => mockFetchRecentBoolReadings(...a),
}));

function makeContext(search = ""): APIContext {
  return {
    cookies: {},
    url: new URL(`https://example.com/api/user/door-events${search}`),
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1", email: "user@example.com" },
  });
  mockGetOrCreateHouseholdForUser.mockReset().mockResolvedValue({ householdId: "house-1" });
  mockListHouseholdDevices.mockReset().mockResolvedValue({ devices: [] });
  mockListDoorEvents.mockReset().mockResolvedValue([]);
  mockFetchRecentBoolReadings.mockReset().mockResolvedValue([]);
  mockComputeDoorOpenSessions.mockReset().mockReturnValue([]);
});

describe("GET /api/user/door-events", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./door-events");

    const response = await GET(makeContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns empty results when the user has no household", async () => {
    mockGetOrCreateHouseholdForUser.mockResolvedValue({ householdId: null });
    const { GET } = await import("./door-events");

    const response = await GET(makeContext());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ live_sessions: [], history: [] });
    expect(mockListHouseholdDevices).not.toHaveBeenCalled();
  });

  it("defaults the limit to 12 and clamps out-of-range values", async () => {
    const { GET } = await import("./door-events");

    await GET(makeContext());
    expect(mockListDoorEvents).toHaveBeenCalledWith("house-1", 12);

    await GET(makeContext("?limit=500"));
    expect(mockListDoorEvents).toHaveBeenCalledWith("house-1", 50);

    await GET(makeContext("?limit=0"));
    expect(mockListDoorEvents).toHaveBeenCalledWith("house-1", 1);

    await GET(makeContext("?limit=not-a-number"));
    expect(mockListDoorEvents).toHaveBeenCalledWith("house-1", 12);
  });

  it("builds live sessions only from door-kind sensors", async () => {
    mockListHouseholdDevices.mockResolvedValue({
      devices: [
        {
          id: "device-1",
          sensors: [
            { id: "door-sensor", kind: "door", label: "Garage Door" },
            { id: "temp-sensor", kind: "temperature", label: "Garage Temp" },
          ],
        },
      ],
    });
    mockFetchRecentBoolReadings.mockResolvedValue([
      { value: true, recordedAt: "2024-01-01T00:00:00Z" },
    ]);
    mockComputeDoorOpenSessions.mockReturnValue([
      {
        label: "Garage Door",
        openedAt: "2024-01-01T00:00:00Z",
        closedAt: null,
        durationMs: null,
        stillOpen: true,
      },
    ]);
    const { GET } = await import("./door-events");

    const response = await GET(makeContext());
    const json = await response.json();

    expect(mockFetchRecentBoolReadings).toHaveBeenCalledTimes(1);
    expect(mockFetchRecentBoolReadings).toHaveBeenCalledWith(
      "door-sensor",
      expect.any(String),
    );
    expect(json).toEqual({
      live_sessions: [
        {
          label: "Garage Door",
          opened_at: "2024-01-01T00:00:00Z",
          closed_at: null,
          duration_ms: null,
          still_open: true,
        },
      ],
      history: [],
    });
  });

  it("maps history events into the response shape", async () => {
    mockListDoorEvents.mockResolvedValue([
      {
        id: "evt-1",
        label: "Garage Door",
        opened_at: "2024-01-01T00:00:00Z",
        closed_at: "2024-01-01T00:05:00Z",
        duration_ms: 300000,
      },
    ]);
    const { GET } = await import("./door-events");

    const json = (await (await GET(makeContext())).json()) as Record<string, unknown>;

    expect(json.history).toEqual([
      {
        id: "evt-1",
        label: "Garage Door",
        opened_at: "2024-01-01T00:00:00Z",
        closed_at: "2024-01-01T00:05:00Z",
        duration_ms: 300000,
      },
    ]);
  });

  it("sets a no-store cache control header", async () => {
    const { GET } = await import("./door-events");

    const response = await GET(makeContext());

    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});
