import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
vi.mock("../../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
}));

const mockCountUnacknowledgedAlerts = vi.fn();
const mockListRecentAlertEvents = vi.fn();
vi.mock("../../../../lib/alertEvents", () => ({
  countUnacknowledgedAlerts: (...a: unknown[]) => mockCountUnacknowledgedAlerts(...a),
  listRecentAlertEvents: (...a: unknown[]) => mockListRecentAlertEvents(...a),
}));

function makeContext(search = ""): APIContext {
  const url = new URL(`https://example.com/api/user/alert-events${search}`);
  return {
    request: new Request(url),
    cookies: {},
    url,
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1" },
  });
  mockListRecentAlertEvents.mockReset().mockResolvedValue([
    { id: 1, kind: "freeze" },
  ]);
  mockCountUnacknowledgedAlerts.mockReset().mockResolvedValue(3);
});

describe("GET /api/user/alert-events", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./index");

    const response = await GET(makeContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("defaults the limit to 30 and returns events", async () => {
    const { GET } = await import("./index");

    const response = await GET(makeContext());

    expect(mockListRecentAlertEvents).toHaveBeenCalledWith("user-1", 30);
    expect(mockCountUnacknowledgedAlerts).toHaveBeenCalledWith("user-1");
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({
      events: [{ id: 1, kind: "freeze" }],
      unacked_count: 3,
    });
  });

  it("clamps out-of-range limit values", async () => {
    const { GET } = await import("./index");

    await GET(makeContext("?limit=500"));
    expect(mockListRecentAlertEvents).toHaveBeenCalledWith("user-1", 100);

    await GET(makeContext("?limit=0"));
    expect(mockListRecentAlertEvents).toHaveBeenCalledWith("user-1", 1);
  });
});
