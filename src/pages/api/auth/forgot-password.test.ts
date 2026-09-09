import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockResetPasswordForEmail = vi.fn();
vi.mock("../../../lib/supabase", () => ({
  supabase: { auth: { resetPasswordForEmail: (...a: unknown[]) => mockResetPasswordForEmail(...a) } },
}));

const mockGetTurnstileToken = vi.fn();
const mockVerifyTurnstileToken = vi.fn();
vi.mock("../../../lib/turnstile", () => ({
  getTurnstileToken: (...a: unknown[]) => mockGetTurnstileToken(...a),
  verifyTurnstileToken: (...a: unknown[]) => mockVerifyTurnstileToken(...a),
}));

const mockResolveSiteUrl = vi.fn();
vi.mock("../../../lib/schemaMarkup", () => ({
  resolveSiteUrl: (...a: unknown[]) => mockResolveSiteUrl(...a),
}));

function makeContext(form: Record<string, string>): APIContext {
  const formData = new FormData();
  for (const [k, v] of Object.entries(form)) formData.set(k, v);
  const request = { formData: async () => formData } as unknown as Request;
  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));
  return {
    request,
    redirect,
    clientAddress: "127.0.0.1",
    site: new URL("https://thermaltrace.dev"),
  } as unknown as APIContext;
}

beforeEach(() => {
  mockResetPasswordForEmail.mockReset().mockResolvedValue({ data: {}, error: null });
  mockGetTurnstileToken.mockReset().mockReturnValue("token");
  mockVerifyTurnstileToken.mockReset().mockResolvedValue({ success: true });
  mockResolveSiteUrl.mockReset().mockReturnValue("https://thermaltrace.dev");
});

describe("POST /api/auth/forgot-password", () => {
  it("redirects with a verification error when turnstile fails", async () => {
    mockVerifyTurnstileToken.mockResolvedValue({ success: false });
    const { POST } = await import("./forgot-password");
    const context = makeContext({ email: "user@example.com" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/forgot-password?error=verification");
    expect(mockResetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("redirects with missing_email when the email is absent", async () => {
    const { POST } = await import("./forgot-password");
    const context = makeContext({});

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/forgot-password?error=missing_email");
  });

  it("sends the reset email with a site-scoped redirect and redirects with sent=1", async () => {
    const { POST } = await import("./forgot-password");
    const context = makeContext({ email: " user@example.com " });

    await POST(context);

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith("user@example.com", {
      redirectTo: "https://thermaltrace.dev/reset-password",
    });
    expect(context.redirect).toHaveBeenCalledWith("/forgot-password?sent=1");
  });
});
