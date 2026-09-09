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

const mockStartPuckClaim = vi.fn();
vi.mock("../../../../lib/pucks", () => ({
  startPuckClaim: (...a: unknown[]) => mockStartPuckClaim(...a),
}));

function makeContext(body: unknown | string = {
  device_id: "puck-1",
  bay_id: "bay-a",
}): APIContext {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return {
    request: new Request("https://example.com/api/pucks/claim/start", {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json" },
    }),
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
  mockStartPuckClaim.mockReset().mockResolvedValue({
    ok: true,
    nonceHex: "deadbeef",
    expiresIn: 120,
  });
});

describe("POST /api/pucks/claim/start", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./start");

    const response = await POST(makeContext());

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("./start");

    const response = await POST(makeContext("not json"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON" });
  });

  it("returns the claim error when start fails", async () => {
    mockStartPuckClaim.mockResolvedValue({
      ok: false,
      status: 404,
      error: "unknown_device",
    });
    const { POST } = await import("./start");

    const response = await POST(makeContext());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "unknown_device" });
  });

  it("starts a claim and returns the nonce", async () => {
    const { POST } = await import("./start");

    const response = await POST(makeContext());

    expect(mockStartPuckClaim).toHaveBeenCalledWith({
      deviceId: "puck-1",
      bayId: "bay-a",
      householdId: "house-1",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      nonce_hex: "deadbeef",
      expires_in: 120,
    });
  });
});
