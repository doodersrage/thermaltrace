import { useCallback, useEffect, useState } from "preact/hooks";
import { formatLiveTempDetail, formatLiveTempF } from "../lib/temperatureFormat";

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

interface Props {
  intervalMs?: number;
}

export default function DemoTempsPanel({ intervalMs = 90000 }: Props) {
  const [groups, setGroups] = useState<FeedGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(intervalMs / 1000);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/home/demo-temps", {
        credentials: "same-origin",
        signal,
      });
      const payload = (await response.json()) as {
        error?: string;
        groups?: FeedGroup[];
        updatedAt?: string;
      };
      if (signal?.aborted) return;
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to load probe temperatures");
      }
      setGroups(payload.groups ?? []);
      setUpdatedAt(payload.updatedAt ?? null);
      setError(null);
      setCountdown(intervalMs / 1000);
    } catch (e) {
      if (signal?.aborted || (e instanceof DOMException && e.name === "AbortError")) {
        return;
      }
      setError(e instanceof Error ? e.message : "Unable to load probe temperatures");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [intervalMs]);

  useEffect(() => {
    const ac = new AbortController();
    void load(ac.signal);
    return () => ac.abort();
  }, [load]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      setCountdown((current) => {
        if (current <= 1) {
          void load();
          return intervalMs / 1000;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [intervalMs, load]);

  if (loading && groups.length === 0) {
    return (
      <section class="card animate-slide-in-left">
        <div class="loading-state">
          <p class="m-0">Loading probe temperatures…</p>
        </div>
      </section>
    );
  }

  return (
    <section class="card animate-slide-in-left">
      <h2 class="card-title">Live demo readings</h2>
      <p class="card-subtitle">Public probe temperatures — free account (no card) to connect your own sensors.</p>

      {error && (
        <div class="alert-warning mb-4">
          <p class="m-0">{error}</p>
          <button type="button" class="btn-secondary mt-3" onClick={() => void load()}>
            Retry now
          </button>
        </div>
      )}

      {!error && groups.length === 0 ? (
        <div class="empty-state">
          <p class="mb-4">No temperature feeds are available yet.</p>
          <a class="btn-primary" href="/register?next=/dashboard/devices">
            Create free account — connect probes
          </a>
        </div>
      ) : (
        <div class="feed-groups">
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
                <p class="stat-detail m-0">No probes are assigned to this feed yet.</p>
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
                        <p class="stat-detail">No reading available for key "{probe.key}"</p>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <p class="live-refresh-note">
        {updatedAt
          ? `Updated ${new Date(updatedAt).toLocaleTimeString()}. Next refresh in ${countdown}s.`
          : `Next refresh in ${countdown}s.`}
        {" "}
        <a class="text-link" href="/register?next=/dashboard/devices">
          Free account — connect your probes
        </a>
      </p>
    </section>
  );
}
