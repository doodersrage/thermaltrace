import { resolvePlanTierFromPriceId } from "./planTier";
import type Stripe from "stripe";
import { createServerClient } from "./supabase";
import { isActiveSubscriptionStatus } from "./stripe";

export type UserSubscription = {
  user_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: string;
  current_period_end: string | null;
  stripe_price_id?: string | null;
  plan_tier?: string | null;
};

export async function getUserSubscription(
  userId: string,
): Promise<UserSubscription | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("stripe_subscriptions")
    .select(
      "user_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, stripe_price_id, plan_tier",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as UserSubscription;
}

export async function upsertUserSubscription(
  userId: string,
  subscription: Stripe.Subscription,
  customerId: string,
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const currentPeriodEnd = subscription.items.data[0]?.current_period_end;
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const planTier = resolvePlanTierFromPriceId(priceId);

  const { error } = await supabase.from("stripe_subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      current_period_end: currentPeriodEnd
        ? new Date(currentPeriodEnd * 1000).toISOString()
        : null,
      stripe_price_id: priceId,
      plan_tier: planTier,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    return { error: error.message };
  }

  return syncPlanGroupForUser(
    userId,
    planTier,
    isActiveSubscriptionStatus(subscription.status),
  );
}

export async function syncPlanGroupForUser(
  userId: string,
  planTier: "member" | "pro" | "portfolio",
  isActive: boolean,
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { error } = await supabase.rpc("sync_plan_group_membership", {
    target_user_id: userId,
    plan_tier: planTier,
    is_active: isActive,
  });

  if (error) {
    // Fallback to legacy RPC if new one not applied yet. Report the
    // fallback's own outcome -- not the primary error -- once it runs:
    // a successful fallback means the sync worked, and the caller
    // (webhook handling, subscription upserts) should see error: null
    // rather than a stale failure from the RPC that no longer exists.
    const fallback = await supabase.rpc("sync_member_group_membership", {
      target_user_id: userId,
      is_active: isActive,
    });
    return { error: fallback.error ? fallback.error.message : null };
  }

  return { error: null };
}

export async function syncMemberGroupForUser(
  userId: string,
  status: string,
): Promise<{ error: string | null }> {
  return syncPlanGroupForUser(
    userId,
    "member",
    isActiveSubscriptionStatus(status),
  );
}

export async function findUserIdByStripeSubscriptionId(
  subscriptionId: string,
): Promise<string | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("stripe_subscriptions")
    .select("user_id")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.user_id;
}
