/** Build History deep-links with a concrete from/to window. */

export type HistoryChartUrlOptions = {
  from: string;
  to: string;
  tab?: "chart" | "table" | "exports";
  highlightAlertId?: number;
  feed?: string;
  probe?: string;
};

/** UTC calendar day `YYYY-MM-DD`. */
export function isoDayUtc(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Inclusive trailing window of `days` UTC calendar days ending today. */
export function trailingHistoryWindowDays(
  days: number,
  now = new Date(),
): { from: string; to: string } {
  const safeDays = Math.max(1, Math.floor(days));
  const to = isoDayUtc(now);
  const fromDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (safeDays - 1)),
  );
  return { from: isoDayUtc(fromDate), to };
}

/** Floor/ceil a chart time window to History `from`/`to` day params. */
export function timeWindowToHistoryDates(window: {
  minTs: number;
  maxTs: number;
}): { from: string; to: string } {
  return {
    from: isoDayUtc(new Date(window.minTs)),
    to: isoDayUtc(new Date(window.maxTs)),
  };
}

/**
 * Absolute or site-relative History URL.
 * Pass `siteUrl` null/empty for a path-only link (clipboard / in-app).
 */
export function buildHistoryChartUrl(
  siteUrl: string | null | undefined,
  opts: HistoryChartUrlOptions,
): string {
  const params = new URLSearchParams();
  params.set("from", opts.from);
  params.set("to", opts.to);
  if (opts.tab && opts.tab !== "chart") params.set("tab", opts.tab);
  if (opts.highlightAlertId != null && Number.isFinite(opts.highlightAlertId)) {
    params.set("alert", String(Math.trunc(opts.highlightAlertId)));
  }
  if (opts.feed?.trim()) params.set("feed", opts.feed.trim());
  if (opts.probe?.trim()) params.set("probe", opts.probe.trim());

  const path = `/dashboard/history?${params.toString()}`;
  const base = (siteUrl ?? "").trim().replace(/\/+$/, "");
  return base ? `${base}${path}` : path;
}
