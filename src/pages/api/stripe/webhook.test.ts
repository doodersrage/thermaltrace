import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockConstructEvent = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockCreateStripeClient = vi.fn();
vi.mock("../../../lib/stripe", () => ({
  createStripeClient: () => mockCreateStripeClient(),
}));

const mockFindUserIdByStripeSubscriptionId = vi.fn();
const mockUpsertUserSubscription = vi.fn();
vi.mock("../../../lib/stripeSubscriptions", () => ({
  findUserIdByStripeSubscriptionId: (...a: unknown[]) =>
    mockFindUserIdByStripeSubscriptionId(...a),
  upsertUserSubscription: (...a: unknown[]) => mockUpsertUserSubscription(...a),
}));

const mockGrantReferrerRewardOnSubscription = vi.fn();
vi.mock("../../../lib/referrals", () => ({
  grantReferrerRewardOnSubscription: (...a: unknown[]) =>
    mockGrantReferrerRewardOnSubscription(...a),
}));

const mockClaimStripeWebhookEvent = vi.fn();
const mockReleaseStripeWebhookEvent = vi.fn();
vi.mock("../../../lib/stripeWebhookEvents", () => ({
  claimStripeWebhookEvent: (...a: unknown[]) => mockClaimStripeWebhookEvent(...a),
  releaseStripeWebhookEvent: (...a: unknown[]) => mockReleaseStripeWebhookEvent(...a),
}));

type EnvRecord = Record<string, string | undefined>;
const env = import.meta.env as unknown as EnvRecord;
const savedEnv: EnvRecord = {};
function stubEnv(key: string, value: string | undefined) {
  if (!(key in savedEnv)) savedEnv[key] = env[key];
  if (value === undefined) {
    delete env[key];
  } else {
    env[key] = value;
  }
}

function makePostContext(
  body: string,
  headers: Record<string, string> = {},
): APIContext {
  const request = new Request("https://example.com/api/stripe/webhook", {
    method: "POST",
    body,
    headers,
  });
  return { request } as unknown as APIContext;
}

beforeEach(() => {
  stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test");
  mockConstructEvent.mockReset();
  mockSubscriptionsRetrieve.mockReset();
  mockCreateStripeClient.mockReset().mockReturnValue({
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
  });
  mockFindUserIdByStripeSubscriptionId.mockReset().mockResolvedValue(null);
  mockUpsertUserSubscription.mockReset().mockResolvedValue(undefined);
  mockGrantReferrerRewardOnSubscription.mockReset().mockResolvedValue(undefined);
  mockClaimStripeWebhookEvent.mockReset().mockResolvedValue({ alreadyProcessed: false });
  mockReleaseStripeWebhookEvent.mockReset().mockResolvedValue(undefined);
});

afterEach(() => {
  for (const key of Object.keys(savedEnv)) {
    const original = savedEnv[key];
    if (original === undefined) {
      delete env[key];
    } else {
      env[key] = original;
    }
    delete savedEnv[key];
  }
});

describe("GET /api/stripe/webhook", () => {
  it("returns a health payload", async () => {
    const { GET } = await import("./webhook");

    const response = await GET({} as APIContext);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      message:
        "Stripe webhook endpoint is active. Stripe delivers events here via POST.",
    });
  });
});

describe("POST /api/stripe/webhook", () => {
  it("returns 400 when signature or webhook secret is missing", async () => {
    stubEnv("STRIPE_WEBHOOK_SECRET", undefined);
    const { POST } = await import("./webhook");

    const response = await POST(makePostContext("{}"));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Missing Stripe webhook configuration");
  });

  it("returns 400 when signature verification fails", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("Invalid signature");
    });
    const { POST } = await import("./webhook");

    const response = await POST(
      makePostContext("{}", { "stripe-signature": "bad-sig" }),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid signature");
    expect(mockClaimStripeWebhookEvent).not.toHaveBeenCalled();
  });

  it("returns duplicate=true when the event was already processed", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_1",
      type: "customer.subscription.updated",
      data: { object: { id: "sub_1", metadata: {}, customer: "cus_1" } },
    });
    mockClaimStripeWebhookEvent.mockResolvedValue({ alreadyProcessed: true });
    const { POST } = await import("./webhook");

    const response = await POST(
      makePostContext("{}", { "stripe-signature": "sig" }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, duplicate: true });
    expect(mockUpsertUserSubscription).not.toHaveBeenCalled();
  });

  it("handles a subscription.updated event and acknowledges receipt", async () => {
    const subscription = {
      id: "sub_1",
      metadata: { supabase_user_id: "user-1" },
      customer: "cus_1",
    };
    mockConstructEvent.mockReturnValue({
      id: "evt_2",
      type: "customer.subscription.updated",
      data: { object: subscription },
    });
    const { POST } = await import("./webhook");

    const response = await POST(
      makePostContext("payload", { "stripe-signature": "sig" }),
    );

    expect(mockConstructEvent).toHaveBeenCalledWith("payload", "sig", "whsec_test");
    expect(mockUpsertUserSubscription).toHaveBeenCalledWith(
      "user-1",
      subscription,
      "cus_1",
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  });

  it("releases the claim and returns 500 when the handler throws", async () => {
    mockConstructEvent.mockReturnValue({
      id: "evt_3",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          metadata: { supabase_user_id: "user-1" },
          customer: "cus_1",
        },
      },
    });
    mockUpsertUserSubscription.mockRejectedValue(new Error("db down"));
    const { POST } = await import("./webhook");

    const response = await POST(
      makePostContext("{}", { "stripe-signature": "sig" }),
    );

    expect(mockReleaseStripeWebhookEvent).toHaveBeenCalledWith("evt_3");
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("db down");
  });
});
