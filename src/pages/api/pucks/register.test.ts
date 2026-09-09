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

const mockRegisterPuck = vi.fn();
vi.mock("../../../lib/pucks", () => ({
  registerPuck: (...a: unknown[]) => mockRegisterPuck(...a),
}));

function makeContext(body: unknown | string = {
  device_id: "puck-1",
  secret_hex: "aabbcc",
}): APIContext {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  return {
    request: new Request("https://example.com/api/pucks/register", {
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
  mockRegisterPuck.mockReset().mockResolvedValue({ ok: true });
});

describe("POST /api/pucks/register", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./register");

    const response = await POST(makeContext());

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("./register");

    const response = await POST(makeContext("not json"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON" });
  });

  it("returns the register error when registration fails", async () => {
    mockRegisterPuck.mockResolvedValue({
      ok: false,
      status: 400,
      error: "invalid_secret",
    });
    const { POST } = await import("./register");

    const response = await POST(makeContext());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_secret" });
  });

  it("registers the puck for the caller's household", async () => {
    const { POST } = await import("./register");

    const response = await POST(makeContext());

    expect(mockRegisterPuck).toHaveBeenCalledWith({
      deviceId: "puck-1",
      secretHex: "aabbcc",
      householdId: "house-1",
      createdBy: "user-1",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
