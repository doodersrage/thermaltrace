import { createAdminClient } from "./supabase";
import type { ChartPoint } from "./garageTempsHistory";
import { getAlertSettingsForUser, notifyUser } from "./notify";
import { listAllHouseholdOwnerUserIds } from "./households";
import { summarizeSeasonal } from "./seasonalInsights";
import { brandedEmailParts } from "./emailLayout";
import { resolveSiteUrl } from "./schemaMarkup";
import { sendEmail } from "./mailer";
import { computeFreezeHours } from "./freezeHours";
import { buildHistoryChartUrl, trailingHistoryWindowDays } from "./historyUrls";

async function sendDigestEmail(
  to: string,
  subject: string,
  text: string,
  html: string,
): Promise<void> {
  try {
    await sendEmail(to, subject, text, { html });
  } catch (error) {
    console.error("Failed to send digest email:", error);
  }
}

function summarizePoints(points: ChartPoint[]): string[] {
  const byProbe = new Map<string, ChartPoint[]>();

  for (const point of points) {
    const group = byProbe.get(point.probeLabel) ?? [];
    group.push(point);
    byProbe.set(point.probeLabel, group);
  }

  const lines: string[] = [];

  for (const [label, probePoints] of byProbe) {
    const temps = probePoints.map((point) => point.tempf);
    const humidities = probePoints.map((point) => point.humidity);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const avgHumidity =
      humidities.reduce((sum, value) => sum + value, 0) / humidities.length;

    lines.push(
      `${label}: ${min.toFixed(1)}–${max.toFixed(1)} °F, avg humidity ${avgHumidity.toFixed(0)}% (${probePoints.length} readings)`,
    );
  }

  return lines;
}

/** One line per calendar day (UTC): min–max, avg, and coldest probe when mixed. */
export function summarizePointsByDay(points: ChartPoint[]): string[] {
  if (points.length === 0) return [];

  const byDay = new Map<string, ChartPoint[]>();
  for (const point of points) {
    const key = new Date(point.timestamp).toISOString().slice(0, 10);
    const group = byDay.get(key) ?? [];
    group.push(point);
    byDay.set(key, group);
  }

  return [...byDay.keys()]
    .sort()
    .map((key) => {
      const dayPoints = byDay.get(key) ?? [];
      const temps = dayPoints.map((point) => point.tempf);
      const min = Math.min(...temps);
      const max = Math.max(...temps);
      const avg = temps.reduce((sum, value) => sum + value, 0) / temps.length;
      const coldest = dayPoints.reduce((a, b) =>
        a.tempf <= b.tempf ? a : b,
      );
      const dayLabel = new Date(`${key}T12:00:00.000Z`).toLocaleDateString(
        "en-US",
        {
          weekday: "short",
          month: "short",
          day: "numeric",
          timeZone: "UTC",
        },
      );
      const mixedProbes = dayPoints.some(
        (point) => point.probeLabel !== coldest.probeLabel,
      );
      const coldestNote = mixedProbes ? ` · coldest ${coldest.probeLabel}` : "";
      return `${dayLabel}: ${min.toFixed(1)}–${max.toFixed(1)} °F (avg ${avg.toFixed(1)}°${coldestNote})`;
    });
}

/** Coldest reading in the window — used for subject lines and freeze callouts. */
export function coldestPoint(points: ChartPoint[]): ChartPoint | null {
  if (points.length === 0) return null;
  return points.reduce((a, b) => (a.tempf <= b.tempf ? a : b));
}

export function formatDigestFreezeLine(
  points: ChartPoint[],
  freezeThresholdF: number,
): string {
  const freeze = computeFreezeHours(points, freezeThresholdF);
  if (freeze.readingsBelow34 === 0) {
    return `Freeze exposure: none at or below ${freezeThresholdF}°F`;
  }
  return `Freeze exposure: ~${freeze.hoursBelow34.toFixed(1)} h at or below ${freezeThresholdF}°F (${freeze.readingsBelow34} readings · coldest ${freeze.coldestF?.toFixed(1)}°F)`;
}

export function formatWeeklyDigestSubject(points: ChartPoint[]): string {
  const coldest = coldestPoint(points);
  if (!coldest) return "Weekly probe temperature digest";
  const dayLabel = new Date(coldest.timestamp).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `Weekly digest — coldest ${dayLabel} ${coldest.tempf.toFixed(1)}°F`;
}

export async function sendWeeklyDigestsForAllUsers(): Promise<{
  sent: number;
  skipped: number;
  errors: string[];
}> {
  const admin = createAdminClient();
  const errors: string[] = [];
  let sent = 0;
  let skipped = 0;
  const siteUrl = resolveSiteUrl(null);

  const userIds = await listAllHouseholdOwnerUserIds();

  for (const userId of userIds) {
    try {
      const { data: userData } = await admin.auth.admin.getUserById(userId);
      const user = userData.user;
      if (!user?.email) {
        skipped += 1;
        continue;
      }

      const settings = await getAlertSettingsForUser(
        userId,
        user.user_metadata as Record<string, unknown> | undefined,
      );

      if (!settings.digestEnabled) {
        skipped += 1;
        continue;
      }

      const digestEmail = settings.email ?? user.email;
      const { fetchGarageTempChartData } = await import("./garageTempsHistory");
      const chart = await fetchGarageTempChartData(userId, 7);

      if (chart.error) {
        errors.push(`${user.email}: ${chart.error}`);
        continue;
      }

      const points = chart.points;
      if (!points || points.length === 0) {
        skipped += 1;
        continue;
      }

      const summary = summarizePoints(points);
      const byDay = summarizePointsByDay(points);
      const freezeLine = formatDigestFreezeLine(points, settings.freezeThresholdF);
      const seasonal = summarizeSeasonal(points, 7);
      const subject = formatWeeklyDigestSubject(points);
      const parts = brandedEmailParts({
        eyebrow: "Weekly digest",
        preheader: freezeLine,
        title: "This week at your probes",
        intro: "Here’s a quick look at the last 7 days — coldest night, freeze crossings, and anything else to watch.",
        bullets: [
          freezeLine,
          ...summary,
          ...(byDay.length ? ["Day by day:", ...byDay] : []),
          ...seasonal.map((item) => `${item.title}: ${item.detail}`),
          "Tip: outage and leak alerts fire separately when sensors go quiet or wet.",
        ],
        cta: {
          label: "Open this week on History",
          url: buildHistoryChartUrl(siteUrl, trailingHistoryWindowDays(7)),
        },
        secondaryCta: {
          label: "Manage digest settings",
          url: `${siteUrl}/dashboard/alerts?tab=settings#alert-section-essentials`,
        },
        tone: "brand",
        footerNote:
          "Weekly digests can be turned off under Dashboard → Alerts → Essentials.",
      });

      await sendDigestEmail(
        digestEmail,
        subject,
        parts.text,
        parts.html,
      );

      await notifyUser(userId, digestEmail, { ...settings, channelEmail: false }, {
        title: subject,
        body: [freezeLine, ...summary, ...byDay].join("\n"),
        kind: "digest",
      });

      // Fan-out to household members who opted into digests.
      try {
        const { data: ownerMemberships } = await admin
          .from("household_members")
          .select("household_id")
          .eq("user_id", userId);
        const ownerHouseholdIds = [
          ...new Set(
            (ownerMemberships ?? []).map((row) => row.household_id as string),
          ),
        ];

        if (ownerHouseholdIds.length > 0) {
          const { data: sharedMembers } = await admin
            .from("household_members")
            .select("user_id")
            .in("household_id", ownerHouseholdIds)
            .eq("digest_opt_in", true)
            .neq("user_id", userId);

          const fanOutIds = [
            ...new Set((sharedMembers ?? []).map((row) => row.user_id as string)),
          ];

          for (const memberId of fanOutIds) {
            const { data: memberData } = await admin.auth.admin.getUserById(memberId);
            const memberEmail = memberData.user?.email;
            if (!memberEmail) continue;
            await sendDigestEmail(memberEmail, subject, parts.text, parts.html);
            sent += 1;
          }
        }
      } catch (fanOutError) {
        errors.push(
          `${userId} fan-out: ${
            fanOutError instanceof Error ? fanOutError.message : "Unknown error"
          }`,
        );
      }

      sent += 1;
    } catch (e) {
      errors.push(`${userId}: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  return { sent, skipped, errors };
}

export function shouldSendWeeklyDigest(now = new Date()): boolean {
  return now.getUTCDay() === 1 && now.getUTCHours() === 8;
}
