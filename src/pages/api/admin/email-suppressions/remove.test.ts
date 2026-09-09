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

const mockUnsuppressEmail = vi.fn();
vi.mock("../../../../lib/emailSuppressions", () => ({
  unsuppressEmail: (...a: unknown[]) => mockUnsuppressEmail(...a),
}));

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeContext(email: string): APIContext {
  const form = new FormData();
  form.set("email", email);
  return {
    request: { formData: () => Promise.resolve(form) } as unknown as Request,
    cookies: {},
    redirect: fakeRedirect,
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "admin-1" },
  });
  mockIsUserAdmin.mockReset().mockResolvedValue(true);
  mockUnsuppressEmail.mockReset().mockResolvedValue({ ok: true, error: null });
});

describe("POST /api/admin/email-suppressions/remove", () => {
  it("redirects non-admins to signin", async () => {
    mockIsUserAdmin.mockResolvedValue(false);
    const { POST } = await import("./remove");
    const response = await POST(makeContext("a@example.com"));
    expect(response.headers.get("Location")).toBe("/signin");
  });

  it("removes a suppression and redirects", async () => {
    const { POST } = await import("./remove");
    const response = await POST(makeContext("Bad@Example.com"));
    expect(mockUnsuppressEmail).toHaveBeenCalledWith("Bad@Example.com");
    expect(response.headers.get("Location")).toBe(
      "/dashboard/email-suppressions?removed=1",
    );
  });

  it("redirects with an error when removal fails", async () => {
    mockUnsuppressEmail.mockResolvedValue({ ok: false, error: "db down" });
    const { POST } = await import("./remove");
    const response = await POST(makeContext("a@example.com"));
    expect(response.headers.get("Location")).toContain("error=db+down");
  });
});
