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

const mockGetUserSubscription = vi.fn();
vi.mock("../../../lib/stripeSubscriptions", () => ({
  getUserSubscription: (...a: unknown[]) => mockGetUserSubscription(...a),
}));

const mockPortalCreate = vi.fn();

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeContext(): APIContext {
  return {
    request: new Request("https://example.com/api/stripe/portal", { method: "POST" }),
    cookies: {},
    redirect: fakeRedirect,
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1", email: "user@example.com" },
  });
  mockGetUserSubscription.mockReset().mockResolvedValue({
    stripe_customer_id: "cus_123",
  });
  mockBuildSiteUrl.mockReset().mockReturnValue("https://example.com/dashboard/history");
  mockPortalCreate.mockReset().mockResolvedValue({
    url: "https://billing.stripe.com/session/xyz",
  });
  mockCreateStripeClient.mockReset().mockReturnValue({
    billingPortal: { sessions: { create: mockPortalCreate } },
  });
});

describe("POST /api/stripe/portal", () => {
  it("redirects to signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./portal");

    const response = await POST(makeContext());

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/signin");
  });

  it("redirects with missing when there is no Stripe customer", async () => {
    mockGetUserSubscription.mockResolvedValue(null);
    const { POST } = await import("./portal");

    const response = await POST(makeContext());

    expect(response.headers.get("Location")).toBe(
      "/dashboard/history?subscription=missing",
    );
  });

  it("creates a portal session and redirects to it", async () => {
    const { POST } = await import("./portal");

    const response = await POST(makeContext());

    expect(mockPortalCreate).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "https://example.com/dashboard/history",
    });
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "https://billing.stripe.com/session/xyz",
    );
  });

  it("returns 500 when Stripe throws", async () => {
    mockPortalCreate.mockRejectedValue(new Error("portal down"));
    const { POST } = await import("./portal");

    const response = await POST(makeContext());

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("portal down");
  });
});
