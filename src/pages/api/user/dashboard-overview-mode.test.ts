import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
const mockSetAuthCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
  setAuthCookies: (...a: unknown[]) => mockSetAuthCookies(...a),
}));

const mockUpdateDashboardOverviewMode = vi.fn();
vi.mock("../../../lib/dashboardOverviewMode", () => ({
  updateDashboardOverviewMode: (...a: unknown[]) => mockUpdateDashboardOverviewMode(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

const mockRefreshSession = vi.fn();
const mockCreateAuthClient = vi.fn();
vi.mock("../../../lib/supabase", () => ({
  createAuthClient: () => mockCreateAuthClient(),
}));

function makeCookies() {
  const store = new Map<string, { value: string }>([
    ["sb-access-token", { value: "access-tok" }],
    ["sb-refresh-token", { value: "refresh-tok" }],
  ]);
  return {
    get: (name: string) => store.get(name),
  };
}

function makeContext(formEntries: Record<string, string> = {}): APIContext {
  const formData = new FormData();
  for (const [key, value] of Object.entries(formEntries)) {
    formData.set(key, value);
  }
  const request = { formData: async () => formData } as unknown as Request;
  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));
  return { request, cookies: makeCookies(), redirect } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1" },
  });
  mockSetAuthCookies.mockReset();
  mockUpdateDashboardOverviewMode.mockReset().mockResolvedValue({ error: null });
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard");
  mockRefreshSession.mockReset().mockResolvedValue({ data: { session: null } });
  mockCreateAuthClient.mockReset().mockReturnValue({
    auth: { refreshSession: (...a: unknown[]) => mockRefreshSession(...a) },
  });
});

describe("POST /api/user/dashboard-overview-mode", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./dashboard-overview-mode");
    const context = makeContext();

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
    expect(response.status).toBe(302);
  });

  it("defaults an unrecognized mode value to simple", async () => {
    const { POST } = await import("./dashboard-overview-mode");
    const context = makeContext({ mode: "bogus" });

    await POST(context);

    expect(mockUpdateDashboardOverviewMode).toHaveBeenCalledWith(
      "access-tok",
      "refresh-tok",
      "simple",
    );
  });

  it("accepts the insights mode", async () => {
    const { POST } = await import("./dashboard-overview-mode");
    const context = makeContext({ mode: "insights" });

    await POST(context);

    expect(mockUpdateDashboardOverviewMode).toHaveBeenCalledWith(
      "access-tok",
      "refresh-tok",
      "insights",
    );
  });

  it("redirects with an error flag when the update fails", async () => {
    mockUpdateDashboardOverviewMode.mockResolvedValue({ error: "boom" });
    mockFormRedirectPath.mockReturnValue("/dashboard");
    const { POST } = await import("./dashboard-overview-mode");
    const context = makeContext();

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard?overview_mode_error=1");
    expect(response.status).toBe(302);
    expect(mockCreateAuthClient).not.toHaveBeenCalled();
  });

  it("refreshes the session and sets new auth cookies when refresh succeeds", async () => {
    mockRefreshSession.mockResolvedValue({
      data: {
        session: { access_token: "new-access", refresh_token: "new-refresh" },
      },
    });
    const { POST } = await import("./dashboard-overview-mode");
    const context = makeContext();

    await POST(context);

    expect(mockRefreshSession).toHaveBeenCalledWith({ refresh_token: "refresh-tok" });
    expect(mockSetAuthCookies).toHaveBeenCalledWith(
      context.cookies,
      "new-access",
      "new-refresh",
    );
    expect(context.redirect).toHaveBeenCalledWith("/dashboard");
  });

  it("skips setting cookies when the refresh doesn't return a session", async () => {
    mockRefreshSession.mockResolvedValue({ data: { session: null } });
    const { POST } = await import("./dashboard-overview-mode");
    const context = makeContext();

    await POST(context);

    expect(mockSetAuthCookies).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith("/dashboard");
  });
});
