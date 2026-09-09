import { beforeEach, describe, expect, it, vi } from "vitest";

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "upsert"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  (builder as { then: unknown }).then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

const mockFrom = vi.fn();
const mockRpc = vi.fn();
vi.mock("./supabase", () => ({
  createServerClient: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}));

beforeEach(() => {
  mockFrom.mockReset();
  mockRpc.mockReset();
});

describe("getUserSubscription", () => {
  it("returns null when supabase has no row for the user", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null }));
    const { getUserSubscription } = await import("./stripeSubscriptions");

    expect(await getUserSubscription("user-1")).toBeNull();
  });

  it("returns the row as-is when found", async () => {
    const row = {
      user_id: "user-1",
      stripe_customer_id: "cus_1",
      stripe_subscription_id: "sub_1",
      status: "active",
      current_period_end: "2026-01-01T00:00:00.000Z",
    };
    mockFrom.mockReturnValue(mockQuery({ data: row }));
    const { getUserSubscription } = await import("./stripeSubscriptions");

    expect(await getUserSubscription("user-1")).toEqual(row);
  });
});

describe("findUserIdByStripeSubscriptionId", () => {
  it("returns null when no row matches", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null }));
    const { findUserIdByStripeSubscriptionId } = await import("./stripeSubscriptions");

    expect(await findUserIdByStripeSubscriptionId("sub_missing")).toBeNull();
  });

  it("returns the user id when a row matches", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: { user_id: "user-9" } }));
    const { findUserIdByStripeSubscriptionId } = await import("./stripeSubscriptions");

    expect(await findUserIdByStripeSubscriptionId("sub_9")).toBe("user-9");
  });
});

describe("syncPlanGroupForUser", () => {
  it("calls the current sync_plan_group_membership RPC and returns no error on success", async () => {
    mockRpc.mockResolvedValue({ error: null });
    const { syncPlanGroupForUser } = await import("./stripeSubscriptions");

    const result = await syncPlanGroupForUser("user-1", "pro", true);

    expect(result).toEqual({ error: null });
    expect(mockRpc).toHaveBeenCalledWith("sync_plan_group_membership", {
      target_user_id: "user-1",
      plan_tier: "pro",
      is_active: true,
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it("falls back to the legacy sync_member_group_membership RPC when the new one errors", async () => {
    mockRpc
      .mockResolvedValueOnce({ error: { message: "function does not exist" } })
      .mockResolvedValueOnce({ error: null });
    const { syncPlanGroupForUser } = await import("./stripeSubscriptions");

    const result = await syncPlanGroupForUser("user-1", "member", true);

    expect(result).toEqual({ error: null });
    expect(mockRpc).toHaveBeenNthCalledWith(2, "sync_member_group_membership", {
      target_user_id: "user-1",
      is_active: true,
    });
  });

  it("surfaces the original error message when the legacy fallback also fails", async () => {
    mockRpc
      .mockResolvedValueOnce({ error: { message: "primary failed" } })
      .mockResolvedValueOnce({ error: { message: "legacy failed" } });
    const { syncPlanGroupForUser } = await import("./stripeSubscriptions");

    const result = await syncPlanGroupForUser("user-1", "member", false);

    expect(result).toEqual({ error: "legacy failed" });
  });
});

describe("syncMemberGroupForUser", () => {
  it("maps an active-like status to an active member sync", async () => {
    mockRpc.mockResolvedValue({ error: null });
    const { syncMemberGroupForUser } = await import("./stripeSubscriptions");

    await syncMemberGroupForUser("user-1", "trialing");

    expect(mockRpc).toHaveBeenCalledWith("sync_plan_group_membership", {
      target_user_id: "user-1",
      plan_tier: "member",
      is_active: true,
    });
  });

  it("maps a canceled status to an inactive member sync", async () => {
    mockRpc.mockResolvedValue({ error: null });
    const { syncMemberGroupForUser } = await import("./stripeSubscriptions");

    await syncMemberGroupForUser("user-1", "canceled");

    expect(mockRpc).toHaveBeenCalledWith("sync_plan_group_membership", {
      target_user_id: "user-1",
      plan_tier: "member",
      is_active: false,
    });
  });
});

describe("upsertUserSubscription", () => {
  function makeSubscription(overrides: {
    status?: string;
    priceId?: string | null;
    currentPeriodEnd?: number;
  }) {
    const status = overrides.status ?? "active";
    const priceId = "priceId" in overrides ? overrides.priceId : "price_pro_monthly";
    // Use "in" rather than a default value here: omitting current_period_end
    // (as real Stripe payloads sometimes do) must stay omitted, not fall
    // back to a default timestamp.
    const currentPeriodEnd = "currentPeriodEnd" in overrides ? overrides.currentPeriodEnd : 1735689600;
    return {
      id: "sub_123",
      status,
      items: {
        data: [
          {
            current_period_end: currentPeriodEnd,
            price: priceId ? { id: priceId } : null,
          },
        ],
      },
      // biome-ignore lint: minimal fake matching only the fields upsertUserSubscription reads
    } as unknown as import("stripe").default.Subscription;
  }

  it("upserts the subscription row and syncs the plan group on success", async () => {
    const upsertBuilder = mockQuery({ error: null });
    mockFrom.mockReturnValue(upsertBuilder);
    mockRpc.mockResolvedValue({ error: null });
    const { upsertUserSubscription } = await import("./stripeSubscriptions");

    const result = await upsertUserSubscription("user-1", makeSubscription({ status: "active" }), "cus_1");

    expect(result).toEqual({ error: null });
    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        stripe_customer_id: "cus_1",
        stripe_subscription_id: "sub_123",
        status: "active",
        current_period_end: new Date(1735689600 * 1000).toISOString(),
      }),
      { onConflict: "user_id" },
    );
    expect(mockRpc).toHaveBeenCalledWith(
      "sync_plan_group_membership",
      expect.objectContaining({ target_user_id: "user-1", is_active: true }),
    );
  });

  it("short-circuits without syncing the plan group when the upsert itself fails", async () => {
    mockFrom.mockReturnValue(mockQuery({ error: { message: "db down" } }));
    const { upsertUserSubscription } = await import("./stripeSubscriptions");

    const result = await upsertUserSubscription("user-1", makeSubscription({}), "cus_1");

    expect(result).toEqual({ error: "db down" });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("stores a null current_period_end when Stripe omits it", async () => {
    const upsertBuilder = mockQuery({ error: null });
    mockFrom.mockReturnValue(upsertBuilder);
    mockRpc.mockResolvedValue({ error: null });
    const { upsertUserSubscription } = await import("./stripeSubscriptions");

    await upsertUserSubscription("user-1", makeSubscription({ currentPeriodEnd: undefined }), "cus_1");

    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ current_period_end: null }),
      { onConflict: "user_id" },
    );
  });

  it("marks the synced plan as inactive for a canceled subscription", async () => {
    const upsertBuilder = mockQuery({ error: null });
    mockFrom.mockReturnValue(upsertBuilder);
    mockRpc.mockResolvedValue({ error: null });
    const { upsertUserSubscription } = await import("./stripeSubscriptions");

    await upsertUserSubscription("user-1", makeSubscription({ status: "canceled" }), "cus_1");

    expect(mockRpc).toHaveBeenCalledWith(
      "sync_plan_group_membership",
      expect.objectContaining({ is_active: false }),
    );
  });
});
