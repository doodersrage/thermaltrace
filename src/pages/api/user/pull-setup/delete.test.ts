import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockDeleteUserTempFeed = vi.fn();
vi.mock("../../../../lib/userTempConfig", () => ({
  deleteUserTempFeed: (...a: unknown[]) => mockDeleteUserTempFeed(...a),
}));

const mockRequireHouseholdEditor = vi.fn();
const mockRedirectUnlessEditor = vi.fn();
vi.mock("../../../../lib/householdAuth", () => ({
  requireHouseholdEditor: (...a: unknown[]) => mockRequireHouseholdEditor(...a),
  redirectUnlessEditor: (...a: unknown[]) => mockRedirectUnlessEditor(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeContext(body: Record<string, string> = {}): APIContext {
  const formData = new FormData();
  for (const [key, value] of Object.entries(body)) formData.set(key, value);
  const request = { formData: async () => formData } as unknown as Request;
  const redirect = vi.fn(fakeRedirect);
  return { request, cookies: {}, redirect } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1" },
  });
  mockRequireHouseholdEditor.mockReset().mockResolvedValue({ ok: true, ctx: {} });
  mockRedirectUnlessEditor.mockReset().mockReturnValue(null);
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/temperature?tab=pull");
  mockDeleteUserTempFeed.mockReset().mockResolvedValue({ error: null });
});

describe("POST /api/user/pull-setup/delete", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./delete");
    const context = makeContext({ feed_id: "feed-1" });

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
    expect(response.status).toBe(302);
  });

  it("returns the editor-guard redirect when blocked", async () => {
    const blocked = fakeRedirect("/dashboard/temperature?error=viewer");
    mockRequireHouseholdEditor.mockResolvedValue({ ok: false, error: "viewer" });
    mockRedirectUnlessEditor.mockReturnValue(blocked);
    const { POST } = await import("./delete");
    const context = makeContext({ feed_id: "feed-1" });

    const response = await POST(context);

    expect(response).toBe(blocked);
    expect(mockDeleteUserTempFeed).not.toHaveBeenCalled();
  });

  it("returns 400 when feed_id is missing", async () => {
    const { POST } = await import("./delete");
    const context = makeContext({});

    const response = await POST(context);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Feed id is required");
  });

  it("deletes the feed and redirects with feed_deleted", async () => {
    const { POST } = await import("./delete");
    const context = makeContext({ feed_id: "feed-1" });

    const response = await POST(context);

    expect(mockDeleteUserTempFeed).toHaveBeenCalledWith("user-1", "feed-1");
    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/temperature?feed_deleted=1&tab=pull",
    );
    expect(response.status).toBe(302);
  });

  it("redirects with feeds_error when delete fails", async () => {
    mockDeleteUserTempFeed.mockResolvedValue({ error: { message: "fail" } });
    const { POST } = await import("./delete");
    const context = makeContext({ feed_id: "feed-1" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/temperature?feeds_error=1&tab=pull",
    );
  });
});
