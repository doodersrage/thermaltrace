import { createAdminClient } from "./supabase";
import { PRO_MAX_DEVICES } from "./entitlements";
import { resolveSiteUrl } from "./schemaMarkup";
import {
  brandedEmailParts,
  type BrandedEmailContent,
} from "./emailLayout";
import {
  isMailerRecipientNotAllowed,
  partitionMailErrors,
  sendEmail,
} from "./mailer";
import { buildUnsubscribeUrl, unsubscribeHeaders } from "./emailUnsubscribe";

export type DripStageId = "day1" | "day3" | "day7";
/** Stage ids plus the variants sent to people who have no reading yet. */
export type DripEmailId = DripStageId | "day3_setup" | "day7_setup";

type DripStage = {
  id: DripStageId;
  day: number;
  subject: string;
  content: (siteUrl: string) => BrandedEmailContent;
};

type DripEmail = Omit<DripStage, "id" | "day">;

export const DRIP_STAGES: DripStage[] = [
  {
    id: "day1",
    day: 1,
    subject: "Add your first probe to ThermalTrace",
    content: (site) => ({
      eyebrow: "Getting started",
      preheader: "Create a device key, POST JSON, sensors auto-import — about 10 minutes.",
      title: "Connect your first probe",
      intro:
        "Welcome to ThermalTrace. Your free account is ready — next step is a live reading on Home.",
      paragraphs: [
        "Open Devices and pick what you have. Each path creates a device and hands you a snippet with its key; sensors auto-import on the first reading.",
      ],
      bullets: [
        "Sensors in Home Assistant, ESPHome, or MQTT: copy-paste YAML or a relay, about 5 minutes",
        "An ESP32, Pico W, or Arduino: download a sketch pre-filled with your ingest URL",
        "No hardware yet: one click adds a live demo feed so you can see the dashboard work",
      ],
      cta: { label: "Open Devices", url: `${site}/dashboard/devices?view=setup` },
      secondaryCta: { label: "Adding devices guide", url: `${site}/about/adding-devices` },
      tone: "brand",
    }),
  },
  {
    id: "day3",
    day: 3,
    subject: "Turn on freeze and leak alerts before the next surprise",
    content: (site) => ({
      eyebrow: "Freeze and flood protection",
      preheader:
        "Most unconditioned spaces start freeze alerts around 34°F — and wet flood contacts notify automatically once alerts are on.",
      title: "Don’t wait for the cold snap or a wet pad",
      intro:
        "ThermalTrace can reach you when temperatures drop toward freezing or a leak contact goes wet — email and push now, plus SMS on Pro.",
      paragraphs: [
        "Set a freeze threshold on your coldest zone, enable the channels you actually check, and send a test while you’re awake. Add a wet/dry flood contact on a heater pan, laundry, or sump when you have one.",
      ],
      bullets: [
        "Start freeze near 34–38°F, then tune after you see overnight lows",
        "Enable quiet-hour bypass for freeze and flood alerts",
        "Optional: invite household members so someone else sees the ping",
      ],
      cta: { label: "Configure alerts", url: `${site}/dashboard/alerts` },
      secondaryCta: { label: "Cold-snap playbook", url: `${site}/about/cold-snap-playbook` },
      tone: "alert",
    }),
  },
  {
    id: "day7",
    day: 7,
    subject: "Try Pro free — SMS, webhooks, and more share scopes",
    content: (site) => ({
      eyebrow: "Pro trial",
      preheader:
        "SMS, WhatsApp, Pro share scopes, and webhooks — 14-day free trial.",
      title: "Level up with a free Pro trial",
      intro:
        "You’ve had a week to explore ThermalTrace. Pro adds the channels and sharing tools that matter at 2 a.m. (Free already includes one family live link.)",
      paragraphs: [
        "Start a 14-day trial from Pricing — cancel anytime from the dashboard billing portal.",
      ],
      bullets: [
        "SMS and browser push freeze and leak alerts",
        "History, metrics, and never-expire share links plus embeds",
        `Outbound webhooks plus up to ${PRO_MAX_DEVICES} devices per property`,
      ],
      cta: { label: "Compare plans & start trial", url: `${site}/pricing` },
      secondaryCta: { label: "Open dashboard", url: `${site}/dashboard` },
      tone: "brand",
    }),
  },
];

/**
 * Day 3 and day 7 assume a working sensor (alerts, then Pro). Most people who
 * stall never got a first reading, so they get setup help instead.
 */
export const DRIP_SETUP_EMAILS: Record<"day3_setup" | "day7_setup", DripEmail> = {
  day3_setup: {
    subject: "Still setting up? Three quick ways to a first reading",
    content: (site) => ({
      eyebrow: "Getting started",
      preheader: "Home Assistant, a flashed ESP32, or a one-click demo feed.",
      title: "Your dashboard is waiting for a first reading",
      intro:
        "Nothing has reported in yet. Pick whichever you have today; each takes a few minutes from Devices → Setup.",
      bullets: [
        "Home Assistant, ESPHome, or MQTT: we generate the YAML or relay command with your key",
        "ESP32 + DS18B20 (about $25): download a sketch with your ingest URL already filled in",
        "Nothing yet: add the demo feed to see charts and alerts work before buying parts",
      ],
      cta: { label: "Open Devices setup", url: `${site}/dashboard/devices?view=setup` },
      secondaryCta: { label: "ESP32 freeze kit parts", url: `${site}/about/esp32-freeze-kit` },
      tone: "brand",
    }),
  },
  day7_setup: {
    subject: "What are you trying to connect?",
    content: (site) => ({
      eyebrow: "Setup help",
      preheader: "Tell us your sensor or hub and we'll point you at the shortest path.",
      title: "Stuck on setup? Tell us what you have",
      intro:
        "Your account still has no readings. If a sensor, hub, or board didn't fit one of the setup paths, send a note with what you're using and we'll help you get it reporting.",
      paragraphs: [
        "Freeze season is close. A single probe near the coldest pipe is enough to get an alert before it matters.",
      ],
      cta: { label: "Ask for setup help", url: `${site}/contact` },
      secondaryCta: { label: "Open Devices setup", url: `${site}/dashboard/devices?view=setup` },
      tone: "brand",
    }),
  },
};

export function buildDripEmail(
  emailId: DripEmailId,
  siteUrl = resolveSiteUrl(null),
  unsubscribeUrl: string | null = null,
): { subject: string; text: string; html: string } {
  const email: DripEmail =
    emailId === "day3_setup" || emailId === "day7_setup"
      ? DRIP_SETUP_EMAILS[emailId]
      : (DRIP_STAGES.find((item) => item.id === emailId) ?? DRIP_STAGES[0]);
  const parts = brandedEmailParts({ ...email.content(siteUrl), unsubscribeUrl });
  return { subject: email.subject, ...parts };
}

/** Pick the email for a stage: setup help instead of alerts/Pro when nothing has reported. */
export function dripEmailIdForStage(stageId: DripStageId, hasReading: boolean): DripEmailId {
  if (hasReading || stageId === "day1") return stageId;
  return stageId === "day3" ? "day3_setup" : "day7_setup";
}

type AdminClient = ReturnType<typeof createAdminClient>;

/** Any push device that has posted, or any pull-feed reading. Errors count as "yes" so the usual email goes out. */
async function userHasFirstReading(admin: AdminClient, userId: string): Promise<boolean> {
  try {
    const { data: memberships, error: memberError } = await admin
      .from("household_members")
      .select("household_id")
      .eq("user_id", userId);
    if (memberError) return true;
    const householdIds = (memberships ?? []).map((m) => m.household_id);
    if (householdIds.length > 0) {
      const { data: seen, error } = await admin
        .from("devices")
        .select("id")
        .in("household_id", householdIds)
        .not("last_seen_at", "is", null)
        .limit(1);
      if (error) return true;
      if ((seen ?? []).length > 0) return true;
    }
    const { data: pulled, error: pullError } = await admin
      .from("garage_temps")
      .select("id")
      .eq("user_id", userId)
      .limit(1);
    if (pullError) return true;
    return (pulled ?? []).length > 0;
  } catch {
    return true;
  }
}

export async function sendDripEmailsForAllUsers(
  deps: { hasFirstReading?: (userId: string) => Promise<boolean> } = {},
): Promise<{
  sent: number;
  skipped: number;
  errors: string[];
  restricted: number;
}> {
  const admin = createAdminClient();
  const hasFirstReading = deps.hasFirstReading ?? ((userId: string) => userHasFirstReading(admin, userId));
  const siteUrl = resolveSiteUrl(null);
  let sent = 0;
  let skipped = 0;
  let restricted = 0;
  const errors: string[] = [];

  const { data: settingsRows } = await admin
    .from("alert_settings")
    .select("user_id, drip_emails_enabled, drip_email_stage, last_drip_email_at")
    .eq("drip_emails_enabled", true);

  for (const row of settingsRows ?? []) {
    try {
      const { data: userData } = await admin.auth.admin.getUserById(row.user_id);
      const user = userData.user;
      if (!user?.email || !user.created_at) {
        skipped += 1;
        continue;
      }

      const ageMs = Date.now() - Date.parse(user.created_at);
      const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
      const ageHours = ageMs / (60 * 60 * 1000);
      const nextStage = DRIP_STAGES.find((stage) => {
        if (stage.day <= (row.drip_email_stage ?? 0)) return false;
        // First “day1” tip can go out about an hour after signup; later stages stay day-based.
        if (stage.id === "day1") return ageHours >= 1;
        return ageDays >= stage.day;
      });
      if (!nextStage) {
        skipped += 1;
        continue;
      }

      if (row.last_drip_email_at) {
        const hoursSince = (Date.now() - Date.parse(row.last_drip_email_at)) / (60 * 60 * 1000);
        if (hoursSince < 20) {
          skipped += 1;
          continue;
        }
      }

      const unsubscribeUrl = await buildUnsubscribeUrl(siteUrl, row.user_id, "drip");
      const emailId =
        nextStage.id === "day1"
          ? nextStage.id
          : dripEmailIdForStage(nextStage.id, await hasFirstReading(row.user_id));
      const mail = buildDripEmail(emailId, siteUrl, unsubscribeUrl);
      await sendEmail(user.email, mail.subject, mail.text, {
        html: mail.html,
        headers: unsubscribeHeaders(unsubscribeUrl),
      });
      await admin
        .from("alert_settings")
        .update({
          drip_email_stage: nextStage.day,
          last_drip_email_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", row.user_id);
      sent += 1;
    } catch (error) {
      if (isMailerRecipientNotAllowed(error)) {
        // Cloudflare Email binding is destination-restricted; do not fail the cron.
        restricted += 1;
        errors.push(
          `${row.user_id}: ${error instanceof Error ? error.message : "recipient not allowed"}`,
        );
        continue;
      }
      errors.push(
        `${row.user_id}: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  return { sent, skipped, errors, restricted };
}

export function dripJobShouldFail(errors: string[]): boolean {
  return partitionMailErrors(errors).hardErrors.length > 0;
}
