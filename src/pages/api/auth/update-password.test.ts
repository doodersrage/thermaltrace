import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockSetSession = vi.fn();
const mockUpdateUser = vi.fn();
const mockCreateAuthClient = vi.fn();
vi.mock("../../../lib/supabase", () => ({
  createAuthClient: () => mockCreateAuthClient(),
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
    session: { access_token: "at", refresh_token: "rt" },
    user: { id: "user-1" },
  });
  mockSetSession.mockReset().mockResolvedValue({ error: null });
  mockUpdateUser.mockReset().mockResolvedValue({ error: null });
  mockCreateAuthClient.mockReset().mockReturnValue({
    auth: {
      setSession: (...a: unknown[]) => mockSetSession(...a),
      updateUser: (...a: unknown[]) => mockUpdateUser(...a),
    },
  });
});

describe("POST /api/auth/update-password", () => {
  it("redirects to signin when there's no session", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./update-password");
    const context = makeContext({ password: "password1", confirm: "password1" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin?error=generic");
  });

  it("redirects with a weak error when the password is missing", async () => {
    const { POST } = await import("./update-password");
    const context = makeContext({ confirm: "password1" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/reset-password?error=weak");
  });

  it("redirects with a weak error for a short password", async () => {
    const { POST } = await import("./update-password");
    const context = makeContext({ password: "short", confirm: "short" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/reset-password?error=weak");
  });

  it("redirects with a mismatch error when the passwords differ", async () => {
    const { POST } = await import("./update-password");
    const context = makeContext({ password: "password1", confirm: "password2" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/reset-password?error=mismatch");
  });

  it("redirects with a session error when setSession fails", async () => {
    mockSetSession.mockResolvedValue({ error: { message: "expired" } });
    const { POST } = await import("./update-password");
    const context = makeContext({ password: "password1", confirm: "password1" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/reset-password?error=session");
  });

  it("redirects with an update error when updateUser fails", async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: "boom" } });
    const { POST } = await import("./update-password");
    const context = makeContext({ password: "password1", confirm: "password1" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/reset-password?error=update");
  });

  it("updates the password and redirects to the dashboard on success", async () => {
    const { POST } = await import("./update-password");
    const context = makeContext({ password: "password1", confirm: "password1" });

    await POST(context);

    expect(mockSetSession).toHaveBeenCalledWith({ access_token: "at", refresh_token: "rt" });
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: "password1" });
    expect(context.redirect).toHaveBeenCalledWith("/dashboard?password=updated");
  });
});
