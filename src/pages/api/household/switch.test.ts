import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockSetActiveHouseholdForUser = vi.fn();
vi.mock("../../../lib/households", () => ({
  setActiveHouseholdForUser: (...a: unknown[]) => mockSetActiveHouseholdForUser(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

function makeContext(fields: Record<string, string> = {}, formDataFails = false): APIContext {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const request = {
    formData: formDataFails
      ? () => Promise.reject(new Error("bad form"))
      : () => Promise.resolve(form),
  } as unknown as Request;
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
  mockSetActiveHouseholdForUser.mockReset().mockResolvedValue({ error: null });
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard");
});

describe("POST /api/household/switch", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./switch");
    const context = makeContext({ household_id: "house-1" });

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
    expect(response.status).toBe(302);
  });

  it("redirects with household_error when household_id is missing", async () => {
    const { POST } = await import("./switch");
    const context = makeContext({});

    await POST(context);

    expect(mockSetActiveHouseholdForUser).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith("/dashboard?household_error=1");
  });

  it("redirects with household_error when formData cannot be parsed", async () => {
    const { POST } = await import("./switch");
    const context = makeContext({}, true);

    await POST(context);

    expect(mockFormRedirectPath).not.toHaveBeenCalled();
    expect(mockSetActiveHouseholdForUser).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith("/dashboard?household_error=1");
  });

  it("switches the active household and redirects with household_switched", async () => {
    mockFormRedirectPath.mockReturnValue("/dashboard/settings");
    const { POST } = await import("./switch");
    const context = makeContext({ household_id: "house-2", redirect: "/dashboard/settings" });

    await POST(context);

    expect(mockFormRedirectPath).toHaveBeenCalled();
    expect(mockSetActiveHouseholdForUser).toHaveBeenCalledWith("user-1", "house-2");
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/settings?household_switched=1");
  });

  it("redirects with household_error when setActiveHouseholdForUser fails", async () => {
    mockSetActiveHouseholdForUser.mockResolvedValue({ error: "not a member" });
    const { POST } = await import("./switch");
    const context = makeContext({ household_id: "house-2" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard?household_error=1");
  });
});
