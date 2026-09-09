import type { ChartPoint } from "./garageTempsHistory";

export type FreezeHoursSummary = {
  hoursBelow34: number;
  /** Degree-hours below threshold (severity × time). */
  degreeHoursBelow: number;
  readingsBelow34: number;
  totalReadings: number;
  coldestF: number | null;
};

export type DailyFreezeHours = {
  /** Local calendar day key YYYY-MM-DD */
  dayKey: string;
  label: string;
  hoursBelow: number;
  coldestF: number | null;
};

function localDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localDayLabel(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  if (!y || !m || !d) return dayKey;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

/** Estimate freeze exposure from chart points (readings below threshold). */
export function computeFreezeHours(
  points: ChartPoint[],
  thresholdF = 34,
): FreezeHoursSummary {
  const below = points.filter((p) => p.tempf <= thresholdF);
  if (points.length < 2) {
    return {
      hoursBelow34: 0,
      degreeHoursBelow: 0,
      readingsBelow34: below.length,
      totalReadings: points.length,
      coldestF: below.length ? Math.min(...below.map((p) => p.tempf)) : null,
    };
  }

  const sorted = [...points].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
  let msBelow = 0;
  let degreeMs = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const dt = Math.max(0, Date.parse(cur.timestamp) - Date.parse(prev.timestamp));
    if (prev.tempf <= thresholdF || cur.tempf <= thresholdF) {
      msBelow += dt;
      const avgDeficit =
        (Math.max(0, thresholdF - prev.tempf) + Math.max(0, thresholdF - cur.tempf)) /
        2;
      degreeMs += avgDeficit * dt;
    }
  }

  return {
    hoursBelow34: msBelow / (60 * 60 * 1000),
    degreeHoursBelow: degreeMs / (60 * 60 * 1000),
    readingsBelow34: below.length,
    totalReadings: points.length,
    coldestF: below.length ? Math.min(...below.map((p) => p.tempf)) : null,
  };
}

/**
 * Daily hours at/below freeze for a bar chart.
 * Interval time is attributed to the local day of the earlier sample.
 */
export function computeDailyFreezeHours(
  points: ChartPoint[],
  thresholdF = 34,
): DailyFreezeHours[] {
  if (points.length < 2) return [];

  const sorted = [...points].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
  const byDay = new Map<string, { msBelow: number; coldestF: number | null }>();

  const touchDay = (dayKey: string, ms: number, temps: number[]) => {
    const row = byDay.get(dayKey) ?? { msBelow: 0, coldestF: null as number | null };
    row.msBelow += ms;
    for (const t of temps) {
      if (t <= thresholdF) {
        row.coldestF = row.coldestF == null ? t : Math.min(row.coldestF, t);
      }
    }
    byDay.set(dayKey, row);
  };

  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    const dt = Math.max(0, Date.parse(cur.timestamp) - Date.parse(prev.timestamp));
    const dayKey = localDayKey(prev.timestamp);
    if (prev.tempf <= thresholdF || cur.tempf <= thresholdF) {
      touchDay(dayKey, dt, [prev.tempf, cur.tempf]);
    } else if (!byDay.has(dayKey)) {
      byDay.set(dayKey, { msBelow: 0, coldestF: null });
    }
  }

  const firstKey = localDayKey(sorted[0]!.timestamp);
  const lastKey = localDayKey(sorted[sorted.length - 1]!.timestamp);
  const cursor = new Date(`${firstKey}T12:00:00`);
  const end = new Date(`${lastKey}T12:00:00`);
  while (cursor.getTime() <= end.getTime()) {
    const key = localDayKey(cursor.toISOString());
    if (!byDay.has(key)) byDay.set(key, { msBelow: 0, coldestF: null });
    cursor.setDate(cursor.getDate() + 1);
  }

  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dayKey, row]) => ({
      dayKey,
      label: localDayLabel(dayKey),
      hoursBelow: row.msBelow / (60 * 60 * 1000),
      coldestF: row.coldestF,
    }));
}
