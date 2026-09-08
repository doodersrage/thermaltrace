import { createServerClient } from "./supabase";
import type { ChartPoint } from "./garageTempsHistory";
import { getUserEntitlements } from "./entitlements";
import { listConnectionsForHousehold } from "./thermostatConnections";
import { fetchThermostatContextWithStatus } from "./thermostatCorrelation";
import type { ThermostatSnapshot } from "./thermostatCorrelation";
import { listHouseholdIdsForCron } from "./households";

/**
 * Thermostat fetch failures that should not fail collect-history / page ops.
 * User-owned OAuth (reconnect) and upstream blips are soft; platform misconfig stays hard.
 */
export function isTransientThermostatCollectError(error: string | null): boolean {
  return (
    error === "network" ||
    error === "api_auth" ||
    error === "no_token" ||
    error === "api_error"
  );
}

export type ThermostatSnapshotRow = {
  household_id: string;
  provider: "nest" | "ecobee";
  recorded_at: string;
  ambient_temp_f: number | null;
  heat_setpoint_f: number | null;
  cool_setpoint_f: number | null;
  hvac_mode: string | null;
  external_device_id: string | null;
};

export async function insertThermostatSnapshot(
  row: ThermostatSnapshotRow,
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { error } = await supabase.from("thermostat_snapshots").insert(row);
  return { error: error?.message ?? null };
}

export async function collectThermostatSnapshotsForHousehold(
  householdId: string,
  ownerUserId: string,
): Promise<{ saved: boolean; error: string | null }> {
  const entitlements = await getUserEntitlements(ownerUserId);
  if (!entitlements.canUseThermostatIntegration) {
    return { saved: false, error: null };
  }

  const connections = await listConnectionsForHousehold(householdId);
  const connection = connections[0];
  if (!connection) {
    return { saved: false, error: null };
  }

  const result = await fetchThermostatContextWithStatus(
    householdId,
    connection.provider,
  );

  const snapshot = result.snapshot;
  if (!snapshot) {
    return { saved: false, error: result.fetchError ?? "snapshot_unavailable" };
  }

  const recordedAt = new Date().toISOString();
  const insert = await insertThermostatSnapshot({
    household_id: householdId,
    provider: connection.provider,
    recorded_at: recordedAt,
    ambient_temp_f: snapshot.ambientTempF,
    heat_setpoint_f: snapshot.heatSetpointF,
    cool_setpoint_f: null,
    hvac_mode: snapshot.hvacMode,
    external_device_id: connection.externalDeviceId,
  });

  return { saved: !insert.error, error: insert.error };
}

export async function collectThermostatSnapshotsForAllHouseholds(): Promise<{
  householdsProcessed: number;
  snapshotsSaved: number;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  let householdsProcessed = 0;
  let snapshotsSaved = 0;

  const households = await listHouseholdIdsForCron();
  for (const { householdId, ownerUserId } of households) {
    try {
      const result = await collectThermostatSnapshotsForHousehold(
        householdId,
        ownerUserId,
      );
      if (result.error && result.error !== "snapshot_unavailable") {
        if (isTransientThermostatCollectError(result.error)) {
          const message = `${householdId}: ${result.error}`;
          warnings.push(message);
          console.warn(`thermostat snapshot soft-skip: ${message}`);
        } else {
          errors.push(`${householdId}: ${result.error}`);
        }
      }
      if (result.saved) snapshotsSaved += 1;
      householdsProcessed += 1;
    } catch (e) {
      errors.push(
        `${householdId}: ${e instanceof Error ? e.message : "Unknown error"}`,
      );
    }
  }

  return { householdsProcessed, snapshotsSaved, errors, warnings };
}

function chartPointFromSnapshot(
  recordedAt: string,
  ambientTempF: number | null,
): ChartPoint | null {
  if (ambientTempF == null || !Number.isFinite(ambientTempF)) return null;
  return {
    timestamp: recordedAt,
    tempf: ambientTempF,
    humidity: 0,
    probeLabel: "House",
  };
}

export async function fetchThermostatSnapshotChartPoints(
  householdId: string,
  days: number,
  filters: { from?: string; to?: string } = {},
): Promise<ChartPoint[]> {
  const supabase = createServerClient();
  const defaultFrom = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const from = filters.from ?? defaultFrom;

  let query = supabase
    .from("thermostat_snapshots")
    .select("recorded_at, ambient_temp_f")
    .eq("household_id", householdId)
    .gte("recorded_at", from)
    .order("recorded_at", { ascending: true });

  if (filters.to) {
    query = query.lte("recorded_at", filters.to);
  }

  const { data, error } = await query;
  if (error) {
    console.error("fetchThermostatSnapshotChartPoints failed:", error.message);
    return [];
  }

  return (data ?? [])
    .map((row) =>
      chartPointFromSnapshot(row.recorded_at, row.ambient_temp_f),
    )
    .filter((point): point is ChartPoint => point != null);
}

export function latestThermostatSnapshotToDisplay(
  snapshot: ThermostatSnapshot | null,
): { ambientTempF: number; label: string } | null {
  if (snapshot?.ambientTempF == null || !Number.isFinite(snapshot.ambientTempF)) {
    return null;
  }
  return { ambientTempF: snapshot.ambientTempF, label: "House" };
}
