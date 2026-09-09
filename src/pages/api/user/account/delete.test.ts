import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
const mockClearAuthCookies = vi.fn();
vi.mock("../../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
  clearAuthCookies: (...a: unknown[]) => mockClearAuthCookies(...a),
}));

const mockDeleteUserAccount = vi.fn();
vi.mock("../../../../lib/accountLifecycle", () => ({
  deleteUserAccount: (...a: unknown[]) => mockDeleteUserAccount(...a),
}));

const mockSignInWithPassword = vi.fn();
const mockCreateAuthClient = vi.fn();
const mockCreateAuthClientFromSession = vi.fn();
const mockUserHasAnyMfaEnrolled = vi.fn();
vi.mock("../../../../lib/mfa", () => ({
  createAuthClient: () => mockCreateAuthClient(),
  createAuthClientFromSession: (...a: unknown[]) =>
    mockCreateAuthClientFromSession(...a),
  userHasAnyMfaEnrolled: (...a: unknown[]) => mockUserHasAnyMfaEnrolled(...a),
}));

const mockClearMfaStepUpCookie = vi.fn();
const mockHasElevatedAuth = vi.fn();
vi.mock("../../../../lib/mfaStepUpProof", () => ({
  clearMfaStepUpCookie: (...a: unknown[]) => mockClearMfaStepUpCookie(...a),
  hasElevatedAuth: (...a: unknown[]) => mockHasElevatedAuth(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeContext(fields: Record<string, string>): APIContext {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const request = { formData: () => Promise.resolve(form) } as unknown as Request;
  return {
    request,
    cookies: {},
    redirect: fakeRedirect,
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "at", refresh_token: "rt" },
    user: {
      id: "user-1",
      email: "user@example.com",
      identities: [{ provider: "email" }],
    },
  });
  mockFormRedirectPath.mockReset().mockReturnValue("/");
  mockSignInWithPassword.mockReset().mockResolvedValue({ error: null });
  mockCreateAuthClient.mockReset().mockReturnValue({
    auth: { signInWithPassword: mockSignInWithPassword },
  });
  mockCreateAuthClientFromSession.mockReset().mockResolvedValue({
    client: { id: "auth-client" },
    error: null,
  });
  mockUserHasAnyMfaEnrolled.mockReset().mockResolvedValue(false);
  mockHasElevatedAuth.mockReset().mockResolvedValue(true);
  mockDeleteUserAccount.mockReset().mockResolvedValue({ error: null });
  mockClearAuthCookies.mockReset();
  mockClearMfaStepUpCookie.mockReset();
});

describe("POST /api/user/account/delete", () => {
  it("redirects to signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./delete");

    const response = await POST(makeContext({ confirm: "DELETE" }));

    expect(response.headers.get("Location")).toBe("/signin");
  });

  it("redirects with confirm error when DELETE is not typed", async () => {
    const { POST } = await import("./delete");

    const response = await POST(makeContext({ confirm: "nope" }));

    expect(response.headers.get("Location")).toBe(
      "/dashboard/settings?delete_error=confirm",
    );
  });

  it("redirects with password error when password verification fails", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login" },
    });
    const { POST } = await import("./delete");

    const response = await POST(
      makeContext({ confirm: "DELETE", password: "wrong" }),
    );

    expect(response.headers.get("Location")).toBe(
      "/dashboard/settings?delete_error=password",
    );
  });

  it("requires email confirmation for OAuth-only accounts", async () => {
    mockGetAuthFromCookies.mockResolvedValue({
      session: { access_token: "at", refresh_token: "rt" },
      user: {
        id: "user-1",
        email: "user@example.com",
        identities: [{ provider: "github" }],
      },
    });
    const { POST } = await import("./delete");

    const response = await POST(
      makeContext({ confirm: "DELETE", confirm_email: "other@example.com" }),
    );

    expect(response.headers.get("Location")).toBe(
      "/dashboard/settings?delete_error=email",
    );
  });

  it("redirects with mfa error when step-up is missing", async () => {
    mockUserHasAnyMfaEnrolled.mockResolvedValue(true);
    mockHasElevatedAuth.mockResolvedValue(false);
    const { POST } = await import("./delete");

    const response = await POST(
      makeContext({ confirm: "DELETE", password: "secret" }),
    );

    expect(response.headers.get("Location")).toBe(
      "/dashboard/settings?delete_error=mfa",
    );
  });

  it("deletes the account, clears cookies, and redirects", async () => {
    const { POST } = await import("./delete");

    const response = await POST(
      makeContext({ confirm: "DELETE", password: "secret" }),
    );

    expect(mockDeleteUserAccount).toHaveBeenCalledWith("user-1");
    expect(mockClearAuthCookies).toHaveBeenCalled();
    expect(mockClearMfaStepUpCookie).toHaveBeenCalled();
    expect(response.headers.get("Location")).toBe("/?account_deleted=1");
  });

  it("redirects with a generic error when deletion fails", async () => {
    mockDeleteUserAccount.mockResolvedValue({ error: { message: "boom" } });
    const { POST } = await import("./delete");

    const response = await POST(
      makeContext({ confirm: "DELETE", password: "secret" }),
    );

    expect(response.headers.get("Location")).toBe(
      "/dashboard/settings?delete_error=1",
    );
  });
});
