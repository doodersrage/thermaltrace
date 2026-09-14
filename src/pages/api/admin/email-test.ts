import type { APIRoute } from "astro";
import { getAuthFromCookies } from "../../../lib/auth";
import { isUserAdmin } from "../../../lib/adminAccess";
import { createAdminClient } from "../../../lib/supabase";
import { resolveSiteUrl } from "../../../lib/schemaMarkup";
import { buildDripEmail } from "../../../lib/dripEmails";
import { buildTrialReminderEmail } from "../../../lib/trialEmails";
import { buildWeeklyDigestParts } from "../../../lib/digestEmails";
import {
  buildMonthlyReportHtmlEmail,
  buildMonthlyReportPlainText,
  formatPeriodReportSubject,
  type MonthlyReportData,
} from "../../../lib/monthlyReportHtml";
import { buildFreezeDrillEmailParts } from "../../../lib/freezeDrillEmails";

function sampleWeeklyDigest(siteUrl: string) {
  const digest = buildWeeklyDigestParts({
    points: [
      {
        timestamp: "2026-01-05T08:00:00Z",
        tempf: 40,
        humidity: 50,
        probeLabel: "Garage",
      },
      {
        timestamp: "2026-01-05T20:00:00Z",
        tempf: 52,
        humidity: 44,
        probeLabel: "Pipe bay",
      },
      {
        timestamp: "2026-01-06T04:00:00Z",
        tempf: 30,
        humidity: 55,
        probeLabel: "Garage",
      },
    ],
    freezeThresholdF: 34,
    siteUrl,
  });
  return {
    subject: `[Test] ${digest.subject}`,
    text: digest.text,
    html: digest.html,
  };
}

function sampleMonthlyReport(siteUrl: string) {
  const data: MonthlyReportData = {
    monthLabel: "January 2026",
    periodDays: 30,
    reportKind: "monthly",
    readingCount: 420,
    minTempF: 28.5,
    maxTempF: 72.1,
    avgTempF: 48.3,
    freezeThresholdF: 34,
    nightsAtRisk: 2,
    nights: [
      { dateLabel: "Mon Jan 5", minTempF: 31, atRisk: true },
      { dateLabel: "Tue Jan 6", minTempF: 40, atRisk: false },
    ],
    freezeHours: {
      hoursBelow34: 12.5,
      degreeHoursBelow: 40,
      readingsBelow34: 8,
      totalReadings: 420,
      coldestF: 28.5,
    },
    probes: [
      {
        label: "Garage",
        minF: 28.5,
        maxF: 55,
        avgHumidity: 62,
        readingCount: 210,
      },
      {
        label: "Pipe bay",
        minF: 30,
        maxF: 72.1,
        avgHumidity: 48,
        readingCount: 210,
      },
    ],
    alertsUrl: `${siteUrl}/dashboard/alerts`,
    historyUrl: `${siteUrl}/dashboard/history`,
  };
  return {
    subject: `[Test] ${formatPeriodReportSubject(data)}`,
    text: buildMonthlyReportPlainText(data),
    html: buildMonthlyReportHtmlEmail(data),
  };
}

function sampleFreezeDrill(siteUrl: string) {
  const parts = buildFreezeDrillEmailParts({
    score: 60,
    siteUrl,
    checks: [
      { ok: true, label: "Alerts enabled (freeze + auto flood)" },
      { ok: false, label: "All probes reporting (not stale)" },
      { ok: true, label: "Test alert sent this season" },
    ],
  });
  return {
    subject: "[Test] Freeze readiness 60%: pre-season drill",
    text: parts.text,
    html: parts.html,
  };
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const { session, user } = await getAuthFromCookies(cookies);
  if (!session || !user || !(await isUserAdmin(user.id))) {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const kind = formData?.get("kind")?.toString() ?? "drip_day1";
  const admin = createAdminClient();
  const { data: authData } = await admin.auth.admin.getUserById(user.id);
  const email = authData.user?.email ?? user.email;
  if (!email) {
    return new Response("No email on account", { status: 400 });
  }

  const siteUrl = resolveSiteUrl(null);
  const templates = {
    drip_day1: () => {
      const mail = buildDripEmail("day1", siteUrl);
      return { subject: `[Test] ${mail.subject}`, text: mail.text, html: mail.html };
    },
    drip_day3: () => {
      const mail = buildDripEmail("day3", siteUrl);
      return { subject: `[Test] ${mail.subject}`, text: mail.text, html: mail.html };
    },
    trial_3d: () => {
      const mail = buildTrialReminderEmail({ plan: "Pro", remaining: 3, siteUrl });
      return { subject: `[Test] ${mail.subject}`, text: mail.text, html: mail.html };
    },
    weekly_digest: () => sampleWeeklyDigest(siteUrl),
    monthly_report: () => sampleMonthlyReport(siteUrl),
    freeze_drill: () => sampleFreezeDrill(siteUrl),
  } as const;

  const build = templates[kind as keyof typeof templates] ?? templates.drip_day1;
  const template = build();

  const from = import.meta.env.SMTP_MAIL_FROM;
  if (!from) {
    return new Response("SMTP_MAIL_FROM not configured", { status: 503 });
  }

  try {
    const { sendEmail } = await import("../../../lib/mailer");
    await sendEmail(email, template.subject, template.text, { html: template.html });

    return new Response(null, {
      status: 302,
      headers: { Location: "/dashboard/ops?email_test=1" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Send failed";
    return new Response(message, { status: 500 });
  }
};
