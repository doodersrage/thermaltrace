import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
}));

const mockGetOrCreateHouseholdForUser = vi.fn();
vi.mock("../../../lib/households", () => ({
  getOrCreateHouseholdForUser: (...a: unknown[]) => mockGetOrCreateHouseholdForUser(...a),
}));

const mockGetPuck = vi.fn();
vi.mock("../../../lib/pucks", () => ({
  getPuck: (...a: unknown[]) => mockGetPuck(...a),
}));

function makeContext(deviceId = "puck-1"): APIContext {
  return {
    params: { device_id: deviceId },
    request: new Request("https://example.com/api/pucks/puck-1"),
    cookies: {},
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1", email: "user@example.com" },
  });
  mockGetOrCreateHouseholdForUser.mockReset().mockResolvedValue({
    householdId: "house-1",
    error: null,
  });
  mockGetPuck.mockReset().mockResolvedValue({
    device_id: "puck-1",
    bay_id: "bay-a",
    space_name: "Garage",
    household_id: "house-1",
  });
});

describe("GET /api/pucks/[device_id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./[device_id]");

    const response = await GET(makeContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 500 when household resolution fails", async () => {
    mockGetOrCreateHouseholdForUser.mockResolvedValue({
      householdId: null,
      error: "db down",
    });
    const { GET } = await import("./[device_id]");

    const response = await GET(makeContext());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "db down" });
  });

  it("returns 404 when the puck belongs to another household", async () => {
    mockGetPuck.mockResolvedValue({
      device_id: "puck-1",
      household_id: "other-house",
    });
    const { GET } = await import("./[device_id]");

    const response = await GET(makeContext());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "unknown_device" });
  });

  it("returns puck details for the caller's household", async () => {
    const { GET } = await import("./[device_id]");

    const response = await GET(makeContext());

    expect(mockGetPuck).toHaveBeenCalledWith("puck-1");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      device_id: "puck-1",
      bay_id: "bay-a",
      space_name: "Garage",
    });
  });
});
