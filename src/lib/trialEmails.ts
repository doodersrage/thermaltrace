import { createAdminClient } from "./supabase";
import { resolveSiteUrl } from "./schemaMarkup";
import { brandedEmailParts } from "./emailLayout";
import {
  isMailerRecipientNotAllowed,
  partitionMailErrors,
  sendEmail,
} from "./mailer";

const REMINDER_DAYS = [3, 1] as const;

export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const end = Date.parse(iso);
  if (Number.isNaN(end)) return null;
  return Math.ceil((end - Date.now()) / (24 * 60 * 60 * 1000));
}

export function trialJobShouldFail(errors: string[]): boolean {
  return partitionMailErrors(errors).hardErrors.length > 0;
}

export function buildTrialReminderEmail(options: {
  plan: string;
  remaining: number;
  siteUrl?: string;
}): { subject: string; text: string; html: string } {
  const siteUrl = options.siteUrl ?? resolveSiteUrl(null);
  const { plan, remaining } = options;
  const subject =
    remaining === 1
      ? `Your ThermalTrace ${plan} trial ends tomorrow`
      : `Your ThermalTrace ${plan} trial ends in ${remaining} days`;
  const when = remaining === 1 ? "tomorrow" : `in ${remaining} days`;
  const parts = brandedEmailParts({
    eyebrow: "Trial reminder",
    preheader: `Your ${plan} trial ends ${when}. Keep SMS, webhooks, and share links without interruption.`,
    title: remaining === 1 ? "Trial ends tomorrow" : `Trial ends in ${remaining} days`,
    intro: `Your ${plan} trial wraps up ${when}. Stay on Pro to keep SMS, share links, and webhooks active.`,
    paragraphs: [
      "Billing is managed in the Stripe customer portal from your dashboard — no surprise lockout if you renew before the trial ends.",
    ],
    bullets: [
      "SMS freeze and leak alerts",
      "Public share links and embeds",
      "Outbound webhooks and higher device limits",
    ],
    cta: { label: "Review plans & billing", url: `${siteUrl}/dashboard/plans` },
    secondaryCta: { label: "Compare features", url: `${siteUrl}/pricing` },
    tone: "brand",
  });
  return { subject, ...parts };
}

export async function sendTrialRemindersForAllUsers(): Promise<{
  sent: number;
  skipped: number;
  errors: string[];
  restricted: number;
}> {
  const supabase = createAdminClient();
  const { data: subs } = await supabase
    .from("stripe_subscriptions")
    .select("user_id, status, current_period_end, plan_tier")
    .eq("status", "trialing");

  let sent = 0;
  let skipped = 0;
  let restricted = 0;
  const errors: string[] = [];
  const siteUrl = resolveSiteUrl(null);

  for (const sub of subs ?? []) {
    try {
      const remaining = daysUntil(sub.current_period_end);
      if (remaining == null || !REMINDER_DAYS.includes(remaining as 3 | 1)) {
        skipped += 1;
        continue;
      }

      const { data: settings } = await supabase
        .from("alert_settings")
        .select("last_trial_reminder_at")
        .eq("user_id", sub.user_id)
        .maybeSingle();

      const last = settings?.last_trial_reminder_at
        ? Date.parse(settings.last_trial_reminder_at)
        : 0;
      if (Date.now() - last < 20 * 60 * 60 * 1000) {
        skipped += 1;
        continue;
      }

      const { data: userData } = await supabase.auth.admin.getUserById(sub.user_id);
      const email = userData.user?.email;
      if (!email) {
        skipped += 1;
        continue;
      }

      const plan =
        sub.plan_tier === "portfolio"
          ? "Portfolio"
          : sub.plan_tier === "pro"
            ? "Pro"
            : "Member";
      const mail = buildTrialReminderEmail({ plan, remaining, siteUrl });
      await sendEmail(email, mail.subject, mail.text, { html: mail.html });
      await supabase
        .from("alert_settings")
        .update({
          last_trial_reminder_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", sub.user_id);
      sent += 1;
    } catch (error) {
      if (isMailerRecipientNotAllowed(error)) {
        restricted += 1;
        errors.push(
          `${sub.user_id}: ${error instanceof Error ? error.message : "recipient not allowed"}`,
        );
        continue;
      }
      errors.push(
        `${sub.user_id}: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  return { sent, skipped, errors, restricted };
}
