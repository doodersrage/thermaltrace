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

export function shouldSendMonthlyReport(now = new Date()): boolean {
  return now.getUTCDate() === 1 && now.getUTCHours() === 8;
}

async function sendMonthlyReportEmail(
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
    filename: "thermaltrace-monthly-report.html",
    contentType: "text/html; charset=UTF-8",
    data: encodeBase64Utf8(attachmentHtml),
  });

  await sendMailerRaw(new EmailMessage(from, to, msg.asRaw()));
}

export async function sendMonthlyReportsForAllUsers(): Promise<{
  sent: number;
  skipped: number;
  errors: string[];
}> {
  const supabase = createAdminClient();
  const { data: rows } = await supabase
    .from("alert_settings")
    .select("user_id")
    .eq("monthly_report_enabled", true);

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows ?? []) {
    try {
      const ok = await sendMonthlyReportForUser(row.user_id);
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

async function sendMonthlyReportForUser(userId: string): Promise<boolean> {
  const settings = await getAlertSettingsForUser(userId);
  if (!settings.monthlyReportEnabled) return false;

  const admin = createAdminClient();
  const { data: authData } = await admin.auth.admin.getUserById(userId);
  const authUser = authData.user;
  const email = settings.email ?? authUser?.email ?? null;
  if (!email || !authUser) return false;

  const preferences = await getUserPreferences(authUser);
  const { points } = await fetchGarageTempChartData(userId, 30);
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

  const monthLabel = new Date().toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const siteUrl = resolveSiteUrl(null);
  const reportData: MonthlyReportData = {
    monthLabel,
    periodDays: 30,
    reportKind: "monthly",
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
    historyUrl: buildHistoryChartUrl(siteUrl, trailingHistoryWindowDays(30)),
  };

  const subject = formatPeriodReportSubject(reportData);
  const plainBody = buildMonthlyReportPlainText(reportData);
  const htmlBody = buildMonthlyReportHtmlEmail(reportData);
  const attachmentHtml = buildMonthlyReportHtmlDocument(reportData);

  await sendMonthlyReportEmail(
    email,
    subject,
    plainBody,
    htmlBody,
    attachmentHtml,
  );

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
    .update({ last_monthly_report_at: new Date().toISOString() })
    .eq("user_id", userId);

  return true;
}
