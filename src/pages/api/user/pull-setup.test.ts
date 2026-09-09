import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockSanitizeTempFeeds = vi.fn();
const mockSanitizeTempProbes = vi.fn();
const mockParseTempFeedsFromFormData = vi.fn();
vi.mock("../../../lib/tempFeedConfig", () => ({
  sanitizeTempFeeds: (...a: unknown[]) => mockSanitizeTempFeeds(...a),
  sanitizeTempProbes: (...a: unknown[]) => mockSanitizeTempProbes(...a),
  parseTempFeedsFromFormData: (...a: unknown[]) => mockParseTempFeedsFromFormData(...a),
}));

const mockSaveUserPullSetup = vi.fn();
vi.mock("../../../lib/userTempConfig", () => ({
  saveUserPullSetup: (...a: unknown[]) => mockSaveUserPullSetup(...a),
}));

const mockRequireHouseholdEditor = vi.fn();
const mockRedirectUnlessEditor = vi.fn();
vi.mock("../../../lib/householdAuth", () => ({
  requireHouseholdEditor: (...a: unknown[]) => mockRequireHouseholdEditor(...a),
  redirectUnlessEditor: (...a: unknown[]) => mockRedirectUnlessEditor(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeContext(options: {
  body?: Record<string, unknown> | string;
  json?: boolean;
  form?: Record<string, string>;
} = {}): APIContext {
  const { body, json = false, form } = options;
  const headers: Record<string, string> = {};
  if (json) headers["content-type"] = "application/json";

  let request: Request;
  if (json) {
    const payload = typeof body === "string" ? body : JSON.stringify(body ?? {});
    request = new Request("https://example.com/api/user/pull-setup", {
      method: "POST",
      headers,
      body: payload,
    });
  } else {
    const formData = new FormData();
    if (form) {
      for (const [key, value] of Object.entries(form)) formData.set(key, value);
    }
    request = {
      formData: async () => formData,
      headers: new Headers(headers),
    } as unknown as Request;
  }

  const redirect = vi.fn(fakeRedirect);
  return { request, cookies: {}, redirect } as unknown as APIContext;
}

const sampleFeed = {
  id: "feed-1",
  name: "Garage",
  url: "https://example.com/temps",
  enabled: true,
  jsonRoot: "temp",
};

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1" },
  });
  mockRequireHouseholdEditor.mockReset().mockResolvedValue({ ok: true, ctx: {} });
  mockRedirectUnlessEditor.mockReset().mockReturnValue(null);
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/temperature?tab=pull");
  mockSanitizeTempFeeds.mockReset().mockImplementation((feeds: unknown) => feeds);
  mockSanitizeTempProbes.mockReset().mockImplementation((probes: unknown) => probes);
  mockParseTempFeedsFromFormData.mockReset().mockReturnValue([sampleFeed]);
  mockSaveUserPullSetup.mockReset().mockResolvedValue({
    error: null,
    discoveredProbes: 2,
  });
});

describe("POST /api/user/pull-setup (JSON)", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./pull-setup");
    const context = makeContext({
      json: true,
      body: { feeds: [sampleFeed] },
    });

    const response = await POST(context);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, error: "Sign in required." });
  });

  it("returns 403 for a view-only user", async () => {
    mockRequireHouseholdEditor.mockResolvedValue({ ok: false });
    const { POST } = await import("./pull-setup");
    const context = makeContext({
      json: true,
      body: { feeds: [sampleFeed] },
    });

    const response = await POST(context);

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ ok: false, error: "View-only access." });
  });

  it("returns 400 when no valid feeds are provided", async () => {
    const { POST } = await import("./pull-setup");
    const context = makeContext({ json: true, body: { feeds: [] } });

    const response = await POST(context);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "No valid feeds provided." });
  });

  it("saves pull setup and returns ok JSON", async () => {
    const { POST } = await import("./pull-setup");
    const context = makeContext({
      json: true,
      body: {
        feeds: [sampleFeed],
        probes: [{ id: "p1", feedId: "feed-1", key: "a", label: "Probe A" }],
      },
    });

    const response = await POST(context);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockSaveUserPullSetup).toHaveBeenCalledWith(
      "user-1",
      [sampleFeed],
      [
        {
          id: "p1",
          feedId: "feed-1",
          key: "a",
          label: "Probe A",
          visible: true,
        },
      ],
    );
    expect(json).toEqual({
      ok: true,
      redirect: "/dashboard/temperature?pull_saved=1&tab=pull&probes_discovered=2",
      discoveredProbes: 2,
    });
  });

  it("returns 500 when save fails", async () => {
    mockSaveUserPullSetup.mockResolvedValue({
      error: { message: "write failed" },
      discoveredProbes: 0,
    });
    const { POST } = await import("./pull-setup");
    const context = makeContext({
      json: true,
      body: { feeds: [sampleFeed] },
    });

    const response = await POST(context);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "write failed" });
  });
});

describe("POST /api/user/pull-setup (form)", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./pull-setup");
    const context = makeContext({ form: {} });

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
    expect(response.status).toBe(302);
  });

  it("returns the editor-guard redirect when blocked", async () => {
    const blocked = fakeRedirect("/dashboard/temperature?error=viewer");
    mockRequireHouseholdEditor.mockResolvedValue({ ok: false, error: "viewer" });
    mockRedirectUnlessEditor.mockReturnValue(blocked);
    const { POST } = await import("./pull-setup");
    const context = makeContext({ form: { probes_json: "[]" } });

    const response = await POST(context);

    expect(response).toBe(blocked);
    expect(mockSaveUserPullSetup).not.toHaveBeenCalled();
  });

  it("saves form feeds and redirects with pull_saved", async () => {
    const { POST } = await import("./pull-setup");
    const context = makeContext({ form: { probes_json: "[]" } });

    const response = await POST(context);

    expect(mockParseTempFeedsFromFormData).toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/temperature?pull_saved=1&tab=pull&probes_discovered=2",
    );
    expect(response.status).toBe(302);
  });
});
