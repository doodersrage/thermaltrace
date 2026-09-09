import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockFetchTemps = vi.fn();
vi.mock("../../../lib/FetchTemps", () => ({
  fetchTemps: (...a: unknown[]) => mockFetchTemps(...a),
}));

const mockRequireHouseholdEditor = vi.fn();
vi.mock("../../../lib/householdAuth", () => ({
  requireHouseholdEditor: (...a: unknown[]) => mockRequireHouseholdEditor(...a),
}));

function makeContext(): APIContext {
  return { cookies: {} } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "at" },
    user: { id: "user-1", email: "user@example.com", user_metadata: {} },
  });
  mockRequireHouseholdEditor.mockReset().mockResolvedValue({ ok: true, householdId: "house-1" });
  mockFetchTemps.mockReset().mockResolvedValue([
    { id: "feed-1", name: "Garage feed", probes: { a: 1, b: 2 }, error: null },
  ]);
});

describe("POST /api/devices/pull-fetch", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./pull-fetch");

    const response = await POST(makeContext());

    expect(response.status).toBe(401);
  });

  it("returns 403 for a view-only user", async () => {
    mockRequireHouseholdEditor.mockResolvedValue({ ok: false });
    const { POST } = await import("./pull-fetch");

    const response = await POST(makeContext());

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: "View-only access." });
  });

  it("fetches temps and returns a per-feed summary", async () => {
    const { POST } = await import("./pull-fetch");

    const response = await POST(makeContext());
    const json = (await response.json()) as Record<string, unknown>;

    expect(mockFetchTemps).toHaveBeenCalledWith({
      userId: "user-1",
      userEmail: "user@example.com",
      userMetadata: {},
      saveToDatabase: true,
      sendAlerts: true,
    });
    expect(json.ok).toBe(true);
    expect(json.feeds).toEqual([
      { feedId: "feed-1", name: "Garage feed", ok: true, message: "2 probe(s)", probeCount: 2 },
    ]);
  });

  it("marks a feed as failed when it reports an error", async () => {
    mockFetchTemps.mockResolvedValue([
      { id: "feed-2", name: "Attic feed", probes: {}, error: "timeout" },
    ]);
    const { POST } = await import("./pull-fetch");

    const response = await POST(makeContext());
    const json = (await response.json()) as Record<string, unknown>;

    expect(json.feeds).toEqual([
      { feedId: "feed-2", name: "Attic feed", ok: false, message: "timeout", probeCount: 0 },
    ]);
  });
});
