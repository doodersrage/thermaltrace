import type { APIRoute } from "astro";
import { getAuthFromCookies } from "../../../lib/auth";
import { createStripeClient, buildSiteUrl } from "../../../lib/stripe";
import { resolveStripePriceId } from "../../../lib/planTier";
import {
  PRO_TRIAL_DAYS,
  referralBonusTrialDays,
  referralRewardTrialDays,
} from "../../../lib/referrals";
import { getUserHouseholdId } from "../../../lib/households";
import { recordHouseholdActivity } from "../../../lib/householdActivity";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromCookies(cookies);

  if (!session || !user) {
    return redirect("/signin");
  }

  const formData = await request.formData().catch(() => null);
  const planRaw = formData?.get("plan")?.toString().trim() ?? "";
  const plan =
    planRaw === "portfolio" || planRaw === "pro" || planRaw === "member"
      ? planRaw
      : null;
  if (!plan) {
    return new Response("Unknown plan", { status: 400 });
  }
  const interval =
    formData?.get("interval")?.toString() === "annual" ? "annual" : "monthly";
  const checkoutSource = formData?.get("source")?.toString().trim() || null;
  const priceId = resolveStripePriceId(plan, interval);

  if (!priceId) {
    return new Response("Stripe price is not configured", { status: 500 });
  }

  if (!priceId.startsWith("price_")) {
    return new Response(
      "Stripe price IDs must start with price_.",
      { status: 500 },
    );
  }

  // referred_by / referral_reward_days live in app_metadata, not
  // user_metadata -- app_metadata can only be written by the service role,
  // so a user can't grant themselves extra trial days by calling
  // Supabase's own auth.updateUser() directly with their own session.
  const appMetadata = user.app_metadata as Record<string, unknown> | undefined;
  const referredBy =
    typeof appMetadata?.referred_by === "string" ? appMetadata.referred_by : null;
  const proTrialDays =
    plan === "pro" || plan === "portfolio"
      ? PRO_TRIAL_DAYS +
        referralBonusTrialDays(referredBy) +
        referralRewardTrialDays(appMetadata)
      : undefined;

  try {
    const stripe = createStripeClient();

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer_email: user.email,
      client_reference_id: user.id,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          supabase_user_id: user.id,
          plan_tier: plan,
          billing_interval: interval,
          checkout_source: checkoutSource ?? "",
        },
        trial_period_days: proTrialDays,
      },
      metadata: {
        supabase_user_id: user.id,
        plan_tier: plan,
        billing_interval: interval,
        checkout_source: checkoutSource ?? "",
      },
      success_url: buildSiteUrl(
        request,
        "/dashboard/history?subscription=success",
      ),
      cancel_url: buildSiteUrl(
        request,
        "/dashboard/history?subscription=cancelled",
      ),
      allow_promotion_codes: true,
    });

    if (!checkoutSession.url) {
      return new Response("Unable to create checkout session", { status: 500 });
    }

    const householdId = await getUserHouseholdId(user.id);
    if (householdId) {
      await recordHouseholdActivity({
        householdId,
        userId: user.id,
        action: "checkout_started",
        detail: `${plan}/${interval}${checkoutSource ? ` via ${checkoutSource}` : ""}`,
      });
    }

    return redirect(checkoutSession.url);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to start checkout";
    return new Response(message, { status: 500 });
  }
};
