import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
vi.mock("../../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
}));

const mockGetOrCreateHouseholdForUser = vi.fn();
vi.mock("../../../../lib/households", () => ({
  getOrCreateHouseholdForUser: (...a: unknown[]) => mockGetOrCreateHouseholdForUser(...a),
}));

const mockIsBayMood = vi.fn();
vi.mock("../../../../lib/bayMood", () => ({
  isBayMood: (...a: unknown[]) => mockIsBayMood(...a),
}));

const mockResolveBayMoodForHousehold = vi.fn();
const mockSetBayMoodOverride = vi.fn();
vi.mock("../../../../lib/pucks", () => ({
  resolveBayMoodForHousehold: (...a: unknown[]) => mockResolveBayMoodForHousehold(...a),
  setBayMoodOverride: (...a: unknown[]) => mockSetBayMoodOverride(...a),
}));

function makeContext(options: {
  bayId?: string;
  body?: unknown | string;
} = {}): APIContext {
  const { bayId = "bay-1", body } = options;
  const request = {
    json: async () => {
      if (typeof body === "string") throw new Error("invalid");
      return body;
    },
  } as unknown as Request;
  return { params: { bay_id: bayId }, request, cookies: {} } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({
    session: { access_token: "at" },
    user: { id: "user-1", email: "user@example.com" },
  });
  mockGetOrCreateHouseholdForUser.mockReset().mockResolvedValue({ householdId: "house-1", error: null });
  mockIsBayMood.mockReset().mockReturnValue(true);
  mockResolveBayMoodForHousehold.mockReset().mockResolvedValue({
    ok: true,
    bayId: "bay-1",
    mood: "happy",
    updatedAt: "2024-01-01T00:00:00Z",
    spaceName: "Garage",
    source: "sensor",
  });
  mockSetBayMoodOverride.mockReset().mockResolvedValue({ ok: true });
});

describe("GET /api/bays/[bay_id]/mood", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./mood");

    const response = await GET(makeContext());

    expect(response.status).toBe(401);
  });

  it("returns 500 when the household lookup fails", async () => {
    mockGetOrCreateHouseholdForUser.mockResolvedValue({ householdId: null, error: "boom" });
    const { GET } = await import("./mood");

    const response = await GET(makeContext());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "boom" });
  });

  it("returns the mapped error status when resolution fails", async () => {
    mockResolveBayMoodForHousehold.mockResolvedValue({ ok: false, status: 404, error: "not_found" });
    const { GET } = await import("./mood");

    const response = await GET(makeContext());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
  });

  it("returns the resolved bay mood", async () => {
    const { GET } = await import("./mood");

    const response = await GET(makeContext());
    const json = await response.json();

    expect(mockResolveBayMoodForHousehold).toHaveBeenCalledWith({
      bayId: "bay-1",
      householdId: "house-1",
    });
    expect(json).toEqual({
      bay_id: "bay-1",
      mood: "happy",
      updated_at: "2024-01-01T00:00:00Z",
      space_name: "Garage",
      source: "sensor",
    });
  });
});

describe("PUT /api/bays/[bay_id]/mood", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { PUT } = await import("./mood");

    const response = await PUT(makeContext({ body: { mood: "happy" } }));

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const { PUT } = await import("./mood");

    const response = await PUT(makeContext({ body: "not json" }));

    expect(response.status).toBe(400);
  });

  it("returns bad_mood for an unrecognized mood", async () => {
    mockIsBayMood.mockReturnValue(false);
    const { PUT } = await import("./mood");

    const response = await PUT(makeContext({ body: { mood: "furious" } }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "bad_mood" });
  });

  it("lowercases the mood before validating", async () => {
    const { PUT } = await import("./mood");

    await PUT(makeContext({ body: { mood: "HAPPY" } }));

    expect(mockIsBayMood).toHaveBeenCalledWith("happy");
  });

  it("returns 500 when the household lookup fails", async () => {
    mockGetOrCreateHouseholdForUser.mockResolvedValue({ householdId: null, error: "boom" });
    const { PUT } = await import("./mood");

    const response = await PUT(makeContext({ body: { mood: "happy" } }));

    expect(response.status).toBe(500);
  });

  it("returns the mapped error status when setting the override fails", async () => {
    mockSetBayMoodOverride.mockResolvedValue({ ok: false, status: 403, error: "forbidden" });
    const { PUT } = await import("./mood");

    const response = await PUT(makeContext({ body: { mood: "happy" } }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden" });
  });

  it("sets the override and returns the bay id and mood", async () => {
    const { PUT } = await import("./mood");

    const response = await PUT(makeContext({ bayId: "bay-2", body: { mood: "happy" } }));
    const json = await response.json();

    expect(mockSetBayMoodOverride).toHaveBeenCalledWith({
      bayId: "bay-2",
      householdId: "house-1",
      mood: "happy",
    });
    expect(json).toEqual({ bay_id: "bay-2", mood: "happy" });
  });
});
