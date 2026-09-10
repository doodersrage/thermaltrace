import type { APIRoute } from "astro";
import { getAuthFromCookies } from "../../../lib/auth";
import { getOrCreateHouseholdForUser, getUserHouseholdRole } from "../../../lib/households";
import { getAlertSettingsForUser } from "../../../lib/notify";
import { listHouseholdDevices } from "../../../lib/devices";
import { fetchLatestSensorValues } from "../../../lib/sensorReadings";
import { formatRelativeAge } from "../../../lib/relativeTime";
import { summarizeStaleSensors } from "../../../lib/sensorFreshness";
import { computeGarageRiskStatus } from "../../../lib/garageRiskStatus";
import { countUnacknowledgedAlerts } from "../../../lib/alertEvents";
import { isSnoozeActive, isVacationActive } from "../../../lib/alertSnooze";

export const GET: APIRoute = async ({ cookies }) => {
  const { session, user } = await getAuthFromCookies(cookies);
  if (!session || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const household = await getOrCreateHouseholdForUser(user.id, user.email);
  const householdId = household.householdId;
  const [devicesResult, latest, alertSettings, unacked, role] = await Promise.all([
    householdId
      ? listHouseholdDevices(householdId)
      : Promise.resolve({ devices: [] as Awaited<ReturnType<typeof listHouseholdDevices>>["devices"] }),
    householdId ? fetchLatestSensorValues(householdId) : Promise.resolve([]),
    getAlertSettingsForUser(user.id, user.user_metadata as Record<string, unknown>),
    countUnacknowledgedAlerts(user.id),
    householdId ? getUserHouseholdRole(user.id, householdId) : Promise.resolve(null),
  ]);

  const devices = devicesResult.devices;
  const newestReading =
    latest
      .map((row) => row.recorded_at)
      .filter(Boolean)
      .sort((a, b) => Date.parse(b!) - Date.parse(a!))[0] ?? null;
  const lastAge = formatRelativeAge(newestReading);
  const staleSummary = summarizeStaleSensors(latest, devices);
  const coldestProbeTempF = (() => {
    const temps = latest
      .filter((row) => row.sensor.kind === "temperature" && row.value_num != null)
      .map((row) => row.value_num as number);
    return temps.length > 0 ? Math.min(...temps) : null;
  })();
  const wetFloodCount = latest.filter(
    (row) => row.sensor.kind === "flood" && row.value_bool === true,
  ).length;
  const sensorCount = devices.reduce((sum, device) => sum + device.sensors.length, 0);
  const liveSensorCount = latest.filter(
    (row) => row.recorded_at && !formatRelativeAge(row.recorded_at).stale,
  ).length;
  const coldestMarginF =
    coldestProbeTempF != null
      ? coldestProbeTempF - alertSettings.freezeThresholdF
      : null;

  const risk = computeGarageRiskStatus({
    hasDevices: devices.length > 0,
    hasLiveReading: latest.length > 0,
    coldestProbeTempF,
    freezeThresholdF: alertSettings.freezeThresholdF,
    staleSensorCount: staleSummary.total,
    nightsRiskCount: 0,
    alertsEnabled: alertSettings.enabled,
    hasEmailAlerts: alertSettings.channelEmail,
    outdoorTempF: null,
    showColdSnapChecklist: false,
    hoursUntilFreeze: null,
    hitsAtLabel: null,
    wetFloodCount,
  });

  const body = {
    at: new Date().toISOString(),
    householdId,
    role,
    risk: risk.level,
    riskTitle: risk.title,
    riskDetail: risk.detail,
    lastReadingAt: newestReading,
    lastReadingAge: lastAge.label,
    lastReadingLagging: lastAge.lagging,
    staleSensors: staleSummary.total,
    sensorCount,
    liveSensorCount,
    unackedAlerts: unacked,
    coldestProbeTempF,
    coldestMarginF,
    freezeThresholdF: alertSettings.freezeThresholdF,
    alertsEnabled: alertSettings.enabled,
    snoozeActive: isSnoozeActive(alertSettings),
    vacationActive: isVacationActive(alertSettings),
    snoozeUntil: alertSettings.snoozeUntil,
    vacationUntil: alertSettings.vacationUntil,
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=30",
    },
  });
};
