import { useCallback, useEffect, useMemo, useState } from "preact/hooks";
import { formatLiveTempDetail, formatLiveTempF } from "../lib/temperatureFormat";
import { formatRelativeAge } from "../lib/relativeTime";
import { freshnessDetailForSource } from "../lib/sensorFreshness";
import { formatBoolSensorValue, SENSOR_KIND_LABELS } from "../lib/sensorKinds";
import {
  LIVE_READINGS_EVENT,
  LIVE_REFRESH_EVENT,
  newestLiveReadingAt,
} from "../lib/liveDashboardChrome";

type ProbeReading = {
  key: string;
  label: string;
  data: { f: number; c: number; h: number } | null;
};

type FeedGroup = {
  feedId: string;
  feedName: string;
  enabled: boolean;
  error?: string;
  probes: ProbeReading[];
};

type LiveSensor = {
  deviceId: string;
  deviceName: string;
  deviceSource?: "push" | "pull_url" | null;
  space?: string | null;
  key: string;
  label: string;
  kind: string;
  unit: string | null;
  value_num: number | null;
  value_bool: boolean | null;
  value_text: string | null;
  recorded_at: string | null;
  temp?: { f: number; c: number; h: number } | null;
};

interface Props {
  intervalMs?: number;
}

function formatSensorValue(sensor: LiveSensor): { primary: string; detail: string } {
  switch (sensor.kind) {
    case "temperature":
      if (sensor.temp) {
        return {
          primary: `${formatLiveTempF(sensor.temp.f)}`,
          detail: formatLiveTempDetail(sensor.temp.c, sensor.temp.h),
        };
      }
      if (sensor.value_num != null) {
        return {
          primary: `${sensor.value_num.toFixed(1)}${sensor.unit ? ` ${sensor.unit}` : "°F"}`,
          detail: sensor.deviceName,
        };
      }
      break;
    case "humidity":
      if (sensor.value_num != null) {
        return {
          primary: `${sensor.value_num.toFixed(0)}%`,
          detail: "Relative humidity",
        };
      }
      break;
    case "co2":
      if (sensor.value_num != null) {
        return {
          primary: `${Math.round(sensor.value_num)} ${sensor.unit ?? "ppm"}`,
          detail: "CO₂",
        };
      }
      break;
    case "pressure":
      if (sensor.value_num != null) {
        return {
          primary: `${sensor.value_num.toFixed(1)} ${sensor.unit ?? "hPa"}`,
          detail: "Barometric pressure",
        };
      }
      break;
    case "pm25":
      if (sensor.value_num != null) {
        return {
          primary: `${sensor.value_num.toFixed(1)} ${sensor.unit ?? "µg/m³"}`,
          detail: "Fine particles",
        };
      }
      break;
    case "voc":
      if (sensor.value_num != null) {
        return {
          primary: `${Math.round(sensor.value_num)} ${sensor.unit ?? "ppb"}`,
          detail: "VOCs",
        };
      }
      break;
    case "level":
      if (sensor.value_num != null) {
        return {
          primary: `${sensor.value_num.toFixed(0)}${sensor.unit ? ` ${sensor.unit}` : "%"}`,
          detail: "Sump / tank level",
        };
      }
      break;
    case "energy":
      if (sensor.value_num != null) {
        return {
          primary: `${sensor.value_num.toFixed(0)} ${sensor.unit ?? "W"}`,
          detail: "Power draw",
        };
      }
      break;
    case "door":
    case "power":
    case "flood":
    case "motion":
      return {
        primary:
          sensor.value_bool == null
            ? "—"
            : formatBoolSensorValue(sensor.kind, sensor.value_bool),
        detail: SENSOR_KIND_LABELS[sensor.kind as keyof typeof SENSOR_KIND_LABELS] ?? sensor.kind,
      };
    default:
      if (sensor.value_bool != null) {
        return {
          primary: sensor.value_bool ? "True" : "False",
          detail: sensor.kind,
        };
      }
      if (sensor.value_num != null) {
        return {
          primary: `${sensor.value_num}${sensor.unit ? ` ${sensor.unit}` : ""}`,
          detail: sensor.kind,
        };
      }
      if (sensor.value_text) {
        return { primary: sensor.value_text, detail: sensor.kind };
      }
  }

  return { primary: "—", detail: "No reading" };
}

function isSensorAlert(sensor: LiveSensor): boolean {
  if (sensor.kind === "door" && sensor.value_bool === true) return true;
  if (sensor.kind === "flood" && sensor.value_bool === true) return true;
  if (sensor.kind === "power" && sensor.value_bool === false) return true;
  if (sensor.kind === "motion" && sensor.value_bool === true) return true;
  if (sensor.kind === "co2" && sensor.value_num != null && sensor.value_num >= 1000) {
    return true;
  }
  if (sensor.kind === "pm25" && sensor.value_num != null && sensor.value_num >= 35) {
    return true;
  }
  if (sensor.kind === "voc" && sensor.value_num != null && sensor.value_num >= 400) {
    return true;
  }
  if (sensor.kind === "level" && sensor.value_num != null && sensor.value_num >= 80) {
    return true;
  }
  return false;
}

export default function LiveTempsPanel({ intervalMs = 30000 }: Props) {
  const [groups, setGroups] = useState<FeedGroup[]>([]);
  const [sensors, setSensors] = useState<LiveSensor[]>([]);
  const [spaces, setSpaces] = useState<string[]>([]);
  const [spaceFilter, setSpaceFilter] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(intervalMs / 1000);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [offlineStale, setOfflineStale] = useState(false);

  const loadReadings = useCallback(async (signal?: AbortSignal) => {
    try {
      const qs = spaceFilter
        ? `?space=${encodeURIComponent(spaceFilter)}`
        : "";
      const response = await fetch(`/api/home/readings${qs}`, {
        credentials: "same-origin",
        signal,
      });

      if (signal?.aborted) return;
      if (!response.ok) {
        throw new Error("Unable to refresh readings");
      }

      const payload = (await response.json()) as {
        groups: FeedGroup[];
        sensors?: LiveSensor[];
        spaces?: string[];
        updatedAt: string;
      };

      if (signal?.aborted) return;
      setGroups(payload.groups ?? []);
      setSensors(payload.sensors ?? []);
      if (payload.spaces) setSpaces(payload.spaces);
      setUpdatedAt(payload.updatedAt);
      setOfflineStale(
        response.headers.get("X-ThermalTrace-Stale") === "1" ||
          response.headers.get("X-Garage-Temp-Stale") === "1",
      );
      setError(null);
      setCountdown(intervalMs / 1000);
    } catch (e) {
      if (signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) {
        return;
      }
      setError(e instanceof Error ? e.message : "Refresh failed");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [intervalMs, spaceFilter]);

  useEffect(() => {
    const ac = new AbortController();
    void loadReadings(ac.signal);
    return () => ac.abort();
  }, [loadReadings]);

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource("/api/home/readings/stream");
      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "readings") void loadReadings();
        } catch {
          /* ignore malformed SSE payloads */
        }
      };
      es.onerror = () => {
        /* Browser reconnects; polling remains as backup. Avoid noisy logs. */
      };
    } catch {
      /* SSE unavailable — polling fallback remains */
    }
    return () => es?.close();
  }, [loadReadings]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setCountdown((current) => {
        if (current <= 1) {
          void loadReadings();
          return intervalMs / 1000;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(tick);
  }, [intervalMs, loadReadings]);

  useEffect(() => {
    const onRefresh = () => void loadReadings();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void loadReadings();
    };
    window.addEventListener(LIVE_REFRESH_EVENT, onRefresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener(LIVE_REFRESH_EVENT, onRefresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [loadReadings]);

  useEffect(() => {
    const groupCount = groups.reduce((n, group) => n + (group.probes?.length ?? 0), 0);
    window.dispatchEvent(
      new CustomEvent(LIVE_READINGS_EVENT, {
        detail: {
          lastReadingAt: newestLiveReadingAt(sensors, updatedAt),
          sensorCount: sensors.length + groupCount,
        },
      }),
    );
  }, [sensors, groups, updatedAt]);

  const nonTempSensors = useMemo(
    () => sensors.filter((s) => s.kind !== "temperature" && s.kind !== "humidity"),
    [sensors],
  );

  // Prefer kind-aware climate cards when present; fall back to feed groups
  const temperatureCards = useMemo(() => {
    return sensors.filter((s) => s.kind === "temperature" || s.kind === "humidity");
  }, [sensors]);

  const laggingSensors = useMemo(() => {
    return sensors
      .map((sensor) => {
        if (!sensor.recorded_at) {
          return { sensor, age: formatRelativeAge(null) };
        }
        const age = formatRelativeAge(sensor.recorded_at);
        return age.lagging ? { sensor, age } : null;
      })
      .filter((row): row is { sensor: LiveSensor; age: ReturnType<typeof formatRelativeAge> } =>
        Boolean(row),
      );
  }, [sensors]);

  const hasAnySensors =
    temperatureCards.length > 0 || groups.length > 0 || sensors.length > 0;

  if (loading && groups.length === 0 && sensors.length === 0) {
    return (
      <section class="card animate-slide-in-left">
        <p class="live-refresh-note m-0">Loading live readings…</p>
      </section>
    );
  }

  return (
    <section class="card animate-slide-in-left">
      <h2 class="card-title">Live sensors</h2>
      <p class="card-subtitle">
        Temperature, humidity, and other probes from pull feeds and push devices.
      </p>

      {spaces.length > 0 && (
        <div class="mb-4">
          <label class="form-label" for="space-filter">
            Space
          </label>
          <select
            id="space-filter"
            class="form-input"
            value={spaceFilter}
            onChange={(e) =>
              setSpaceFilter((e.target as HTMLSelectElement).value)
            }
          >
            <option value="">All spaces</option>
            {spaces.map((space) => (
              <option value={space} key={space}>
                {space}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div class="alert-warning mb-4">
          <p class="m-0">{error}</p>
          <button type="button" class="btn-secondary mt-3" onClick={() => void loadReadings()}>
            Retry now
          </button>
        </div>
      )}

      {laggingSensors.length > 0 && (
        <div class="alert-warning mb-4" role="status">
          <p class="m-0 font-medium">
            {laggingSensors.length === 1
              ? `${laggingSensors[0]!.sensor.label} — ${freshnessDetailForSource(
                  laggingSensors[0]!.sensor.recorded_at,
                  laggingSensors[0]!.sensor.deviceSource ?? null,
                )}`
              : `${laggingSensors.length} probes look offline or stale`}
          </p>
          {laggingSensors.length > 1 && (
            <ul class="mb-0 mt-2 pl-5 text-sm">
              {laggingSensors.slice(0, 4).map(({ sensor, age }) => (
                <li key={`${sensor.deviceId}:${sensor.key}`}>
                  {sensor.label} —{" "}
                  {freshnessDetailForSource(sensor.recorded_at, sensor.deviceSource ?? null)}
                </li>
              ))}
            </ul>
          )}
          <p class="mb-0 mt-3 text-sm">
            <a class="text-link" href="/dashboard/devices">Check Devices</a>
            {" · "}
            <a class="text-link" href="/about/debugging-stale-readings">Debug stale readings</a>
          </p>
        </div>
      )}

      {temperatureCards.length > 0 ? (
        <div class="stat-grid mb-6">
          {temperatureCards.map((sensor) => {
            const display = formatSensorValue(sensor);
            const age = sensor.recorded_at
              ? formatRelativeAge(sensor.recorded_at)
              : formatRelativeAge(null);
            const freshnessClass = age.stale
              ? " stat-item-stale"
              : age.lagging
                ? " stat-item-lagging"
                : "";
            return (
              <article
                class={`stat-item${freshnessClass}`}
                key={`${sensor.deviceId}:${sensor.key}:temp`}
              >
                <span class="stat-label">{sensor.label}</span>
                <p class="stat-value">{display.primary}</p>
                <p class="stat-detail">
                  {display.detail}
                  {sensor.deviceName ? ` · ${sensor.deviceName}` : ""}
                </p>
                <p
                  class={`stat-detail m-0${
                    age.lagging ? " text-amber-300" : ""
                  }`}
                >
                  {freshnessDetailForSource(
                    sensor.recorded_at,
                    sensor.deviceSource ?? null,
                  )}
                </p>
              </article>
            );
          })}
        </div>
      ) : groups.length > 0 ? (
        <div class="feed-groups mb-6">
          {groups.map((group) => (
            <section class="feed-group" key={group.feedId}>
              <div class="feed-group-header">
                <h3 class="feed-group-title">{group.feedName}</h3>
                {!group.enabled && <span class="feed-group-badge">Disabled</span>}
              </div>

              {group.error && (
                <div class="alert-warning mb-4">
                  <p class="m-0">{group.error}</p>
                </div>
              )}

              {group.probes.length === 0 ? (
                <p class="stat-detail m-0">No probes assigned to this feed.</p>
              ) : (
                <div class="stat-grid">
                  {group.probes.map((probe) => (
                    <article class="stat-item" key={probe.key}>
                      <span class="stat-label">{probe.label}</span>
                      {probe.data ? (
                        <>
                          <p class="stat-value">{formatLiveTempF(probe.data.f)}</p>
                          <p class="stat-detail">
                            {formatLiveTempDetail(probe.data.c, probe.data.h)}
                          </p>
                        </>
                      ) : (
                        <p class="stat-detail">No reading for key "{probe.key}"</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      ) : !hasAnySensors ? (
        <div class="empty-state">
          <p class="empty-state-title mb-2">No sensors yet</p>
          <p class="mb-4">
            Create a push device or pull feed, then POST a reading. Cards show up here
            within a few seconds.
          </p>
          <div class="empty-state-actions">
            <a class="btn-primary" href="/dashboard/devices?view=setup">
              Open Devices
            </a>
            <a class="btn-secondary" href="/dashboard/alerts?tab=settings#alert-section-essentials">
              Alert essentials
            </a>
            <a class="btn-ghost" href="/about/probe-demo">
              Probe simulator
            </a>
          </div>
        </div>
      ) : null}

      {nonTempSensors.length > 0 && (
        <>
          <h3 class="feed-group-title mb-3">Other sensors</h3>
          <div class="stat-grid">
            {nonTempSensors.map((sensor) => {
              const display = formatSensorValue(sensor);
              const age = sensor.recorded_at
                ? formatRelativeAge(sensor.recorded_at)
                : formatRelativeAge(null);
              const alert = isSensorAlert(sensor);
              const freshnessClass = age.stale
                ? " stat-item-stale"
                : age.lagging
                  ? " stat-item-lagging"
                  : "";
              return (
                <article
                  class={`stat-item${freshnessClass}${alert ? " stat-item-alert" : ""}`}
                  key={`${sensor.deviceId}:${sensor.key}:${sensor.kind}`}
                >
                  <span class="stat-label">{sensor.label}</span>
                  <p class={`stat-value${alert ? " text-[var(--color-danger)]" : ""}`}>
                    {display.primary}
                  </p>
                  <p class="stat-detail">
                    {display.detail} · {sensor.deviceName}
                  </p>
                  <p
                    class={`stat-detail m-0${
                      age.lagging ? " text-amber-300" : ""
                    }`}
                  >
                    {freshnessDetailForSource(
                    sensor.recorded_at,
                    sensor.deviceSource ?? null,
                  )}
                  </p>
                </article>
              );
            })}
          </div>
        </>
      )}

      <p class="live-refresh-note">
        {offlineStale && (
          <span class="text-[var(--color-warning)]">Showing cached readings (offline). </span>
        )}
        {updatedAt
          ? `Updated ${new Date(updatedAt).toLocaleTimeString()}. Next refresh in ${countdown}s.`
          : `Next refresh in ${countdown}s.`}
      </p>
    </section>
  );
}
