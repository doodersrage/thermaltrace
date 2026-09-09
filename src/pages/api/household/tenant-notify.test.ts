import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockRequireHouseholdEditor = vi.fn();
const mockRedirectUnlessEditor = vi.fn();
const mockHouseholdEditorCtx = vi.fn();
vi.mock("../../../lib/householdAuth", () => ({
  requireHouseholdEditor: (...a: unknown[]) => mockRequireHouseholdEditor(...a),
  redirectUnlessEditor: (...a: unknown[]) => mockRedirectUnlessEditor(...a),
  householdEditorCtx: (...a: unknown[]) => mockHouseholdEditorCtx(...a),
}));

const mockUpdateTenantNotifySettings = vi.fn();
vi.mock("../../../lib/tenantRelay", () => ({
  updateTenantNotifySettings: (...a: unknown[]) => mockUpdateTenantNotifySettings(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

function makeContext(fields: Record<string, string> = {}): APIContext {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const request = { formData: () => Promise.resolve(form) } as unknown as Request;
  const redirect = vi.fn(
    (path: string) => new Response(null, { status: 302, headers: { Location: path } }),
  );
  return { request, cookies: {}, redirect } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    user: { id: "user-1", email: "user@example.com" },
  });
  mockRequireHouseholdEditor.mockReset().mockResolvedValue({ ok: true });
  mockRedirectUnlessEditor.mockReset().mockReturnValue(null);
  mockHouseholdEditorCtx.mockReset().mockReturnValue({ householdId: "house-1" });
  mockUpdateTenantNotifySettings.mockReset().mockResolvedValue({ error: null });
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/settings");
});

describe("POST /api/household/tenant-notify", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ user: null });
    const { POST } = await import("./tenant-notify");
    const context = makeContext({ household_id: "house-1" });

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
    expect(response.status).toBe(302);
  });

  it("returns the editor block response for a view-only user", async () => {
    const blocked = new Response(null, {
      status: 302,
      headers: { Location: "/dashboard/settings?error=viewer" },
    });
    mockRedirectUnlessEditor.mockReturnValue(blocked);
    const { POST } = await import("./tenant-notify");
    const context = makeContext({ household_id: "house-1" });

    const response = await POST(context);

    expect(response).toBe(blocked);
    expect(mockUpdateTenantNotifySettings).not.toHaveBeenCalled();
  });

  it("redirects with tenant_error when household_id does not match the editor household", async () => {
    const { POST } = await import("./tenant-notify");
    const context = makeContext({ household_id: "other-house" });

    await POST(context);

    expect(mockUpdateTenantNotifySettings).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/settings?tenant_error=1");
  });

  it("redirects with tenant_error when household_id is missing", async () => {
    const { POST } = await import("./tenant-notify");
    const context = makeContext({});

    await POST(context);

    expect(mockUpdateTenantNotifySettings).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/settings?tenant_error=1");
  });

  it("saves tenant notify settings and redirects with tenant_saved", async () => {
    const { POST } = await import("./tenant-notify");
    const context = makeContext({
      household_id: "house-1",
      tenant_email: "tenant@example.com",
      tenant_name: "Alex",
    });

    await POST(context);

    expect(mockUpdateTenantNotifySettings).toHaveBeenCalledWith("house-1", {
      email: "tenant@example.com",
      name: "Alex",
    });
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/settings?tenant_saved=1");
  });

  it("redirects with an encoded tenant_error when the update fails", async () => {
    mockUpdateTenantNotifySettings.mockResolvedValue({ error: "invalid email" });
    const { POST } = await import("./tenant-notify");
    const context = makeContext({ household_id: "house-1" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/settings?tenant_error=invalid%20email",
    );
  });
});
