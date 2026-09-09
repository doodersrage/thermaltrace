import { createAdminClient } from "./supabase";
import { getAlertSettingsForUser } from "./notify";
import { recordAlertEvent } from "./alertEvents";
import { fetchGarageTempChartData } from "./garageTempsHistory";
import { fetchNightsAtRisk } from "./FetchWeather";
import { getUserPreferences } from "./userPreferences";
import { computeFreezeHours } from "./freezeHours";
import { resolveSiteUrl } from "./schemaMarkup";
import { buildHistoryChartUrl, trailingHistoryWindowDays } from "./historyUrls";
import {
  buildMonthlyReportHtmlDocument,
  buildMonthlyReportHtmlEmail,
  buildMonthlyReportPlainText,
  encodeBase64Utf8,
  formatPeriodReportSubject,
  summarizeProbesForReport,
  type MonthlyReportData,
} from "./monthlyReportHtml";

export function shouldSendQuarterlyReport(now = new Date()): boolean {
  const month = now.getUTCMonth();
  const isQuarterStart = month === 0 || month === 3 || month === 6 || month === 9;
  return isQuarterStart && now.getUTCDate() === 1 && now.getUTCHours() === 8;
}

/** Label for the 90-day window ending at a quarter-start send. */
export function formatQuarterlyWindowLabel(now = new Date()): string {
  const month = now.getUTCMonth();
  const year = now.getUTCFullYear();
  // Sent on quarter start looking back ~90 days → previous calendar quarter.
  const completedQuarter = month === 0 ? 4 : month / 3;
  const qYear = month === 0 ? year - 1 : year;
  const ranges: Record<number, string> = {
    1: "Jan–Mar",
    2: "Apr–Jun",
    3: "Jul–Sep",
    4: "Oct–Dec",
  };
  return `Q${completedQuarter} ${qYear} (${ranges[completedQuarter]})`;
}

async function sendQuarterlyReportEmail(
  to: string,
  subject: string,
  plainBody: string,
  htmlBody: string,
  attachmentHtml: string,
): Promise<void> {
  const { EmailMessage } = await import("cloudflare:email");
  const { createMimeMessage } = await import("mimetext");
  const { requireSmtpMailFrom, sendMailerRaw } = await import("./mailer");
  const from = requireSmtpMailFrom();

  const msg = createMimeMessage();
  msg.setSender({
    name: "ThermalTrace",
    addr: from,
  });
  msg.setRecipient(to);
  msg.setSubject(subject);
  msg.addMessage({ contentType: "text/plain", data: plainBody });
  msg.addMessage({ contentType: "text/html", data: htmlBody });
  msg.addAttachment({
    filename: "thermaltrace-quarterly-report.html",
    contentType: "text/html; charset=UTF-8",
    data: encodeBase64Utf8(attachmentHtml),
  });

  await sendMailerRaw(new EmailMessage(from, to, msg.asRaw()));
}

export async function sendQuarterlyReportsForAllUsers(): Promise<{
  sent: number;
  skipped: number;
  errors: string[];
}> {
  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("alert_settings")
    .select("user_id")
    .eq("quarterly_report_enabled", true);

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows ?? []) {
    try {
      const ok = await sendQuarterlyReportForUser(row.user_id);
      if (ok) sent += 1;
      else skipped += 1;
    } catch (error) {
      errors.push(
        `${row.user_id}: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  return { sent, skipped, errors };
}

async function sendQuarterlyReportForUser(userId: string): Promise<boolean> {
  const settings = await getAlertSettingsForUser(userId);
  if (!settings.quarterlyReportEnabled) return false;

  const admin = createAdminClient();
  const { data: authData } = await admin.auth.admin.getUserById(userId);
  const authUser = authData.user;
  const email = settings.email ?? authUser?.email ?? null;
  if (!email || !authUser) return false;

  const preferences = await getUserPreferences(authUser);
  const { points } = await fetchGarageTempChartData(userId, 90);
  const nights = await fetchNightsAtRisk({
    cityId: preferences.weatherCityId,
    freezeThresholdF: settings.freezeThresholdF,
  });
  const nightsAtRisk = nights.filter((n) => n.atRisk).length;

  const temps = points.map((p) => p.tempf);
  const minTemp = temps.length ? Math.min(...temps) : null;
  const maxTemp = temps.length ? Math.max(...temps) : null;
  const avgTemp = temps.length
    ? temps.reduce((a, b) => a + b, 0) / temps.length
    : null;

  const quarterLabel = formatQuarterlyWindowLabel();

  const siteUrl = resolveSiteUrl(null);
  const reportData: MonthlyReportData = {
    monthLabel: quarterLabel,
    periodDays: 90,
    reportKind: "quarterly",
    readingCount: points.length,
    minTempF: minTemp,
    maxTempF: maxTemp,
    avgTempF: avgTemp,
    freezeThresholdF: settings.freezeThresholdF,
    nightsAtRisk,
    nights,
    freezeHours: computeFreezeHours(points, settings.freezeThresholdF),
    probes: summarizeProbesForReport(points),
    alertsUrl: `${siteUrl}/dashboard/alerts`,
    historyUrl: buildHistoryChartUrl(siteUrl, trailingHistoryWindowDays(90)),
  };

  const subject = formatPeriodReportSubject(reportData);
  const plainBody = buildMonthlyReportPlainText(reportData);
  const htmlBody = buildMonthlyReportHtmlEmail(reportData);
  const attachmentHtml = buildMonthlyReportHtmlDocument(reportData);

  await sendQuarterlyReportEmail(email, subject, plainBody, htmlBody, attachmentHtml);

  await recordAlertEvent({
    userId,
    kind: "digest",
    title: subject,
    body: plainBody,
    channelsSent: ["email"],
    channelsSkipped: [],
  });

  await admin
    .from("alert_settings")
    .update({ last_quarterly_report_at: new Date().toISOString() })
    .eq("user_id", userId);

  return true;
}
