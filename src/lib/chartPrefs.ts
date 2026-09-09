import type { ChartViewPresetId } from "./historyChartInteraction";

export type HistoryChartPrefs = {
  presetId?: ChartViewPresetId | "all";
  visibleProbes?: string[];
  houseVisible?: boolean;
  humidityOn?: boolean;
};

export const HISTORY_CHART_PREFS_KEY = "tt-history-chart-prefs-v1";
export const DELTA_CHART_PREFS_KEY = "tt-delta-chart-prefs-v1";

export type DeltaChartPrefs = {
  presetId?: ChartViewPresetId | "all";
};

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readHistoryChartPrefs(): HistoryChartPrefs | null {
  const prefs = readJson<HistoryChartPrefs>(HISTORY_CHART_PREFS_KEY);
  if (!prefs || typeof prefs !== "object") return null;
  return prefs;
}

export function writeHistoryChartPrefs(patch: Partial<HistoryChartPrefs>): void {
  const current = readHistoryChartPrefs() ?? {};
  writeJson(HISTORY_CHART_PREFS_KEY, { ...current, ...patch });
}

export function readDeltaChartPrefs(): DeltaChartPrefs | null {
  const prefs = readJson<DeltaChartPrefs>(DELTA_CHART_PREFS_KEY);
  if (!prefs || typeof prefs !== "object") return null;
  return prefs;
}

export function writeDeltaChartPrefs(patch: Partial<DeltaChartPrefs>): void {
  const current = readDeltaChartPrefs() ?? {};
  writeJson(DELTA_CHART_PREFS_KEY, { ...current, ...patch });
}

/** Intersect stored probe labels with the current series set. */
export function mergeVisibleProbes(
  stored: string[] | undefined,
  probeLabels: string[],
): Set<string> {
  if (!stored || stored.length === 0) return new Set(probeLabels);
  const allowed = new Set(probeLabels);
  const next = new Set(stored.filter((label) => allowed.has(label)));
  if (next.size === 0) {
    for (const label of probeLabels) next.add(label);
  }
  return next;
}
