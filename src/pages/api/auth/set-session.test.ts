import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
const mockSetAuthCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
  setAuthCookies: (...a: unknown[]) => mockSetAuthCookies(...a),
}));

const mockSetSession = vi.fn();
const mockCreateAuthClient = vi.fn();
const mockGetAalClaim = vi.fn();
const mockSyncMfaRequiredCookieFromClient = vi.fn();
vi.mock("../../../lib/mfa", () => ({
  createAuthClient: () => mockCreateAuthClient(),
  getAalClaim: (...a: unknown[]) => mockGetAalClaim(...a),
  syncMfaRequiredCookieFromClient: (...a: unknown[]) => mockSyncMfaRequiredCookieFromClient(...a),
}));

function makeContext(body: unknown | string): APIContext {
  const request = {
    json: async () => {
      if (typeof body === "string") throw new Error("invalid");
      return body;
    },
  } as unknown as Request;
  return { request, cookies: {} } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "at", refresh_token: "rt" },
    user: { id: "user-1" },
  });
  mockSetAuthCookies.mockReset();
  mockSetSession.mockReset().mockResolvedValue({
    data: { session: { access_token: "new-at", refresh_token: "new-rt" }, user: { id: "user-1" } },
    error: null,
  });
  mockCreateAuthClient.mockReset().mockReturnValue({ auth: { setSession: (...a: unknown[]) => mockSetSession(...a) } });
  mockGetAalClaim.mockReset().mockReturnValue("aal2");
  mockSyncMfaRequiredCookieFromClient.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/auth/set-session", () => {
  it("returns 401 when there's no existing cookie session", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./set-session");

    const response = await POST(makeContext({ access_token: "a", refresh_token: "b" }));

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("./set-session");

    const response = await POST(makeContext("not json"));

    expect(response.status).toBe(400);
  });

  it("returns 400 when tokens are missing", async () => {
    const { POST } = await import("./set-session");

    const response = await POST(makeContext({ access_token: "a" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing tokens" });
  });

  it("returns 400 when the new session doesn't belong to the same user", async () => {
    mockSetSession.mockResolvedValue({
      data: { session: { access_token: "x", refresh_token: "y" }, user: { id: "different-user" } },
      error: null,
    });
    const { POST } = await import("./set-session");

    const response = await POST(makeContext({ access_token: "a", refresh_token: "b" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid session" });
  });

  it("returns 400 when setSession errors", async () => {
    mockSetSession.mockResolvedValue({ data: { session: null, user: null }, error: { message: "bad" } });
    const { POST } = await import("./set-session");

    const response = await POST(makeContext({ access_token: "a", refresh_token: "b" }));

    expect(response.status).toBe(400);
  });

  it("persists the upgraded session into cookies and reports the aal", async () => {
    const { POST } = await import("./set-session");

    const response = await POST(makeContext({ access_token: " a ", refresh_token: " b " }));

    expect(mockSetSession).toHaveBeenCalledWith({ access_token: "a", refresh_token: "b" });
    expect(mockSetAuthCookies).toHaveBeenCalledWith(expect.anything(), "new-at", "new-rt");
    expect(await response.json()).toEqual({ ok: true, aal: "aal2" });
  });
});
