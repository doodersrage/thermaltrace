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

const mockEq = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ update: mockUpdate }));
vi.mock("../../../../lib/supabase", () => ({
  createServerClient: () => ({ from: mockFrom }),
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
    user: { id: "user-1" },
  });
  mockIsUserAdmin.mockReset().mockResolvedValue(true);
  mockEq.mockReset().mockResolvedValue({ error: null });
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/contacts");
});

describe("POST /api/admin/contacts/status", () => {
  it("returns 403 when not an admin", async () => {
    mockIsUserAdmin.mockResolvedValue(false);
    const { POST } = await import("./status");

    const response = await POST(makeContext({ id: "1", status: "read" }));

    expect(response.status).toBe(403);
  });

  it("redirects with contact_error when id isn't a number", async () => {
    const { POST } = await import("./status");
    const context = makeContext({ id: "abc", status: "read" });

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/contacts?contact_error=1");
    expect(response.status).toBe(302);
  });

  it("redirects with contact_error when there is nothing valid to update", async () => {
    const { POST } = await import("./status");
    const context = makeContext({ id: "1", status: "bogus" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/contacts?contact_error=1");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("updates the status when it's an allowed value", async () => {
    const { POST } = await import("./status");
    const context = makeContext({ id: "1", status: "spam" });

    await POST(context);

    expect(mockFrom).toHaveBeenCalledWith("contacts");
    expect(mockUpdate).toHaveBeenCalledWith({ status: "spam" });
    expect(mockEq).toHaveBeenCalledWith("id", 1);
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/contacts");
  });

  it("updates admin_notes even when it's an empty string", async () => {
    const { POST } = await import("./status");
    const context = makeContext({ id: "1", admin_notes: "" });

    await POST(context);

    expect(mockUpdate).toHaveBeenCalledWith({ admin_notes: "" });
  });

  it("redirects with contact_error when the update fails", async () => {
    mockEq.mockResolvedValue({ error: { message: "db down" } });
    const { POST } = await import("./status");
    const context = makeContext({ id: "1", status: "read" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/contacts?contact_error=1");
  });
});
