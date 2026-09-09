import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockIsUserAdmin = vi.fn();
vi.mock("../../../../lib/adminAccess", () => ({
  isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a),
}));

const mockSetUserAdminMembership = vi.fn();
vi.mock("../../../../lib/userManager", () => ({
  setUserAdminMembership: (...a: unknown[]) => mockSetUserAdminMembership(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

function makeContext(form: Record<string, string>): APIContext {
  const formData = new FormData();
  for (const [k, v] of Object.entries(form)) formData.set(k, v);
  const request = { formData: async () => formData } as unknown as Request;
  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));
  return { request, cookies: {}, redirect } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "admin-1" },
  });
  mockIsUserAdmin.mockReset().mockResolvedValue(true);
  mockSetUserAdminMembership.mockReset().mockResolvedValue({ error: null });
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/users");
});

describe("POST /api/admin/users/toggle-admin", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./toggle-admin");
    const context = makeContext({ user_id: "target-1" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
  });

  it("redirects to /dashboard when the caller isn't an admin", async () => {
    mockIsUserAdmin.mockResolvedValue(false);
    const { POST } = await import("./toggle-admin");
    const context = makeContext({ user_id: "target-1" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard");
    expect(mockSetUserAdminMembership).not.toHaveBeenCalled();
  });

  it("redirects with status=error when user_id is missing", async () => {
    const { POST } = await import("./toggle-admin");
    const context = makeContext({});

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/users?status=error");
    expect(mockSetUserAdminMembership).not.toHaveBeenCalled();
  });

  it("parses make_admin=true and grants admin", async () => {
    const { POST } = await import("./toggle-admin");
    const context = makeContext({ user_id: "target-1", make_admin: "true" });

    await POST(context);

    expect(mockSetUserAdminMembership).toHaveBeenCalledWith("admin-1", "target-1", true);
  });

  it("treats any non-'true' make_admin value as false", async () => {
    const { POST } = await import("./toggle-admin");
    const context = makeContext({ user_id: "target-1", make_admin: "false" });

    await POST(context);

    expect(mockSetUserAdminMembership).toHaveBeenCalledWith("admin-1", "target-1", false);
  });

  it("appends status=error with & when the redirect path already has a query string", async () => {
    mockSetUserAdminMembership.mockResolvedValue({ error: { message: "boom" } });
    mockFormRedirectPath.mockReturnValue("/dashboard/users?tab=admins");
    const { POST } = await import("./toggle-admin");
    const context = makeContext({ user_id: "target-1" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/users?tab=admins&status=error");
  });

  it("redirects with status=updated on success", async () => {
    const { POST } = await import("./toggle-admin");
    const context = makeContext({ user_id: "target-1", make_admin: "true" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/users?status=updated");
  });
});
