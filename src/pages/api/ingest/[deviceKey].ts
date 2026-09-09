import type { APIRoute } from "astro";
import {
  findDeviceByIngestKeyHash,
  touchDeviceLastSeen,
  updateDeviceMeta,
  upsertDeviceSensor,
} from "../../../lib/devices";
import { insertSensorReadings } from "../../../lib/sensorReadings";
import {
  inferSensorKind,
  parseIngestPayload,
} from "../../../lib/ingestPayload";
import { parseTempFeedPayload } from "../../../lib/tempFeedConfig";
import { discoverIngestPayload } from "../../../lib/feedDiscovery";
import {
  ensureDiscoveredPushSensors,
  labelForPushSensorKey,
} from "../../../lib/pushSensorDiscovery";
import {
  checkIngestRateLimit,
  readJsonBodyWithLimit,
} from "../../../lib/ingestLimits";
import { recordIngestStat } from "../../../lib/ingestStats";
import { enrichDeviceMetaHistories } from "../../../lib/rssiHistory";

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const POST: APIRoute = async ({ params, request }) => {
  const headerKey = request.headers.get("X-Ingest-Key")?.trim() ?? "";
  const pathKey = params.deviceKey?.trim() ?? "";
  // Prefer header so bridges need not put secrets in the URL path. Path `_`
  // is a placeholder when the key is header-only.
  const deviceKey =
    headerKey || (pathKey && pathKey !== "_" ? pathKey : "");
  if (!deviceKey) {
    return new Response(JSON.stringify({ error: "Missing device key" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const keyHash = await sha256Hex(deviceKey);
  const rate = checkIngestRateLimit(keyHash);
  if (!rate.ok) {
    return new Response(JSON.stringify({ error: rate.error }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        ...(rate.retryAfterSec
          ? { "Retry-After": String(rate.retryAfterSec) }
          : {}),
      },
    });
  }

  const device = await findDeviceByIngestKeyHash(keyHash);

  if (!device) {
    return new Response(JSON.stringify({ error: "Invalid device key" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const finish = async (
    response: Response,
    success: boolean,
  ): Promise<Response> => {
    try {
      await recordIngestStat(device.id, success);
    } catch (statError) {
      console.error("Ingest stat failed:", statError);
    }
    return response;
  };

  const body = await readJsonBodyWithLimit(request);
  if (!body.ok) {
    return finish(
      new Response(JSON.stringify({ error: body.error }), {
        status: body.status,
        headers: { "Content-Type": "application/json" },
      }),
      false,
    );
  }

  const payload = body.payload;
  const discovered = discoverIngestPayload(payload);
  const sensorSync = await ensureDiscoveredPushSensors(
    device.id,
    discovered,
    device.sensors,
  );
  if (sensorSync.error) {
    console.error("Push sensor discovery failed:", sensorSync.error);
  }

  const { tempProbes, typed } = parseIngestPayload(payload);
  const recordedAt = new Date().toISOString();
  const rows = [];

  // Classic Arduino temp JSON
  const classic =
    Object.keys(tempProbes).length > 0
      ? tempProbes
      : (() => {
          try {
            return parseTempFeedPayload(payload);
          } catch {
            return {};
          }
        })();

  for (const [key, reading] of Object.entries(classic)) {
    const tempLabel =
      labelForPushSensorKey(discovered, key, "temperature") ?? `Probe ${key}`;
    const humidityLabel =
      labelForPushSensorKey(discovered, key, "humidity") ?? `Probe ${key} humidity`;
    const temp = await upsertDeviceSensor(
      device.id,
      key,
      tempLabel,
      "temperature",
      "F",
    );
    const humidity = await upsertDeviceSensor(
      device.id,
      key,
      humidityLabel,
      "humidity",
      "%",
    );

    if (temp.sensor) {
      rows.push({
        sensor_id: temp.sensor.id,
        household_id: device.household_id,
        recorded_at: recordedAt,
        value_num: reading.f,
        meta: { tempc: reading.c, tempf: reading.f },
      });
    }
    if (humidity.sensor) {
      rows.push({
        sensor_id: humidity.sensor.id,
        household_id: device.household_id,
        recorded_at: recordedAt,
        value_num: reading.h,
        meta: { humidity: reading.h },
      });
    }
  }

  for (const item of typed) {
    const kind = inferSensorKind(item.key, item);
    const label =
      item.label ?? labelForPushSensorKey(discovered, item.key, kind) ?? item.key;
    const sensor = await upsertDeviceSensor(
      device.id,
      item.key,
      label,
      kind,
      item.unit ?? null,
    );
    if (!sensor.sensor) continue;

    rows.push({
      sensor_id: sensor.sensor.id,
      household_id: device.household_id,
      recorded_at: recordedAt,
      value_num: item.value ?? null,
      value_bool: item.bool ?? null,
      value_text: item.text ?? null,
      meta: {},
    });
  }

  if (rows.length === 0) {
    return finish(
      new Response(JSON.stringify({ error: "No sensor values found" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
      false,
    );
  }

  const { error } = await insertSensorReadings(rows);
  if (error) {
    return finish(
      new Response(JSON.stringify({ error }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
      false,
    );
  }

  const metaPatch: Record<string, unknown> = {};
  const battery = Number(
    (payload as Record<string, unknown>).battery ??
      (payload as Record<string, unknown>).battery_pct,
  );
  const rssi = Number((payload as Record<string, unknown>).rssi);
  if (Number.isFinite(battery)) metaPatch.battery_pct = battery;
  if (Number.isFinite(rssi)) metaPatch.rssi = rssi;

  if (Object.keys(metaPatch).length > 0) {
    await updateDeviceMeta(
      device.id,
      enrichDeviceMetaHistories(device.meta, metaPatch, recordedAt),
    );
  } else {
    await touchDeviceLastSeen(device.id);
  }

  try {
    const { listHouseholdMembers } = await import("../../../lib/households");
    const { getAlertSettingsForUser } = await import("../../../lib/notify");
    const { sendReadingWebhook } = await import("../../../lib/readingWebhook");
    const { createAdminClient } = await import("../../../lib/supabase");
    const members = await listHouseholdMembers(device.household_id);
    const admin = createAdminClient();
    for (const member of members.members) {
      const { data } = await admin.auth.admin.getUserById(member.user_id);
      const settings = await getAlertSettingsForUser(
        member.user_id,
        data.user?.user_metadata as Record<string, unknown> | undefined,
      );
      if (settings.readingWebhookUrl) {
        await sendReadingWebhook(member.user_id, settings, {
          device_id: device.id,
          device_name: device.name,
          household_id: device.household_id,
          recorded_at: recordedAt,
          reading_count: rows.length,
          battery_pct: metaPatch.battery_pct ?? null,
          rssi: metaPatch.rssi ?? null,
        });
      }
    }
  } catch (webhookError) {
    console.error("Reading webhook failed:", webhookError);
  }

  // Best-effort immediate alerts (cooldowns still apply)
  try {
    const { listHouseholdMembers } = await import("../../../lib/households");
    const { listHouseholdDevices } = await import("../../../lib/devices");
    const {
      getAlertSettingsForUser,
    } = await import("../../../lib/notify");
    const {
      sendThresholdAlertsIfNeeded,
      sendFloodAlertsIfNeeded,
      maybeSendRuleAlerts,
      buildAlertReadingsFromLatestSensors,
      buildFloodReadingsFromLatestSensors,
    } = await import("../../../lib/alertNotifications");
    const { fetchLatestSensorValues } = await import("../../../lib/sensorReadings");
    const { createAdminClient } = await import("../../../lib/supabase");

    const members = await listHouseholdMembers(device.household_id);
    const devices = await listHouseholdDevices(device.household_id);
    const latest = await fetchLatestSensorValues(device.household_id);
    const readings = buildAlertReadingsFromLatestSensors(latest);
    const floodReadings = buildFloodReadingsFromLatestSensors(latest);
    const admin = createAdminClient();

    for (const member of members.members) {
      const { data } = await admin.auth.admin.getUserById(member.user_id);
      const settings = await getAlertSettingsForUser(
        member.user_id,
        data.user?.user_metadata as Record<string, unknown> | undefined,
      );
      await sendThresholdAlertsIfNeeded(
        member.user_id,
        data.user?.email,
        settings,
        readings,
        device.household_id,
      );
      await sendFloodAlertsIfNeeded(
        member.user_id,
        data.user?.email,
        settings,
        floodReadings,
      );
      await maybeSendRuleAlerts(
        member.user_id,
        data.user?.email,
        devices.devices,
        settings,
        readings,
        device.household_id,
      );
    }
  } catch (alertError) {
    console.error("Ingest alert evaluation failed:", alertError);
  }

  return finish(
    new Response(
      JSON.stringify({
        ok: true,
        readings: rows.length,
        sensors_created: sensorSync.created,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    ),
    true,
  );
};
