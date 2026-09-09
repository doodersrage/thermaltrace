import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockCreateStripeClient = vi.fn();
const mockBuildSiteUrl = vi.fn();
vi.mock("../../../lib/stripe", () => ({
  createStripeClient: () => mockCreateStripeClient(),
  buildSiteUrl: (...a: unknown[]) => mockBuildSiteUrl(...a),
}));

const mockResolveStripePriceId = vi.fn();
vi.mock("../../../lib/planTier", () => ({
  resolveStripePriceId: (...a: unknown[]) => mockResolveStripePriceId(...a),
}));

vi.mock("../../../lib/referrals", () => ({
  PRO_TRIAL_DAYS: 14,
  referralBonusTrialDays: () => 0,
  referralRewardTrialDays: () => 0,
}));

const mockGetUserHouseholdId = vi.fn();
vi.mock("../../../lib/households", () => ({
  getUserHouseholdId: (...a: unknown[]) => mockGetUserHouseholdId(...a),
}));

const mockRecordHouseholdActivity = vi.fn();
vi.mock("../../../lib/householdActivity", () => ({
  recordHouseholdActivity: (...a: unknown[]) => mockRecordHouseholdActivity(...a),
}));

const mockSessionsCreate = vi.fn();

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeContext(fields: Record<string, string> = {}): APIContext {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const request = {
    formData: () => Promise.resolve(form),
  } as unknown as Request;
  return {
    request,
    cookies: {},
    redirect: fakeRedirect,
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1", email: "user@example.com", app_metadata: {} },
  });
  mockResolveStripePriceId.mockReset().mockReturnValue("price_pro_monthly");
  mockBuildSiteUrl.mockReset().mockImplementation((_req: unknown, path: string) => {
    return `https://example.com${path}`;
  });
  mockSessionsCreate.mockReset().mockResolvedValue({
    url: "https://checkout.stripe.com/session/abc",
  });
  mockCreateStripeClient.mockReset().mockReturnValue({
    checkout: { sessions: { create: mockSessionsCreate } },
  });
  mockGetUserHouseholdId.mockReset().mockResolvedValue("house-1");
  mockRecordHouseholdActivity.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/stripe/checkout", () => {
  it("redirects to signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./checkout");

    const response = await POST(makeContext({ plan: "pro" }));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/signin");
  });

  it("returns 500 when the Stripe price is not configured", async () => {
    mockResolveStripePriceId.mockReturnValue(undefined);
    const { POST } = await import("./checkout");

    const response = await POST(makeContext({ plan: "pro" }));

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Stripe price is not configured");
  });

  it("returns 500 when the price id does not start with price_", async () => {
    mockResolveStripePriceId.mockReturnValue("prod_wrong");
    const { POST } = await import("./checkout");

    const response = await POST(makeContext({ plan: "pro" }));

    expect(response.status).toBe(500);
    expect(await response.text()).toContain("must start with price_");
  });

  it("creates a checkout session, records activity, and redirects", async () => {
    const { POST } = await import("./checkout");

    const response = await POST(
      makeContext({ plan: "pro", interval: "monthly", source: "pricing" }),
    );

    expect(mockSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer_email: "user@example.com",
        client_reference_id: "user-1",
        line_items: [{ price: "price_pro_monthly", quantity: 1 }],
        allow_promotion_codes: true,
      }),
    );
    expect(mockRecordHouseholdActivity).toHaveBeenCalledWith({
      householdId: "house-1",
      userId: "user-1",
      action: "checkout_started",
      detail: "pro/monthly via pricing",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "https://checkout.stripe.com/session/abc",
    );
  });

  it("returns 500 when Stripe does not return a checkout URL", async () => {
    mockSessionsCreate.mockResolvedValue({ url: null });
    const { POST } = await import("./checkout");

    const response = await POST(makeContext({ plan: "pro" }));

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Unable to create checkout session");
  });

  it("returns 500 when Stripe throws", async () => {
    mockSessionsCreate.mockRejectedValue(new Error("stripe down"));
    const { POST } = await import("./checkout");

    const response = await POST(makeContext({ plan: "pro" }));

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("stripe down");
  });
});
