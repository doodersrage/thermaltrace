import type { AlertEventRow } from "./alertEvents";
import type { ChartPoint } from "./garageTempsHistory";
import { computeFreezeHours, type FreezeHoursSummary } from "./freezeHours";
import {
  summarizeProbesForReport,
  type MonthlyProbeSummary,
} from "./monthlyReportHtml";
import { escapeHtml } from "./htmlEscape";

export const CLAIMS_CRITICAL_KINDS = new Set([
  "threshold",
  "flood",
  "rate",
  "nws",
  "forecast",
  "runway",
]);

export type ClaimsDeviceSummary = {
  name: string;
  space: string | null;
  sensors: Array<{ label: string; kind: string }>;
};

export type ClaimsPackData = {
  exportedAt: string;
  householdLabel: string;
  rangeFrom: string;
  rangeTo: string;
  freezeThresholdF: number;
  freezeHours: FreezeHoursSummary;
  probes: MonthlyProbeSummary[];
  devices: ClaimsDeviceSummary[];
  events: AlertEventRow[];
  criticalEvents: AlertEventRow[];
  floodAlertCount: number;
  readingsCsvUrl: string;
  alertsCsvUrl: string;
  disclaimer: string;
  /** One-paragraph adjuster-facing summary of the window. */
  executiveSummary: string;
  /** How an adjuster should use companion CSVs + verification. */
  adjusterNotes: string;
  /** Live History deep-link for the same window. */
  historyUrl?: string;
  /** Set after the pack is persisted as a durable export -- see claimsPackExports.ts. */
  verifyUrl?: string | null;
  contentHash?: string | null;
};

export function buildClaimsExecutiveSummary(input: {
  householdLabel: string;
  rangeFrom: string;
  rangeTo: string;
  freezeThresholdF: number;
  freezeHours: FreezeHoursSummary;
  criticalCount: number;
  deviceCount: number;
  floodAlertCount: number;
}): string {
  const fromLabel = formatRangeDate(input.rangeFrom);
  const toLabel = formatRangeDate(input.rangeTo);
  const coldest = formatTemp(input.freezeHours.coldestF);
  const hours = input.freezeHours.hoursBelow34.toFixed(1);
  const floodClause =
    input.floodAlertCount > 0
      ? ` Including ${input.floodAlertCount} flood/leak alert${input.floodAlertCount === 1 ? "" : "s"}.`
      : " No flood/leak alerts in this window.";
  return (
    `For household “${input.householdLabel}” from ${fromLabel} to ${toLabel} (UTC dates), ` +
    `${input.deviceCount} monitored device${input.deviceCount === 1 ? "" : "s"} recorded ` +
    `${input.freezeHours.totalReadings} temperature reading${input.freezeHours.totalReadings === 1 ? "" : "s"}. ` +
    `Coldest indoor probe reading was ${coldest}; approximately ${hours} hours were at or below the ` +
    `${input.freezeThresholdF}°F household freeze threshold. ` +
    `${input.criticalCount} critical alert event${input.criticalCount === 1 ? "" : "s"} ` +
    `(freeze / leak / rate / NWS / forecast / time-to-freeze) appear in the timeline below.` +
    floodClause
  );
}

export const CLAIMS_ADJUSTER_NOTES =
  "Use this PDF as a cover sheet: confirm the verification code or URL if present, download the companion readings and alert CSVs for the same window, and compare timestamps to any on-site hardware logs. Freeze threshold is a household setting, not a regulatory standard.";

export const CLAIMS_DISCLAIMER =
  "This pack is a monitoring record exported by ThermalTrace for the household's own use. It is not a legal determination, insurance appraisal, or proof of coverage. Adjusters should verify timestamps against original sensor hardware and delivery channels where required.";

function formatTemp(value: number | null): string {
  return value != null ? `${value.toFixed(1)}°F` : "—";
}

function formatRangeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

export function filterCriticalAlertEvents(
  events: AlertEventRow[],
): AlertEventRow[] {
  return events.filter((e) => CLAIMS_CRITICAL_KINDS.has(e.kind));
}

export function buildClaimsPackData(input: {
  exportedAt?: string;
  householdLabel: string;
  rangeFrom: string;
  rangeTo: string;
  freezeThresholdF: number;
  points: ChartPoint[];
  events: AlertEventRow[];
  devices: ClaimsDeviceSummary[];
  readingsCsvUrl: string;
  alertsCsvUrl: string;
  /** Deep-link to History for the same window. */
  historyUrl?: string;
}): ClaimsPackData {
  const freezeHours = computeFreezeHours(input.points, input.freezeThresholdF);
  const probes = summarizeProbesForReport(input.points);
  const criticalEvents = filterCriticalAlertEvents(input.events);
  const floodAlertCount = criticalEvents.filter((e) => e.kind === "flood").length;

  return {
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    householdLabel: input.householdLabel,
    rangeFrom: input.rangeFrom,
    rangeTo: input.rangeTo,
    freezeThresholdF: input.freezeThresholdF,
    freezeHours,
    probes,
    devices: input.devices,
    events: input.events,
    criticalEvents,
    floodAlertCount,
    readingsCsvUrl: input.readingsCsvUrl,
    alertsCsvUrl: input.alertsCsvUrl,
    historyUrl: input.historyUrl,
    disclaimer: CLAIMS_DISCLAIMER,
    executiveSummary: buildClaimsExecutiveSummary({
      householdLabel: input.householdLabel,
      rangeFrom: input.rangeFrom,
      rangeTo: input.rangeTo,
      freezeThresholdF: input.freezeThresholdF,
      freezeHours,
      criticalCount: criticalEvents.length,
      deviceCount: input.devices.length,
      floodAlertCount,
    }),
    adjusterNotes: CLAIMS_ADJUSTER_NOTES,
    verifyUrl: null,
    contentHash: null,
  };
}

function statBlock(label: string, value: string, detail?: string): string {
  return `<div class="stat">
    <div class="stat-label">${escapeHtml(label)}</div>
    <div class="stat-value">${escapeHtml(value)}</div>
    ${detail ? `<div class="stat-detail">${escapeHtml(detail)}</div>` : ""}
  </div>`;
}

export function buildClaimsPackHtml(data: ClaimsPackData): string {
  const fromLabel = formatRangeDate(data.rangeFrom);
  const toLabel = formatRangeDate(data.rangeTo);
  const title = `ThermalTrace claims pack — ${fromLabel} to ${toLabel}`;

  const deviceRows =
    data.devices.length === 0
      ? `<tr><td colspan="3">No devices recorded for this household.</td></tr>`
      : data.devices
          .map((device) => {
            const sensors = device.sensors
              .map((s) => `${s.label} (${s.kind})`)
              .join(", ");
            return `<tr>
              <td>${escapeHtml(device.name)}</td>
              <td>${escapeHtml(device.space ?? "—")}</td>
              <td>${escapeHtml(sensors || "—")}</td>
            </tr>`;
          })
          .join("");

  const probeRows =
    data.probes.length === 0
      ? `<tr><td colspan="4">No temperature readings in this window.</td></tr>`
      : data.probes
          .map(
            (probe) => `<tr>
              <td>${escapeHtml(probe.label)}</td>
              <td>${probe.minF.toFixed(1)}–${probe.maxF.toFixed(1)}°F</td>
              <td>${probe.avgHumidity.toFixed(0)}%</td>
              <td>${probe.readingCount}</td>
            </tr>`,
          )
          .join("");

  const criticalRows =
    data.criticalEvents.length === 0
      ? `<tr><td colspan="4">No freeze, leak, rate, forecast, time-to-freeze, or NWS alerts in this window.</td></tr>`
      : data.criticalEvents
          .map(
            (event) => `<tr>
              <td>${escapeHtml(formatDateTime(event.created_at))}</td>
              <td>${escapeHtml(event.kind)}</td>
              <td>${escapeHtml(event.title)}</td>
              <td>${escapeHtml((event.channels_sent ?? []).join(", ") || "—")}</td>
            </tr>`,
          )
          .join("");

  const eventRows =
    data.events.length === 0
      ? `<tr><td colspan="4">No alert events in this window.</td></tr>`
      : data.events
          .map(
            (event) => `<tr>
              <td>${escapeHtml(formatDateTime(event.created_at))}</td>
              <td>${escapeHtml(event.kind)}</td>
              <td>${escapeHtml(event.title)}</td>
              <td>${escapeHtml((event.channels_sent ?? []).join(", ") || "—")}</td>
            </tr>`,
          )
          .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      padding: 32px 24px;
      background: #fff;
      color: #111827;
      font-family: Georgia, "Times New Roman", serif;
      line-height: 1.5;
      font-size: 14px;
    }
    .wrap { max-width: 800px; margin: 0 auto; }
    h1 { font-size: 24px; margin: 0 0 8px; font-weight: 700; }
    h2 { font-size: 16px; margin: 28px 0 10px; border-bottom: 1px solid #d1d5db; padding-bottom: 6px; }
    .muted { color: #4b5563; margin: 0 0 16px; }
    .brand { font-family: system-ui, sans-serif; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 16px; font-size: 13px; }
    .brand span.accent { color: #c2410c; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin: 16px 0 8px; }
    .stat { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: #f9fafb; }
    .stat-label { font-family: system-ui, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; }
    .stat-value { font-family: system-ui, sans-serif; font-size: 20px; font-weight: 600; margin-top: 4px; }
    .stat-detail { font-family: system-ui, sans-serif; font-size: 11px; color: #6b7280; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-family: system-ui, sans-serif; font-size: 13px; }
    th, td { text-align: left; padding: 8px 10px; border-top: 1px solid #e5e7eb; vertical-align: top; }
    th { background: #f3f4f6; font-size: 11px; text-transform: uppercase; letter-spacing: 0.03em; color: #4b5563; }
    .downloads { font-family: system-ui, sans-serif; margin: 16px 0; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; background: #fff7ed; }
    .downloads a { color: #9a3412; }
    .disclaimer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #d1d5db; font-size: 12px; color: #4b5563; }
    .print-hint { font-family: system-ui, sans-serif; font-size: 12px; color: #6b7280; margin: 8px 0 0; }
    @media print {
      body { padding: 0; }
      .downloads, .print-hint { display: none; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <p class="brand">Thermal<span class="accent">Trace</span></p>
    <h1>Claims / insurance evidence pack</h1>
    <p class="muted">
      Household: ${escapeHtml(data.householdLabel)} · Window: ${escapeHtml(fromLabel)} → ${escapeHtml(toLabel)} · Exported ${escapeHtml(formatDateTime(data.exportedAt))}
    </p>

    <section>
      <h2>Executive summary</h2>
      <p style="font-family: system-ui, sans-serif; font-size: 13px; margin: 0 0 8px;">
        ${escapeHtml(data.executiveSummary)}
      </p>
      <p style="font-family: system-ui, sans-serif; font-size: 12px; color: #4b5563; margin: 0;">
        ${escapeHtml(data.adjusterNotes)}
      </p>
    </section>

    <div class="downloads">
      <strong>Companion downloads</strong>
      <ul>
        <li><a href="${escapeHtml(data.readingsCsvUrl)}">Readings CSV</a> (same date window)</li>
        <li><a href="${escapeHtml(data.alertsCsvUrl)}">Alert events CSV</a> (same date window)</li>
        ${
          data.historyUrl
            ? `<li><a href="${escapeHtml(data.historyUrl)}">Open this window on History</a></li>`
            : ""
        }
      </ul>
    </div>

    <section>
      <h2>Freeze exposure</h2>
      <div class="stats">
        ${statBlock("Coldest", formatTemp(data.freezeHours.coldestF))}
        ${statBlock("Hours ≤ threshold", `${data.freezeHours.hoursBelow34.toFixed(1)} h`, `≤ ${data.freezeThresholdF}°F`)}
        ${statBlock("Readings ≤ threshold", String(data.freezeHours.readingsBelow34))}
        ${statBlock("Total readings", String(data.freezeHours.totalReadings))}
        ${statBlock("Freeze threshold", `${data.freezeThresholdF}°F`)}
        ${statBlock("Critical alerts", String(data.criticalEvents.length), "freeze / leak / rate / NWS / forecast / time-to-freeze")}
        ${statBlock("Flood / leak alerts", String(data.floodAlertCount), "wet-contact events in window")}
      </div>
    </section>

    <section>
      <h2>Devices in scope</h2>
      <table>
        <thead><tr><th>Device</th><th>Space</th><th>Sensors</th></tr></thead>
        <tbody>${deviceRows}</tbody>
      </table>
    </section>

    <section>
      <h2>By probe</h2>
      <table>
        <thead><tr><th>Probe</th><th>Range</th><th>Avg humidity</th><th>Readings</th></tr></thead>
        <tbody>${probeRows}</tbody>
      </table>
    </section>

    <section>
      <h2>Critical alerts (freeze / leak / rate / NWS / forecast / time-to-freeze)</h2>
      <table>
        <thead><tr><th>When (UTC)</th><th>Kind</th><th>Title</th><th>Channels sent</th></tr></thead>
        <tbody>${criticalRows}</tbody>
      </table>
    </section>

    <section>
      <h2>Full alert timeline</h2>
      <table>
        <thead><tr><th>When (UTC)</th><th>Kind</th><th>Title</th><th>Channels sent</th></tr></thead>
        <tbody>${eventRows}</tbody>
      </table>
    </section>

    ${
      data.verifyUrl || data.contentHash
        ? `<section>
      <h2>Verification</h2>
      <p class="mb-0" style="font-family: system-ui, sans-serif; font-size: 12px; color: #4b5563;">
        ${data.contentHash ? `Verification code: <code>${escapeHtml(data.contentHash)}</code><br />` : ""}
        ${data.verifyUrl ? `Re-view or verify this export at <a href="${escapeHtml(data.verifyUrl)}">${escapeHtml(data.verifyUrl)}</a>.` : ""}
      </p>
    </section>`
        : ""
    }

    <p class="disclaimer">${escapeHtml(data.disclaimer)}</p>
  </div>
</body>
</html>`;
}
