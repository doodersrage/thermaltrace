import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
const mockSetAuthCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
  setAuthCookies: (...a: unknown[]) => mockSetAuthCookies(...a),
}));

const mockRefreshSession = vi.fn();
const mockCreateAuthClient = vi.fn();
vi.mock("../../../lib/supabase", () => ({
  createAuthClient: (...a: unknown[]) => mockCreateAuthClient(...a),
}));

const mockUpdateUserDisplayPreferences = vi.fn();
const mockParseDisplayPreferencesInput = vi.fn();
vi.mock("../../../lib/userPreferences", () => ({
  updateUserDisplayPreferences: (...a: unknown[]) => mockUpdateUserDisplayPreferences(...a),
  parseDisplayPreferencesInput: (...a: unknown[]) => mockParseDisplayPreferencesInput(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeCookies() {
  return {
    get: vi.fn((name: string) => {
      if (name === "sb-access-token") return { value: "access-tok" };
      if (name === "sb-refresh-token") return { value: "refresh-tok" };
      return undefined;
    }),
    set: vi.fn(),
  };
}

function makeContext(fields: string[] = []): APIContext {
  const formData = new FormData();
  for (const field of fields) formData.set(field, "on");
  formData.set("theme", "dark");
  const request = { formData: async () => formData } as unknown as Request;
  const redirect = vi.fn(fakeRedirect);
  return { request, cookies: makeCookies(), redirect } as unknown as APIContext;
}

const samplePrefs = {
  showGarageTemps: true,
  showWeather: false,
  useCelsius: false,
  weatherCityId: null,
  weatherSource: "none",
  ambientWeatherMac: null,
  ambientWeatherApiKey: null,
  weatherflowStationId: null,
  weatherflowToken: null,
  theme: "dark" as const,
};

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1" },
  });
  mockSetAuthCookies.mockReset();
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard");
  mockParseDisplayPreferencesInput.mockReset().mockReturnValue(samplePrefs);
  mockUpdateUserDisplayPreferences.mockReset().mockResolvedValue({ error: null });
  mockRefreshSession.mockReset().mockResolvedValue({
    data: {
      session: { access_token: "new-access", refresh_token: "new-refresh" },
    },
  });
  mockCreateAuthClient.mockReset().mockReturnValue({
    auth: {
      refreshSession: (...a: unknown[]) => mockRefreshSession(...a),
    },
  });
});

describe("POST /api/user/preferences", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./preferences");
    const context = makeContext();

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
    expect(response.status).toBe(302);
  });

  it("saves preferences, sets theme cookie, and redirects with prefs_saved", async () => {
    const { POST } = await import("./preferences");
    const context = makeContext(["show_garage_temps"]);

    const response = await POST(context);

    expect(mockUpdateUserDisplayPreferences).toHaveBeenCalledWith(
      "access-tok",
      "refresh-tok",
      samplePrefs,
    );
    expect(context.cookies.set).toHaveBeenCalledWith(
      "theme",
      "dark",
      expect.objectContaining({ path: "/", httpOnly: false }),
    );
    expect(mockSetAuthCookies).toHaveBeenCalledWith(
      context.cookies,
      "new-access",
      "new-refresh",
    );
    expect(context.redirect).toHaveBeenCalledWith("/dashboard?prefs_saved=1");
    expect(response.status).toBe(302);
  });

  it("redirects with prefs_error when update fails", async () => {
    mockUpdateUserDisplayPreferences.mockResolvedValue({ error: { message: "fail" } });
    const { POST } = await import("./preferences");
    const context = makeContext();

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard?prefs_error=1");
    expect(context.cookies.set).not.toHaveBeenCalled();
  });
});
