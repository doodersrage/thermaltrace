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

const mockFinishPuckClaim = vi.fn();
vi.mock("../../../../lib/pucks", () => ({
  finishPuckClaim: (...a: unknown[]) => mockFinishPuckClaim(...a),
}));

function makeContext(body: unknown | string = {
  device_id: "puck-1",
  bay_id: "bay-a",
  nonce_hex: "aa",
  response_hex: "bb",
  space_name: "Garage",
}): APIContext {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return {
    request: new Request("https://example.com/api/pucks/claim/finish", {
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
  mockFinishPuckClaim.mockReset().mockResolvedValue({
    ok: true,
    bayId: "bay-a",
    spaceName: "Garage",
  });
});

describe("POST /api/pucks/claim/finish", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./finish");

    const response = await POST(makeContext());

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("./finish");

    const response = await POST(makeContext("not json"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON" });
  });

  it("returns the claim error status when finish fails", async () => {
    mockFinishPuckClaim.mockResolvedValue({
      ok: false,
      status: 409,
      error: "claim_expired",
    });
    const { POST } = await import("./finish");

    const response = await POST(makeContext());

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "claim_expired" });
  });

  it("finishes the claim for the caller's household", async () => {
    const { POST } = await import("./finish");

    const response = await POST(makeContext());

    expect(mockFinishPuckClaim).toHaveBeenCalledWith({
      deviceId: "puck-1",
      bayId: "bay-a",
      nonceHex: "aa",
      responseHex: "bb",
      spaceName: "Garage",
      householdId: "house-1",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      bay_id: "bay-a",
      space_name: "Garage",
    });
  });
});
