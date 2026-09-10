import { createServerClient } from "./supabase";
import { escapeCsvField } from "./csvEscape";
import { getUserHouseholdId } from "./households";
import { applySensorOffset } from "./sensorCalibration";

export type GarageTempReading = {
  tempc: number;
  tempf: number;
  humidity: number;
  timestamp: string;
  feed_name?: string | null;
  probe_label?: string | null;
  probe_key?: string | null;
  user_id?: string | null;
};

export type PaginatedGarageTemps = {
  readings: GarageTempReading[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  error: string | null;
};

export const GARAGE_TEMPS_PAGE_SIZE = 20;

export type HistoryFilters = {
  feedName?: string;
  probeKey?: string;
  from?: string;
  to?: string;
};

export type ChartPoint = {
  timestamp: string;
  tempf: number;
  humidity: number;
  probeLabel: string;
};

type SensorRow = {
  recorded_at: string;
  value_num: number | null;
  meta: Record<string, unknown> | null;
  device_sensors: {
    key: string;
    label: string;
    kind: string;
    offset_num?: number | null;
    devices: {
      name: string;
    } | null;
  } | null;
};

const SENSOR_READING_SELECT = `
  recorded_at,
  value_num,
  meta,
  device_sensors!inner (
    key,
    label,
    kind,
    offset_num,
    devices!inner (
      name
    )
  )
`;

/** PostgREST default page size — fetch in batches to avoid silent truncation. */
const POSTGREST_PAGE_SIZE = 1000;

/** Max chart points after full-window fetch; applied per-probe so lines stay balanced. */
export const CHART_DISPLAY_CAP = 500;

export function formatReadingTimestamp(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function getReadingFeedName(reading: GarageTempReading): string {
  return reading.feed_name?.trim() || "Garage";
}

export function getReadingProbeLabel(reading: GarageTempReading): string {
  return reading.probe_label?.trim() || "Average";
}

export function pairTempHumidityRows(
  rows: SensorRow[],
  userId: string,
): GarageTempReading[] {
  const temps = new Map<string, SensorRow>();
  const humidities = new Map<string, SensorRow>();

  for (const row of rows) {
    const sensor = row.device_sensors;
    if (!sensor || row.value_num == null) continue;
    const deviceName = sensor.devices?.name ?? "Device";
    const key = `${deviceName}::${sensor.key}::${row.recorded_at}`;
    if (sensor.kind === "temperature") temps.set(key, row);
    if (sensor.kind === "humidity") humidities.set(key, row);
  }

  const readings: GarageTempReading[] = [];
  const seen = new Set<string>();

  for (const [key, tempRow] of temps) {
    const sensor = tempRow.device_sensors!;
    const deviceName = sensor.devices?.name ?? "Device";
    const humidityRow = humidities.get(key);
    const rawTempF = Number(tempRow.value_num);
    const tempOffset =
      typeof sensor.offset_num === "number" ? sensor.offset_num : 0;
    const tempf = applySensorOffset(rawTempF, tempOffset);
    const meta = tempRow.meta ?? {};
    const tempc =
      typeof meta.tempc === "number" && tempOffset === 0
        ? meta.tempc
        : Number((((tempf - 32) * 5) / 9).toFixed(1));
    const humidityRaw =
      humidityRow?.value_num != null
        ? Number(humidityRow.value_num)
        : typeof meta.humidity === "number"
          ? Number(meta.humidity)
          : 0;
    const humidityOffset =
      typeof humidityRow?.device_sensors?.offset_num === "number"
        ? humidityRow.device_sensors.offset_num
        : 0;
    const humidity = applySensorOffset(humidityRaw, humidityOffset);

    readings.push({
      tempc,
      tempf,
      humidity,
      timestamp: tempRow.recorded_at,
      feed_name: deviceName,
      probe_label: sensor.label.replace(/ humidity$/i, ""),
      probe_key: sensor.key,
      user_id: userId,
    });
    seen.add(key);
  }

  for (const [key, humidityRow] of humidities) {
    if (seen.has(key)) continue;
    const sensor = humidityRow.device_sensors!;
    const deviceName = sensor.devices?.name ?? "Device";
    readings.push({
      tempc: 0,
      tempf: 0,
      humidity: applySensorOffset(
        Number(humidityRow.value_num ?? 0),
        typeof sensor.offset_num === "number" ? sensor.offset_num : 0,
      ),
      timestamp: humidityRow.recorded_at,
      feed_name: deviceName,
      probe_label: sensor.label.replace(/ humidity$/i, ""),
      probe_key: sensor.key,
      user_id: userId,
    });
  }

  readings.sort(
    (a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp),
  );
  return readings;
}

function matchesFilters(
  reading: GarageTempReading,
  filters: HistoryFilters,
): boolean {
  if (filters.feedName && getReadingFeedName(reading) !== filters.feedName) {
    return false;
  }
  if (filters.probeKey && (reading.probe_key?.trim() || "") !== filters.probeKey) {
    return false;
  }
  if (filters.from && Date.parse(reading.timestamp) < Date.parse(filters.from)) {
    return false;
  }
  if (filters.to && Date.parse(reading.timestamp) > Date.parse(filters.to)) {
    return false;
  }
  return true;
}

function applyHistoryFiltersToQuery<T extends { eq: Function; gte: Function; lte: Function }>(
  query: T,
  filters: HistoryFilters,
  options: { kind?: "temperature" | "humidity" } = {},
): T {
  let next = query;
  if (filters.from) {
    next = next.gte("recorded_at", filters.from) as T;
  }
  if (filters.to) {
    next = next.lte("recorded_at", filters.to) as T;
  }
  if (options.kind) {
    next = next.eq("device_sensors.kind", options.kind) as T;
  }
  if (filters.probeKey) {
    next = next.eq("device_sensors.key", filters.probeKey) as T;
  }
  if (filters.feedName) {
    next = next.eq("device_sensors.devices.name", filters.feedName) as T;
  }
  return next;
}

async function fetchAllRawSensorRows(
  householdId: string,
  filters: HistoryFilters,
  options: {
    kinds?: Array<"temperature" | "humidity">;
    ascending?: boolean;
  } = {},
): Promise<{ rows: SensorRow[]; error: string | null }> {
  const supabase = createServerClient();
  const kinds = options.kinds ?? ["temperature", "humidity"];
  const rows: SensorRow[] = [];

  for (let offset = 0; ; offset += POSTGREST_PAGE_SIZE) {
    let query = supabase
      .from("sensor_readings")
      .select(SENSOR_READING_SELECT)
      .eq("household_id", householdId);

    query = applyHistoryFiltersToQuery(query, filters);
    query = query
      .order("recorded_at", { ascending: options.ascending === true })
      .order("id", { ascending: options.ascending === true })
      .range(offset, offset + POSTGREST_PAGE_SIZE - 1);

    const { data, error } = await query;
    if (error) {
      return { rows: [], error: error.message };
    }

    const batch = ((data ?? []) as SensorRow[]).filter((row) => {
      const kind = row.device_sensors?.kind;
      return kind === "temperature" || kind === "humidity";
    }).filter((row) => kinds.includes(row.device_sensors!.kind as "temperature" | "humidity"));

    rows.push(...batch);
    if ((data?.length ?? 0) < POSTGREST_PAGE_SIZE) {
      break;
    }
  }

  return { rows, error: null };
}

async function countTemperatureHistoryRows(
  householdId: string,
  filters: HistoryFilters,
): Promise<{ count: number; error: string | null }> {
  const supabase = createServerClient();
  let query = supabase
    .from("sensor_readings")
    .select("id, device_sensors!inner(kind, key, devices!inner(name))", {
      count: "exact",
      head: true,
    })
    .eq("household_id", householdId);

  query = applyHistoryFiltersToQuery(query, filters, { kind: "temperature" });

  const { count, error } = await query;
  if (error) {
    return { count: 0, error: error.message };
  }
  return { count: count ?? 0, error: null };
}

export async function householdHasTemperatureHistory(userId: string): Promise<boolean> {
  const householdId = await getUserHouseholdId(userId);
  if (!householdId) return false;
  const { count, error } = await countTemperatureHistoryRows(householdId, {});
  if (error) return false;
  return count > 0;
}

async function fetchTemperatureHistoryPage(
  householdId: string,
  filters: HistoryFilters,
  page: number,
  pageSize: number,
): Promise<{ rows: SensorRow[]; error: string | null }> {
  const supabase = createServerClient();
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("sensor_readings")
    .select(SENSOR_READING_SELECT)
    .eq("household_id", householdId);

  query = applyHistoryFiltersToQuery(query, filters, { kind: "temperature" });
  query = query
    .order("recorded_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error } = await query;
  if (error) {
    return { rows: [], error: error.message };
  }

  return { rows: (data ?? []) as SensorRow[], error: null };
}

async function fetchHumidityRowsForTemps(
  householdId: string,
  tempRows: SensorRow[],
): Promise<{ rows: SensorRow[]; error: string | null }> {
  if (tempRows.length === 0) {
    return { rows: [], error: null };
  }

  const wantedKeys = new Set<string>();
  const timestamps = new Set<string>();
  for (const row of tempRows) {
    const sensor = row.device_sensors;
    if (!sensor) continue;
    const deviceName = sensor.devices?.name ?? "Device";
    wantedKeys.add(`${deviceName}::${sensor.key}`);
    timestamps.add(row.recorded_at);
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("sensor_readings")
    .select(SENSOR_READING_SELECT)
    .eq("household_id", householdId)
    .eq("device_sensors.kind", "humidity")
    .in("recorded_at", [...timestamps]);

  if (error) {
    return { rows: [], error: error.message };
  }

  const rows = ((data ?? []) as SensorRow[]).filter((row) => {
    const sensor = row.device_sensors;
    if (!sensor) return false;
    const deviceName = sensor.devices?.name ?? "Device";
    return wantedKeys.has(`${deviceName}::${sensor.key}`);
  });

  return { rows, error: null };
}

/** Downsample chart/history points evenly per probe so one zone does not dominate. */
export function limitPairedReadingsFairly(
  readings: GarageTempReading[],
  limit: number,
  ascending: boolean,
): GarageTempReading[] {
  if (readings.length <= limit) {
    return readings;
  }

  const groups = new Map<string, GarageTempReading[]>();
  for (const reading of readings) {
    const groupKey = `${getReadingFeedName(reading)}::${reading.probe_key ?? ""}`;
    const bucket = groups.get(groupKey) ?? [];
    bucket.push(reading);
    groups.set(groupKey, bucket);
  }

  const perProbe = Math.max(1, Math.floor(limit / groups.size));
  const picked: GarageTempReading[] = [];

  for (const group of groups.values()) {
    const sorted = [...group].sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
    );
    if (sorted.length <= perProbe) {
      picked.push(...sorted);
      continue;
    }
    const stride = sorted.length / perProbe;
    for (let index = 0; index < perProbe; index += 1) {
      const sampleIndex = Math.min(
        sorted.length - 1,
        Math.floor(index * stride + stride / 2),
      );
      picked.push(sorted[sampleIndex]!);
    }
  }

  picked.sort((a, b) => {
    const diff = Date.parse(a.timestamp) - Date.parse(b.timestamp);
    return ascending ? diff : -diff;
  });

  return picked.slice(0, limit);
}

async function fetchPairedFromSensorReadings(
  userId: string,
  filters: HistoryFilters = {},
  options: { limit?: number; ascending?: boolean } = {},
): Promise<{ readings: GarageTempReading[]; error: string | null }> {
  const householdId = await getUserHouseholdId(userId);
  if (!householdId) {
    return { readings: [], error: null };
  }

  const { rows, error } = await fetchAllRawSensorRows(householdId, filters, {
    ascending: options.ascending,
  });
  if (error) {
    return { readings: [], error };
  }

  let readings = pairTempHumidityRows(rows, userId);
  readings = readings.filter((reading) => matchesFilters(reading, filters));
  if (options.limit && readings.length > options.limit) {
    readings = limitPairedReadingsFairly(
      readings,
      options.limit,
      options.ascending === true,
    );
  }
  return { readings, error: null };
}

export async function fetchGarageTempHistory(
  userId: string,
  page = 1,
  pageSize = GARAGE_TEMPS_PAGE_SIZE,
  filters: HistoryFilters = {},
): Promise<PaginatedGarageTemps> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const householdId = await getUserHouseholdId(userId);
  if (!householdId) {
    return {
      readings: [],
      page: safePage,
      pageSize,
      totalCount: 0,
      totalPages: 0,
      error: null,
    };
  }

  const [{ count, error: countError }, tempPage] = await Promise.all([
    countTemperatureHistoryRows(householdId, filters),
    fetchTemperatureHistoryPage(householdId, filters, safePage, pageSize),
  ]);

  if (countError || tempPage.error) {
    return {
      readings: [],
      page: safePage,
      pageSize,
      totalCount: 0,
      totalPages: 0,
      error: countError ?? tempPage.error,
    };
  }

  const humidityPage = await fetchHumidityRowsForTemps(householdId, tempPage.rows);
  if (humidityPage.error) {
    return {
      readings: [],
      page: safePage,
      pageSize,
      totalCount: 0,
      totalPages: 0,
      error: humidityPage.error,
    };
  }

  const readings = pairTempHumidityRows(
    [...tempPage.rows, ...humidityPage.rows],
    userId,
  ).filter((reading) => matchesFilters(reading, filters));

  const totalCount = count;
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize);

  return {
    readings,
    page: safePage,
    pageSize,
    totalCount,
    totalPages,
    error: null,
  };
}

export async function fetchAllGarageTempReadings(
  userId: string,
  filters: HistoryFilters = {},
): Promise<{
  readings: GarageTempReading[];
  error: string | null;
}> {
  const householdId = await getUserHouseholdId(userId);
  if (!householdId) {
    return { readings: [], error: null };
  }

  const { rows, error } = await fetchAllRawSensorRows(householdId, filters, {
    ascending: false,
  });
  if (error) {
    return { readings: [], error };
  }

  const readings = pairTempHumidityRows(rows, userId).filter((reading) =>
    matchesFilters(reading, filters),
  );
  return { readings, error: null };
}

export async function fetchGarageTempChartData(
  userId: string,
  days = 7,
  filters: HistoryFilters = {},
): Promise<{ points: ChartPoint[]; error: string | null }> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = filters.from ?? since.toISOString();
  const chartFilters = { ...filters, from: sinceIso };

  const fromSensor = await fetchPairedFromSensorReadings(userId, chartFilters, {
    ascending: true,
    limit: CHART_DISPLAY_CAP,
  });

  if (fromSensor.error) {
    return { points: [], error: fromSensor.error };
  }

  const readings = [...fromSensor.readings].sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );

  const points: ChartPoint[] = readings.map((row) => ({
    timestamp: row.timestamp,
    tempf: Number(row.tempf),
    humidity: Number(row.humidity),
    probeLabel: row.probe_label?.trim() || row.probe_key || "Probe",
  }));

  // For windows beyond raw retention, fill gaps from hourly rollups.
  if (days > 90 || points.length < 10) {
    const householdId = await getUserHouseholdId(userId);
    const rollupPoints = householdId
      ? await fetchRollupChartPointsForHousehold(householdId, sinceIso, filters)
      : [];
    if (rollupPoints.length > 0) {
      const byTs = new Map(points.map((p) => [p.timestamp, p]));
      for (const point of rollupPoints) {
        if (!byTs.has(point.timestamp)) byTs.set(point.timestamp, point);
      }
      const merged = [...byTs.values()].sort(
        (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
      );
      return { points: merged, error: null };
    }
  }

  return { points, error: null };
}

async function fetchRollupChartPointsForHousehold(
  householdId: string,
  sinceIso: string,
  filters: HistoryFilters = {},
): Promise<ChartPoint[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("sensor_reading_rollups")
    .select(
      `
      bucket_start,
      avg_num,
      device_sensors!inner (
        key,
        label,
        kind,
        offset_num,
        devices!inner ( name )
      )
    `,
    )
    .eq("household_id", householdId)
    .gte("bucket_start", sinceIso)
    .order("bucket_start", { ascending: true })
    .limit(2000);

  if (error || !data) return [];

  const points: ChartPoint[] = [];
  for (const row of data as Array<{
    bucket_start: string;
    avg_num: number | null;
    device_sensors: {
      key: string;
      label: string;
      kind: string;
      offset_num?: number | null;
      devices: { name: string } | null;
    } | null;
  }>) {
    if (row.avg_num == null || row.device_sensors?.kind !== "temperature") continue;
    const probeLabel =
      row.device_sensors.label.replace(/ humidity$/i, "") ||
      row.device_sensors.key ||
      "Probe";
    const feedName = row.device_sensors.devices?.name ?? "Device";
    if (filters.feedName && feedName !== filters.feedName) continue;
    if (filters.probeKey && row.device_sensors.key !== filters.probeKey) continue;
    points.push({
      timestamp: row.bucket_start,
      tempf: applySensorOffset(
        Number(row.avg_num),
        typeof row.device_sensors.offset_num === "number"
          ? row.device_sensors.offset_num
          : 0,
      ),
      humidity: 0,
      probeLabel,
    });
  }
  return points;
}

export async function fetchHouseholdChartData(
  householdId: string,
  days = 7,
): Promise<{ points: ChartPoint[]; error: string | null }> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();

  const { rows, error } = await fetchAllRawSensorRows(householdId, { from: sinceIso }, {
    ascending: true,
  });

  if (error) {
    return { points: [], error };
  }

  const readings = pairTempHumidityRows(
    rows.filter((row) => {
      const kind = row.device_sensors?.kind;
      return kind === "temperature" || kind === "humidity";
    }),
    householdId,
  );

  let points: ChartPoint[] = readings.map((row) => ({
    timestamp: row.timestamp,
    tempf: Number(row.tempf),
    humidity: Number(row.humidity),
    probeLabel: row.probe_label?.trim() || row.probe_key || "Probe",
  }));

  if (points.length < 10) {
    const rollups = await fetchRollupChartPointsForHousehold(householdId, sinceIso);
    if (rollups.length > 0) {
      const byTs = new Map(points.map((p) => [p.timestamp, p]));
      for (const point of rollups) {
        if (!byTs.has(point.timestamp)) byTs.set(point.timestamp, point);
      }
      points = [...byTs.values()].sort(
        (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
      );
    }
  }

  return { points, error: null };
}

/** Chart points from the same calendar window one year earlier (rollups + raw). */
export async function fetchGarageTempChartDataPriorYear(
  userId: string,
  days = 30,
  filters: HistoryFilters = {},
): Promise<{ points: ChartPoint[]; error: string | null }> {
  const end = new Date();
  end.setFullYear(end.getFullYear() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const priorFilters: HistoryFilters = {
    ...filters,
    from: start.toISOString(),
    to: end.toISOString(),
  };

  const fromSensor = await fetchPairedFromSensorReadings(userId, priorFilters, {
    ascending: true,
    limit: CHART_DISPLAY_CAP,
  });
  if (fromSensor.error) {
    return { points: [], error: fromSensor.error };
  }

  let points: ChartPoint[] = fromSensor.readings.map((row) => ({
    timestamp: row.timestamp,
    tempf: Number(row.tempf),
    humidity: Number(row.humidity),
    probeLabel: row.probe_label?.trim() || row.probe_key || "Probe",
  }));

  const householdId = await getUserHouseholdId(userId);
  const rollups = householdId
    ? await fetchRollupChartPointsForHousehold(
        householdId,
        start.toISOString(),
        priorFilters,
      )
    : [];
  const endMs = end.getTime();
  const filteredRollups = rollups.filter((p) => Date.parse(p.timestamp) <= endMs);
  if (filteredRollups.length > 0) {
    const byTs = new Map(points.map((p) => [p.timestamp, p]));
    for (const point of filteredRollups) {
      if (!byTs.has(point.timestamp)) byTs.set(point.timestamp, point);
    }
    points = [...byTs.values()].sort(
      (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
    );
  }

  return { points, error: null };
}

/** Earliest stored sensor reading for empty-state copy on YoY comparisons. */
export async function fetchEarliestSensorReadingAt(
  householdId: string,
): Promise<string | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("sensor_readings")
    .select("recorded_at")
    .eq("household_id", householdId)
    .order("recorded_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data?.recorded_at) return null;
  return data.recorded_at;
}

export async function fetchHistoryFilterOptions(userId: string): Promise<{
  feeds: string[];
  probes: { key: string; label: string }[];
  error: string | null;
}> {
  const householdId = await getUserHouseholdId(userId);
  if (!householdId) {
    return { feeds: [], probes: [], error: null };
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("devices")
    .select("name, device_sensors(key, label, kind)")
    .eq("household_id", householdId)
    .order("sort_order", { ascending: true });

  if (error) {
    return { feeds: [], probes: [], error: error.message };
  }

  const feeds = [
    ...new Set(
      (data ?? [])
        .map((device) => device.name?.trim())
        .filter((name): name is string => Boolean(name)),
    ),
  ];
  const probeMap = new Map<string, string>();

  for (const device of data ?? []) {
    for (const sensor of device.device_sensors ?? []) {
      if (sensor.kind !== "temperature") continue;
      const key = sensor.key?.trim();
      if (!key || probeMap.has(key)) continue;
      probeMap.set(key, sensor.label.replace(/ humidity$/i, "").trim() || key);
    }
  }

  return {
    feeds,
    probes: [...probeMap.entries()].map(([key, label]) => ({ key, label })),
    error: null,
  };
}

export function buildGarageTempsCsv(readings: GarageTempReading[]): string {
  const headers = [
    "recorded_at",
    "feed_name",
    "probe_label",
    "probe_key",
    "temperature_f",
    "temperature_c",
    "humidity_percent",
  ];

  const rows = readings.map((reading) =>
    [
      new Date(reading.timestamp).toISOString(),
      getReadingFeedName(reading),
      getReadingProbeLabel(reading),
      reading.probe_key?.trim() || "",
      Number(reading.tempf).toFixed(1),
      Number(reading.tempc).toFixed(1),
      Number(reading.humidity).toFixed(1),
    ]
      .map(escapeCsvField)
      .join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}
