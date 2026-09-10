import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockSignUp = vi.fn();
const mockCreateAuthClient = vi.fn();
vi.mock("../../../lib/supabase", () => ({
  createAuthClient: () => mockCreateAuthClient(),
}));

const mockGetTurnstileToken = vi.fn();
const mockVerifyTurnstileToken = vi.fn();
vi.mock("../../../lib/turnstile", () => ({
  getTurnstileToken: (...a: unknown[]) => mockGetTurnstileToken(...a),
  verifyTurnstileToken: (...a: unknown[]) => mockVerifyTurnstileToken(...a),
}));

const mockApplyReferralForNewUser = vi.fn();
vi.mock("../../../lib/referrals", () => ({
  applyReferralForNewUser: (...a: unknown[]) => mockApplyReferralForNewUser(...a),
}));

const mockSanitizeRegisterNext = vi.fn();
vi.mock("../../../lib/registerUrl", () => ({
  REGISTER_NEXT_DEVICES: "/dashboard/devices",
  sanitizeRegisterNext: (...a: unknown[]) => mockSanitizeRegisterNext(...a),
}));

function makeContext(form: Record<string, string>): APIContext {
  const formData = new FormData();
  for (const [k, v] of Object.entries(form)) formData.set(k, v);
  const request = { formData: async () => formData } as unknown as Request;
  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));
  return { request, redirect, clientAddress: "127.0.0.1" } as unknown as APIContext;
}

beforeEach(() => {
  mockGetTurnstileToken.mockReset().mockReturnValue("token");
  mockVerifyTurnstileToken.mockReset().mockResolvedValue({ success: true });
  mockSignUp.mockReset().mockResolvedValue({
    data: { user: { id: "user-1", app_metadata: {} } },
    error: null,
  });
  mockCreateAuthClient.mockReset().mockReturnValue({ auth: { signUp: (...a: unknown[]) => mockSignUp(...a) } });
  mockApplyReferralForNewUser.mockReset().mockResolvedValue(undefined);
  mockSanitizeRegisterNext.mockReset().mockReturnValue(null);
});

describe("POST /api/auth/register", () => {
  it("redirects with a verification error when turnstile fails", async () => {
    mockVerifyTurnstileToken.mockResolvedValue({ success: false });
    const { POST } = await import("./register");
    const context = makeContext({ email: "a@example.com", password: "password1" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/register?error=verification");
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("redirects with missing_fields when the password is absent", async () => {
    const { POST } = await import("./register");
    const context = makeContext({ email: "a@example.com" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/register?error=missing_fields");
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it("redirects with missing_fields when the email is absent", async () => {
    const { POST } = await import("./register");
    const context = makeContext({ password: "password1" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/register?error=missing_fields");
  });

  it("redirects with weak_password when the password is under 8 characters", async () => {
    const { POST } = await import("./register");
    const context = makeContext({ email: "a@example.com", password: "short" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/register?error=weak_password");
  });

  it("redirects with signup_failed when signUp errors", async () => {
    mockSignUp.mockResolvedValue({ data: { user: null }, error: { message: "exists" } });
    const { POST } = await import("./register");
    const context = makeContext({ email: "a@example.com", password: "password1" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/register?error=signup_failed");
  });

  it("applies a referral when a ref code is present", async () => {
    const { POST } = await import("./register");
    const context = makeContext({ email: "a@example.com", password: "password1", ref: "REF1" });

    await POST(context);

    expect(mockApplyReferralForNewUser).toHaveBeenCalledWith("user-1", "ref1", {});
  });

  it("does not apply a referral without a ref code", async () => {
    const { POST } = await import("./register");
    const context = makeContext({ email: "a@example.com", password: "password1" });

    await POST(context);

    expect(mockApplyReferralForNewUser).not.toHaveBeenCalled();
  });

  it("redirects to signin with the sanitized next path and registered=1", async () => {
    mockSanitizeRegisterNext.mockReturnValue("/dashboard/devices?intro=1");
    const { POST } = await import("./register");
    const context = makeContext({ email: "a@example.com", password: "password1", next: "/dashboard/devices?intro=1" });

    await POST(context);

    const location = (context.redirect as unknown as { mock: { calls: string[][] } }).mock.calls[0][0];
    const url = new URL(location, "https://example.com");
    expect(url.pathname).toBe("/signin");
    expect(url.searchParams.get("registered")).toBe("1");
    expect(url.searchParams.get("next")).toBe("/dashboard/devices?intro=1");
  });

  it("falls back to the register-devices path when next is unsafe", async () => {
    mockSanitizeRegisterNext.mockReturnValue(null);
    const { POST } = await import("./register");
    const context = makeContext({ email: "a@example.com", password: "password1" });

    await POST(context);

    const location = (context.redirect as unknown as { mock: { calls: string[][] } }).mock.calls[0][0];
    const url = new URL(location, "https://example.com");
    expect(url.searchParams.get("next")).toBe("/dashboard/devices");
  });
});
