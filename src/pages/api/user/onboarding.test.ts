import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
const mockSetAuthCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
  setAuthCookies: (...a: unknown[]) => mockSetAuthCookies(...a),
}));

const mockSetSession = vi.fn();
const mockUpdateUser = vi.fn();
const mockRefreshSession = vi.fn();
const mockCreateAuthClient = vi.fn();
vi.mock("../../../lib/supabase", () => ({
  createAuthClient: (...a: unknown[]) => mockCreateAuthClient(...a),
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
  };
}

function makeContext(body: Record<string, string> = {}): APIContext {
  const formData = new FormData();
  for (const [key, value] of Object.entries(body)) formData.set(key, value);
  const request = { formData: async () => formData } as unknown as Request;
  const redirect = vi.fn(fakeRedirect);
  return { request, cookies: makeCookies(), redirect } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1", user_metadata: { existing: true } },
  });
  mockSetAuthCookies.mockReset();
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard");
  mockSetSession.mockReset().mockResolvedValue({ error: null });
  mockUpdateUser.mockReset().mockResolvedValue({ error: null });
  mockRefreshSession.mockReset().mockResolvedValue({
    data: {
      session: { access_token: "new-access", refresh_token: "new-refresh" },
    },
  });
  mockCreateAuthClient.mockReset().mockReturnValue({
    auth: {
      setSession: (...a: unknown[]) => mockSetSession(...a),
      updateUser: (...a: unknown[]) => mockUpdateUser(...a),
      refreshSession: (...a: unknown[]) => mockRefreshSession(...a),
    },
  });
});

describe("POST /api/user/onboarding", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./onboarding");
    const context = makeContext();

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
    expect(response.status).toBe(302);
  });

  it("dismisses onboarding and refreshes auth cookies", async () => {
    const { POST } = await import("./onboarding");
    const context = makeContext({ action: "dismiss" });

    const response = await POST(context);

    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: "access-tok",
      refresh_token: "refresh-tok",
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { existing: true, onboarding_dismissed: true },
    });
    expect(mockSetAuthCookies).toHaveBeenCalledWith(
      context.cookies,
      "new-access",
      "new-refresh",
    );
    expect(context.redirect).toHaveBeenCalledWith("/dashboard?onboarding_dismissed=1");
    expect(response.status).toBe(302);
  });

  it("resets onboarding when action is reset", async () => {
    const { POST } = await import("./onboarding");
    const context = makeContext({ action: "reset" });

    await POST(context);

    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { existing: true, onboarding_dismissed: false },
    });
    expect(context.redirect).toHaveBeenCalledWith("/dashboard?onboarding_reset=1");
  });

  it("redirects with onboarding_error when setSession fails", async () => {
    mockSetSession.mockResolvedValue({ error: { message: "bad session" } });
    const { POST } = await import("./onboarding");
    const context = makeContext();

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard?onboarding_error=1");
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("redirects with onboarding_error when updateUser fails", async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: "update failed" } });
    const { POST } = await import("./onboarding");
    const context = makeContext();

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard?onboarding_error=1");
    expect(mockSetAuthCookies).not.toHaveBeenCalled();
  });
});
