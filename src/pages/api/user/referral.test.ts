import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockCountReferralSignups = vi.fn();
const mockGetOrCreateReferralCode = vi.fn();
vi.mock("../../../lib/referrals", () => ({
  countReferralSignups: (...a: unknown[]) => mockCountReferralSignups(...a),
  getOrCreateReferralCode: (...a: unknown[]) => mockGetOrCreateReferralCode(...a),
}));

const mockGetSiteUrl = vi.fn();
vi.mock("../../../lib/stripe", () => ({
  getSiteUrl: (...a: unknown[]) => mockGetSiteUrl(...a),
}));

function makeContext(): APIContext {
  return {
    cookies: {},
    request: new Request("https://example.com/api/user/referral"),
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1" },
  });
  mockGetOrCreateReferralCode.mockReset().mockResolvedValue("REFCODE1");
  mockCountReferralSignups.mockReset().mockResolvedValue(3);
  mockGetSiteUrl.mockReset().mockReturnValue("https://thermaltrace.example");
});

describe("GET /api/user/referral", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./referral");

    const response = await GET(makeContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns referral code, register URL, and signup count", async () => {
    const { GET } = await import("./referral");
    const context = makeContext();

    const response = await GET(context);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetOrCreateReferralCode).toHaveBeenCalledWith("user-1");
    expect(mockCountReferralSignups).toHaveBeenCalledWith("user-1");
    expect(mockGetSiteUrl).toHaveBeenCalledWith(context.request);
    expect(json).toEqual({
      code: "REFCODE1",
      registerUrl: "https://thermaltrace.example/register?ref=REFCODE1",
      signupCount: 3,
      bonusTrialDays: 7,
    });
  });
});
