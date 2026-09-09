import type {
  TempFeedConfig,
  TempFeedResult,
  TempProbeConfig,
  TempReading,
} from "./tempFeedConfig";
import {
  getDefaultTempFeeds,
  getDefaultTempProbes,
  parseFeedDeviceMeta,
  parseTempFeedPayload,
} from "./tempFeedConfig";
import { maybeSendThresholdAlerts } from "./alertNotifications";
import {
  buildReadingRowsFromTempResults,
  insertSensorReadings,
} from "./sensorReadings";
import {
  ensureDefaultPullDevice,
  getUserDevicesAsTempConfig,
  touchDeviceLastSeen,
  updateDeviceMeta,
  type DeviceWithSensors,
} from "./devices";
import { enrichDeviceMetaHistories } from "./rssiHistory";

export type FetchTempsOptions = {
  feeds?: TempFeedConfig[];
  probes?: TempProbeConfig[];
  saveToDatabase?: boolean;
  userId?: string | null;
  userEmail?: string | null;
  userMetadata?: Record<string, unknown>;
  sendAlerts?: boolean;
  householdId?: string | null;
  devices?: DeviceWithSensors[];
};

export async function fetchTempFeed(feed: TempFeedConfig): Promise<TempFeedResult> {
  try {
    const response = await fetch(feed.url, {
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`Temperature feed request failed (${response.status})`);
    }

    const payload = await response.json();
    const probes = parseTempFeedPayload(payload, feed.jsonRoot);
    const deviceMeta = parseFeedDeviceMeta(payload);

    return {
      id: feed.id,
      name: feed.name,
      url: feed.url,
      probes,
      deviceMeta,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown feed error";
    console.error(`Failed to fetch temperature feed ${feed.id}:`, message);

    return {
      id: feed.id,
      name: feed.name,
      url: feed.url,
      probes: {},
      error: message,
    };
  }
}

export async function fetchTemps(
  options: FetchTempsOptions = {},
): Promise<TempFeedResult[]> {
  let feeds = options.feeds;
  let probes = options.probes;
  let devices = options.devices;
  let householdId = options.householdId;

  if (options.userId && (!feeds || !probes || !devices || !householdId)) {
    const config = await getUserDevicesAsTempConfig(options.userId, options.userEmail);
    feeds = feeds ?? config.feeds;
    probes = probes ?? config.probes;
    devices = devices ?? config.devices;
    householdId = householdId ?? config.householdId;
  }

  // Anonymous / no user: ensure we still have defaults
  if (!options.userId) {
    feeds = feeds ?? getDefaultTempFeeds();
    probes = probes ?? getDefaultTempProbes();
  } else if ((!devices || devices.length === 0) && options.userId) {
    const ensured = await ensureDefaultPullDevice(options.userId, options.userEmail);
    devices = ensured.devices;
    householdId = ensured.householdId || householdId;
    if (!feeds?.length) {
      const mapped = await getUserDevicesAsTempConfig(options.userId, options.userEmail);
      feeds = mapped.feeds;
      probes = mapped.probes;
      devices = mapped.devices;
      householdId = mapped.householdId;
    }
  }

  feeds = (feeds ?? getDefaultTempFeeds()).filter((feed) => feed.enabled);
  probes = probes ?? getDefaultTempProbes();
  const results = await Promise.all(feeds.map((feed) => fetchTempFeed(feed)));

  if (options.saveToDatabase !== false && options.userId) {
    const visibleProbes = probes.filter((probe) => probe.visible);

    if (householdId && devices && devices.length > 0) {
      const rows = buildReadingRowsFromTempResults(
        householdId,
        devices,
        results,
        visibleProbes,
      );
      const { error } = await insertSensorReadings(rows);
      if (error) {
        console.error("Failed to save sensor readings:", error);
      }

      for (const result of results) {
        if (!result.error) {
          await touchDeviceLastSeen(result.id);
          if (result.deviceMeta && Object.keys(result.deviceMeta).length > 0) {
            const existing = devices.find((device) => device.id === result.id);
            await updateDeviceMeta(
              result.id,
              enrichDeviceMetaHistories(existing?.meta, result.deviceMeta),
            );
          }
        }
      }
    }

    if (options.sendAlerts !== false) {
      await maybeSendThresholdAlerts(
        options.userId,
        options.userEmail,
        options.userMetadata,
        feeds,
        visibleProbes,
        results,
        householdId ?? undefined,
        devices,
      );
    }
  }

  return results;
}

export async function fetchLegacyTempPayload(
  options: FetchTempsOptions = {},
): Promise<{ temp: Record<string, TempReading> }> {
  const feeds = options.feeds ?? getDefaultTempFeeds();
  const primaryFeed = feeds.find((feed) => feed.enabled) ?? feeds[0];
  const [result] = await fetchTemps({
    ...options,
    feeds: primaryFeed ? [primaryFeed] : [],
  });

  return {
    temp: result?.probes ?? {},
  };
}

export { ensureDefaultPullDevice };
