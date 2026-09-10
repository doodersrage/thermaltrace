import { createServerClient } from "./supabase";
import type { Json } from "../types/supabase";
import type { DeviceSensor, DeviceWithSensors } from "./devices";
import type { TempFeedResult, TempProbeConfig } from "./tempFeedConfig";
import { applySensorOffset } from "./sensorCalibration";
export type { TypedSensorValue } from "./ingestPayload";
export { parseIngestPayload, inferSensorKind } from "./ingestPayload";

export type SensorReadingInsert = {
  sensor_id: string;
  household_id: string;
  recorded_at?: string;
  value_num?: number | null;
  value_bool?: boolean | null;
  value_text?: string | null;
  meta?: Record<string, unknown>;
};

export type GarageTempCompat = {
  tempc: number;
  tempf: number;
  humidity: number;
  timestamp: string;
  feed_name?: string | null;
  probe_label?: string | null;
  probe_key?: string | null;
  user_id?: string | null;
};

export async function insertSensorReadings(
  rows: SensorReadingInsert[],
): Promise<{ error: string | null }> {
  if (rows.length === 0) return { error: null };

  const supabase = createServerClient();
  const { error } = await supabase.from("sensor_readings").insert(
    rows.map((row) => ({
      sensor_id: row.sensor_id,
      household_id: row.household_id,
      recorded_at: row.recorded_at ?? new Date().toISOString(),
      value_num: row.value_num ?? null,
      value_bool: row.value_bool ?? null,
      value_text: row.value_text ?? null,
      meta: (row.meta ?? {}) as Json,
    })),
  );

  return { error: error?.message ?? null };
}

export function buildReadingRowsFromTempResults(
  householdId: string,
  devices: DeviceWithSensors[],
  results: TempFeedResult[],
  probes: TempProbeConfig[],
): SensorReadingInsert[] {
  const recordedAt = new Date().toISOString();
  const rows: SensorReadingInsert[] = [];
  const devicesById = new Map(devices.map((d) => [d.id, d]));

  for (const probe of probes.filter((p) => p.visible)) {
    const device = devicesById.get(probe.feedId);
    const result = results.find((r) => r.id === probe.feedId);
    if (!device || !result || result.error) continue;

    const reading = result.probes[probe.key];
    if (!reading) continue;

    const tempSensor = device.sensors.find(
      (s) => s.key === probe.key && s.kind === "temperature",
    );
    const humiditySensor = device.sensors.find(
      (s) => s.key === probe.key && s.kind === "humidity",
    );

    if (tempSensor) {
      rows.push({
        sensor_id: tempSensor.id,
        household_id: householdId,
        recorded_at: recordedAt,
        value_num: reading.f,
        meta: { tempc: reading.c, tempf: reading.f },
      });
    }

    if (humiditySensor) {
      rows.push({
        sensor_id: humiditySensor.id,
        household_id: householdId,
        recorded_at: recordedAt,
        value_num: reading.h,
        meta: { humidity: reading.h },
      });
    }
  }

  return rows;
}

export async function getRecentNumericReadings(
  sensorId: string,
  sinceIso: string,
): Promise<number[]> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("sensor_readings")
    .select("value_num")
    .eq("sensor_id", sensorId)
    .gte("recorded_at", sinceIso)
    .order("recorded_at", { ascending: true });

  return (data ?? [])
    .map((row) => row.value_num)
    .filter((v): v is number => typeof v === "number");
}

export async function getRecentNumericReadingSamples(
  sensorId: string,
  sinceIso: string,
): Promise<Array<{ at: string; tempF: number }>> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("sensor_readings")
    .select("value_num, recorded_at")
    .eq("sensor_id", sensorId)
    .gte("recorded_at", sinceIso)
    .order("recorded_at", { ascending: true });

  return (data ?? [])
    .filter((row) => typeof row.value_num === "number" && typeof row.recorded_at === "string")
    .map((row) => ({
      at: row.recorded_at as string,
      tempF: row.value_num as number,
    }));
}

export async function fetchRecentBoolReadings(
  sensorId: string,
  sinceIso: string,
): Promise<Array<{ value: boolean; recordedAt: string }>> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("sensor_readings")
    .select("value_bool, recorded_at")
    .eq("sensor_id", sensorId)
    .gte("recorded_at", sinceIso)
    .not("value_bool", "is", null)
    .order("recorded_at", { ascending: true });

  return (data ?? [])
    .filter((row) => typeof row.value_bool === "boolean")
    .map((row) => ({
      value: row.value_bool as boolean,
      recordedAt: row.recorded_at as string,
    }));
}

export type LatestSensorRow = {
  sensor: DeviceSensor;
  deviceName: string;
  deviceSpace?: string | null;
  value_num: number | null;
  value_bool: boolean | null;
  value_text: string | null;
  recorded_at: string;
};

export async function fetchLatestSensorValues(
  householdId: string,
): Promise<LatestSensorRow[]> {
  const supabase = createServerClient();
  const { data: devices } = await supabase
    .from("devices")
    .select("id, name, space")
    .eq("household_id", householdId)
    .eq("enabled", true);

  if (!devices || devices.length === 0) return [];

  const { data: sensors } = await supabase
    .from("device_sensors")
    .select("id, device_id, key, label, kind, unit, visible, sort_order, offset_num")
    .in(
      "device_id",
      devices.map((d) => d.id),
    )
    .eq("visible", true);

  if (!sensors || sensors.length === 0) return [];

  const deviceName = new Map(devices.map((d) => [d.id, d.name]));
  const deviceSpace = new Map(
    devices.map((d) => [d.id, typeof d.space === "string" ? d.space : null]),
  );

  // One round-trip per sensor in parallel (was sequential N+1). Index:
  // sensor_readings_sensor_recorded_idx (sensor_id, recorded_at desc).
  const readingRows = await Promise.all(
    sensors.map(async (sensor) => {
      const { data: reading } = await supabase
        .from("sensor_readings")
        .select("value_num, value_bool, value_text, recorded_at")
        .eq("sensor_id", sensor.id)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { sensor, reading };
    }),
  );

  const results: LatestSensorRow[] = [];
  for (const { sensor, reading } of readingRows) {
    if (!reading) continue;

    const offset =
      typeof (sensor as { offset_num?: number }).offset_num === "number"
        ? (sensor as { offset_num: number }).offset_num
        : 0;
    const valueNum =
      reading.value_num != null &&
      (sensor.kind === "temperature" || sensor.kind === "humidity")
        ? applySensorOffset(reading.value_num, offset)
        : reading.value_num;

    results.push({
      sensor: sensor as DeviceSensor,
      deviceName: deviceName.get(sensor.device_id) ?? "Device",
      deviceSpace: deviceSpace.get(sensor.device_id) ?? null,
      value_num: valueNum,
      value_bool: reading.value_bool,
      value_text: reading.value_text,
      recorded_at: reading.recorded_at,
    });
  }

  return results;
}
