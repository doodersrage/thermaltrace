import { createAdminClient } from "./supabase";
import type { ChartPoint } from "./garageTempsHistory";
import { getAlertSettingsForUser, notifyUser } from "./notify";
import { listAllHouseholdOwnerUserIds } from "./households";
import { brandedEmailParts, type EmailSection } from "./emailLayout";
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

type DigestProbeSummary = {
  label: string;
  minF: number;
  maxF: number;
  avgHumidity: number;
  readingCount: number;
};

type DigestDaySummary = {
  dayLabel: string;
  minF: number;
  maxF: number;
  avgF: number;
  coldestProbe: string | null;
};

function summarizeProbes(points: ChartPoint[]): DigestProbeSummary[] {
  const byProbe = new Map<string, ChartPoint[]>();

  for (const point of points) {
    const group = byProbe.get(point.probeLabel) ?? [];
    group.push(point);
    byProbe.set(point.probeLabel, group);
  }

  return [...byProbe.entries()].map(([label, probePoints]) => {
    const temps = probePoints.map((point) => point.tempf);
    const humidities = probePoints.map((point) => point.humidity);
    return {
      label,
      minF: Math.min(...temps),
      maxF: Math.max(...temps),
      avgHumidity:
        humidities.reduce((sum, value) => sum + value, 0) / humidities.length,
      readingCount: probePoints.length,
    };
  });
}

function summarizePoints(points: ChartPoint[]): string[] {
  return summarizeProbes(points).map(
    (probe) =>
      `${probe.label}: ${probe.minF.toFixed(1)}–${probe.maxF.toFixed(1)} °F, avg humidity ${probe.avgHumidity.toFixed(0)}% (${probe.readingCount} readings)`,
  );
}

function summarizeDays(points: ChartPoint[]): DigestDaySummary[] {
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
      return {
        dayLabel,
        minF: min,
        maxF: max,
        avgF: avg,
        coldestProbe: mixedProbes ? coldest.probeLabel : null,
      };
    });
}

/** One line per calendar day (UTC): min–max, avg, and coldest probe when mixed. */
export function summarizePointsByDay(points: ChartPoint[]): string[] {
  return summarizeDays(points).map((day) => {
    const coldestNote = day.coldestProbe ? ` · coldest ${day.coldestProbe}` : "";
    return `${day.dayLabel}: ${day.minF.toFixed(1)}–${day.maxF.toFixed(1)} °F (avg ${day.avgF.toFixed(1)}°${coldestNote})`;
  });
}

function formatDigestWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function digestHighlightStats(points: ChartPoint[]) {
  const coldest = points.reduce((a, b) => (a.tempf <= b.tempf ? a : b));
  const hottest = points.reduce((a, b) => (a.tempf >= b.tempf ? a : b));
  const wettest = points.reduce((a, b) => (a.humidity >= b.humidity ? a : b));
  const avgTemp = points.reduce((sum, p) => sum + p.tempf, 0) / points.length;

  return [
    {
      label: "Coldest",
      value: `${coldest.tempf.toFixed(1)}°F`,
      detail: `${formatDigestWhen(coldest.timestamp)} · ${coldest.probeLabel}`,
    },
    {
      label: "Warmest",
      value: `${hottest.tempf.toFixed(1)}°F`,
      detail: `${formatDigestWhen(hottest.timestamp)} · ${hottest.probeLabel}`,
    },
    {
      label: "7-day average",
      value: `${avgTemp.toFixed(1)}°F`,
      detail: `${points.length} readings`,
    },
    {
      label: "Highest humidity",
      value: `${wettest.humidity.toFixed(0)}%`,
      detail: `${formatDigestWhen(wettest.timestamp)} · ${wettest.probeLabel}`,
    },
  ];
}

export function buildWeeklyDigestParts(input: {
  points: ChartPoint[];
  freezeThresholdF: number;
  siteUrl: string;
}): { subject: string; text: string; html: string; notifyBody: string } {
  const { points, freezeThresholdF, siteUrl } = input;
  const freeze = computeFreezeHours(points, freezeThresholdF);
  const freezeLine = formatDigestFreezeLine(points, freezeThresholdF);
  const freezeBody = freezeLine.replace(/^Freeze exposure:\s*/i, "");
  const probes = summarizeProbes(points);
  const days = summarizeDays(points);
  const mixedDays = days.some((day) => day.coldestProbe);
  const summary = summarizePoints(points);
  const byDay = summarizePointsByDay(points);

  const sections: EmailSection[] = [
    {
      type: "callout",
      tone: freeze.readingsBelow34 === 0 ? "success" : "alert",
      title: "Freeze exposure",
      body: freezeBody.charAt(0).toUpperCase() + freezeBody.slice(1),
    },
    { type: "heading", text: "Highlights" },
    { type: "stats", items: digestHighlightStats(points) },
  ];

  if (probes.length > 0) {
    sections.push(
      { type: "heading", text: "By probe" },
      {
        type: "table",
        headers: ["Probe", "Range", "Humidity"],
        rows: probes.map((probe) => [
          probe.label,
          `${probe.minF.toFixed(1)}–${probe.maxF.toFixed(1)}°F`,
          `${probe.avgHumidity.toFixed(0)}% · ${probe.readingCount} readings`,
        ]),
      },
    );
  }

  if (days.length > 0) {
    sections.push(
      { type: "heading", text: "Day by day" },
      {
        type: "table",
        headers: mixedDays ? ["Day", "Range", "Avg", "Coldest"] : ["Day", "Range", "Avg"],
        rows: days.map((day) => {
          const row = [
            day.dayLabel,
            `${day.minF.toFixed(1)}–${day.maxF.toFixed(1)}°F`,
            `${day.avgF.toFixed(1)}°`,
          ];
          if (mixedDays) row.push(day.coldestProbe ?? "—");
          return row;
        }),
      },
    );
  }

  sections.push({
    type: "note",
    text: "Tip: outage and leak alerts fire separately when sensors go quiet or wet.",
  });

  const parts = brandedEmailParts({
    eyebrow: "Weekly digest",
    preheader: freezeLine,
    title: "This week at your probes",
    intro:
      "Here’s a quick look at the last 7 days — coldest night, freeze crossings, and anything else to watch.",
    sections,
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

  return {
    subject: formatWeeklyDigestSubject(points),
    text: parts.text,
    html: parts.html,
    notifyBody: [freezeLine, ...summary, ...byDay].join("\n"),
  };
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

      const digest = buildWeeklyDigestParts({
        points,
        freezeThresholdF: settings.freezeThresholdF,
        siteUrl,
      });

      await sendDigestEmail(
        digestEmail,
        digest.subject,
        digest.text,
        digest.html,
      );

      await notifyUser(userId, digestEmail, { ...settings, channelEmail: false }, {
        title: digest.subject,
        body: digest.notifyBody,
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
            await sendDigestEmail(memberEmail, digest.subject, digest.text, digest.html);
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
