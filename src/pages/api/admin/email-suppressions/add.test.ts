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

const mockAddEmailSuppression = vi.fn();
vi.mock("../../../../lib/emailSuppressions", () => ({
  addEmailSuppression: (...a: unknown[]) => mockAddEmailSuppression(...a),
}));

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeContext(fields: Record<string, string>): APIContext {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
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
  mockAddEmailSuppression.mockReset().mockResolvedValue({ ok: true, error: null });
});

describe("POST /api/admin/email-suppressions/add", () => {
  it("redirects non-admins to signin", async () => {
    mockIsUserAdmin.mockResolvedValue(false);
    const { POST } = await import("./add");
    const response = await POST(makeContext({ email: "a@example.com" }));
    expect(response.headers.get("Location")).toBe("/signin");
  });

  it("adds a suppression and redirects", async () => {
    const { POST } = await import("./add");
    const response = await POST(
      makeContext({
        email: "Bad@Example.com",
        reason: "manual",
        note: "known bounce",
      }),
    );
    expect(mockAddEmailSuppression).toHaveBeenCalledWith(
      "Bad@Example.com",
      "manual",
      "known bounce",
    );
    expect(response.headers.get("Location")).toBe(
      "/dashboard/email-suppressions?added=1",
    );
  });

  it("defaults reason to manual when blank", async () => {
    const { POST } = await import("./add");
    await POST(makeContext({ email: "a@example.com", reason: "  " }));
    expect(mockAddEmailSuppression).toHaveBeenCalledWith(
      "a@example.com",
      "manual",
      null,
    );
  });

  it("redirects with an error when add fails", async () => {
    mockAddEmailSuppression.mockResolvedValue({ ok: false, error: "db down" });
    const { POST } = await import("./add");
    const response = await POST(makeContext({ email: "a@example.com" }));
    expect(response.headers.get("Location")).toContain("error=db+down");
  });
});
