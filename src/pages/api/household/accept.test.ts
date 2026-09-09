import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockAcceptHouseholdInvite = vi.fn();
vi.mock("../../../lib/householdInvites", () => ({
  acceptHouseholdInvite: (...a: unknown[]) => mockAcceptHouseholdInvite(...a),
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
    session: { access_token: "tok" },
    user: { id: "user-1", email: "user@example.com" },
  });
  mockAcceptHouseholdInvite.mockReset().mockResolvedValue({ error: null });
});

describe("POST /api/household/accept", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./accept");
    const context = makeContext({ token: "invite-tok" });

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
    expect(response.status).toBe(302);
  });

  it("redirects with error when token is missing", async () => {
    const { POST } = await import("./accept");
    const context = makeContext({});

    await POST(context);

    expect(mockAcceptHouseholdInvite).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/household?error=1");
  });

  it("accepts the invite and redirects to household with joined=1", async () => {
    const { POST } = await import("./accept");
    const context = makeContext({ token: "invite-tok" });

    await POST(context);

    expect(mockAcceptHouseholdInvite).toHaveBeenCalledWith(
      "invite-tok",
      "user-1",
      "user@example.com",
    );
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/household?joined=1");
  });

  it("maps invited-email mismatch errors to email_mismatch", async () => {
    mockAcceptHouseholdInvite.mockResolvedValue({
      error: "Invite is for a different invited email",
    });
    const { POST } = await import("./accept");
    const context = makeContext({ token: "invite-tok" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/invite/invite-tok?error=email_mismatch");
  });

  it("redirects to the invite page with the raw error code otherwise", async () => {
    mockAcceptHouseholdInvite.mockResolvedValue({ error: "expired" });
    const { POST } = await import("./accept");
    const context = makeContext({ token: "invite-tok" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/invite/invite-tok?error=expired");
  });
});
