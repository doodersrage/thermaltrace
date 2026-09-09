import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

vi.mock("../../../lib/mfa", () => ({
  MFA_REQUIRED_COOKIE: "mfa_required",
}));

const mockClearMfaStepUpCookie = vi.fn();
vi.mock("../../../lib/mfaStepUpProof", () => ({
  clearMfaStepUpCookie: (...a: unknown[]) => mockClearMfaStepUpCookie(...a),
}));

const mockSanitizeNextPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  sanitizeNextPath: (...a: unknown[]) => mockSanitizeNextPath(...a),
}));

function makeCookies() {
  return { delete: vi.fn() };
}

function makeContext(search: Record<string, string> = {}): APIContext {
  const url = new URL("https://example.com/api/auth/signout");
  for (const [k, v] of Object.entries(search)) url.searchParams.set(k, v);
  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));
  return { cookies: makeCookies(), redirect, url } as unknown as APIContext;
}

beforeEach(() => {
  mockClearMfaStepUpCookie.mockReset();
  mockSanitizeNextPath.mockReset().mockImplementation((v: string | null) => v ?? null);
});

describe("signout", () => {
  it("clears session cookies and redirects to /signin by default (POST)", async () => {
    const { POST } = await import("./signout");
    const context = makeContext();

    const response = await POST(context);

    expect(context.cookies.delete).toHaveBeenCalledWith("sb-access-token", { path: "/" });
    expect(context.cookies.delete).toHaveBeenCalledWith("sb-refresh-token", { path: "/" });
    expect(context.cookies.delete).toHaveBeenCalledWith("mfa_required", { path: "/" });
    expect(mockClearMfaStepUpCookie).toHaveBeenCalled();
    expect(response.headers.get("Location")).toBe("/signin");
  });

  it("redirects with next and email query params when present (GET)", async () => {
    mockSanitizeNextPath.mockReturnValue("/dashboard/alerts");
    const { GET } = await import("./signout");
    const context = makeContext({ next: "/dashboard/alerts", email: "user@example.com" });

    const response = await GET(context);

    const url = new URL(response.headers.get("Location")!, "https://example.com");
    expect(url.pathname).toBe("/signin");
    expect(url.searchParams.get("next")).toBe("/dashboard/alerts");
    expect(url.searchParams.get("email")).toBe("user@example.com");
  });

  it("omits query params entirely when next is unsafe", async () => {
    mockSanitizeNextPath.mockReturnValue(null);
    const { GET } = await import("./signout");
    const context = makeContext({ next: "//evil.example.com", email: "user@example.com" });

    const response = await GET(context);

    expect(response.headers.get("Location")).toBe("/signin");
  });
});
