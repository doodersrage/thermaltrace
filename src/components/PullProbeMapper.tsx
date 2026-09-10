import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { TempFeedConfig, TempProbeConfig } from "../lib/tempFeedConfig";
import { mergeDiscoveredProbes, type DiscoveredProbe } from "../lib/feedDiscovery";
import { trackProductEvent } from "../lib/productAnalytics";

type DiscoveredProbeRow = {
  key: string;
  suggestedLabel: string;
  label: string;
  tempF: number | null;
  humidity: number | null;
  visible: boolean;
  source: string;
  reading: string;
};

type DiscoverResponse = {
  ok?: boolean;
  message?: string;
  format?: string;
  jsonRoot?: string;
  probes?: DiscoveredProbeRow[];
};

interface Props {
  feeds: TempFeedConfig[];
  probes: TempProbeConfig[];
  redirectTo?: string;
}

type EditableProbe = TempProbeConfig & { reading?: string };

export default function PullProbeMapper({
  feeds,
  probes: initialProbes,
  redirectTo = "/dashboard/devices",
}: Props) {
  const [probes, setProbes] = useState<EditableProbe[]>(
    initialProbes.filter((probe) => Boolean(probe.key)),
  );
  const [status, setStatus] = useState<string | null>(null);
  const [loadingFeedId, setLoadingFeedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const probesRef = useRef(probes);
  probesRef.current = probes;

  const feedsWithUrls = useMemo(
    () => feeds.filter((feed) => Boolean(feed.url)),
    [feeds],
  );
  const autoDiscoverStarted = useRef(false);

  function readFeedFormValues(
    feed: TempFeedConfig,
  ): { url: string; jsonRoot: string; rootInput: HTMLInputElement | null } {
    const idInputs = document.querySelectorAll<HTMLInputElement>('input[name^="feed_"][name$="_id"]');
    for (const input of idInputs) {
      if (input.value !== feed.id) continue;
      const match = input.name.match(/^feed_(\d+)_id$/);
      if (!match) continue;
      const index = match[1];
      const urlInput = document.getElementById(`feed_${index}_url`) as HTMLInputElement | null;
      const rootInput = document.getElementById(`feed_${index}_json_root`) as HTMLInputElement | null;
      return {
        url: urlInput?.value.trim() || feed.url,
        jsonRoot: rootInput?.value.trim() || feed.jsonRoot || "temp",
        rootInput,
      };
    }
    return { url: feed.url, jsonRoot: feed.jsonRoot || "temp", rootInput: null };
  }

  useEffect(() => {
    if (autoDiscoverStarted.current || feedsWithUrls.length === 0) return;
    autoDiscoverStarted.current = true;

    const params = new URLSearchParams(window.location.search);
    const justSavedFeeds = params.get("feeds_saved") === "1";
    const serverDiscovered = Number(params.get("probes_discovered") ?? "0") > 0;
    if (serverDiscovered) return;

    const needsDiscovery = feedsWithUrls.filter(
      (feed) => justSavedFeeds || !initialProbes.some((probe) => probe.feedId === feed.id),
    );

    if (needsDiscovery.length === 0) return;

    void (async () => {
      let merged = initialProbes.filter((probe) => Boolean(probe.key));
      for (const feed of needsDiscovery) {
        const { url, jsonRoot, rootInput } = readFeedFormValues(feed);
        if (!url) continue;
        setLoadingFeedId(feed.id);
        try {
          const response = await fetch("/api/feeds/test", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, jsonRoot }),
          });
          const data = (await response.json()) as DiscoverResponse;
          if (!data.ok || !data.probes?.length) continue;
          if (rootInput && data.jsonRoot && data.jsonRoot !== jsonRoot) {
            rootInput.value = data.jsonRoot;
          }
          merged = mergeDiscoveredProbes(
            merged,
            feed.id,
            data.probes as DiscoveredProbe[],
          );
        } catch {
          // Ignore unreachable feeds during auto-setup.
        } finally {
          setLoadingFeedId(null);
        }
      }
      if (merged.length > initialProbes.length) {
        setProbes(merged);
        setStatus("Imported probe keys from your feed — rename below, then save.");
      }
    })();
  }, [feedsWithUrls, initialProbes]);

  async function discoverFeed(feed: TempFeedConfig) {
    const { url, jsonRoot, rootInput } = readFeedFormValues(feed);

    if (!url) {
      setStatus("Enter a feed URL first.");
      return;
    }

    setLoadingFeedId(feed.id);
    setStatus(null);

    try {
      const response = await fetch("/api/feeds/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, jsonRoot }),
      });
      const data = (await response.json()) as DiscoverResponse;
      if (!data.ok || !data.probes?.length) {
        setStatus(data.message ?? "No probes found in feed.");
        return;
      }

      if (rootInput && data.jsonRoot && data.jsonRoot !== jsonRoot) {
        rootInput.value = data.jsonRoot;
      }

      const merged = mergeDiscoveredProbes(
        probes,
        feed.id,
        data.probes as DiscoveredProbe[],
      );
      const readingByKey = new Map(
        data.probes.map((probe) => [probe.key, probe.reading]),
      );
      setProbes(
        merged.map((probe) => ({
          ...probe,
          reading: probe.feedId === feed.id ? readingByKey.get(probe.key) : undefined,
        })),
      );
      setStatus(
        data.message ??
          `Imported ${data.probes.length} probe${data.probes.length === 1 ? "" : "s"}. Rename below, then save.`,
      );
    } catch {
      setStatus("Unable to read feed.");
    } finally {
      setLoadingFeedId(null);
    }
  }

  function updateProbe(index: number, patch: Partial<EditableProbe>) {
    setProbes((current) =>
      current.map((probe, probeIndex) =>
        probeIndex === index ? { ...probe, ...patch } : probe,
      ),
    );
  }

  function removeProbe(index: number) {
    setProbes((current) => current.filter((_, probeIndex) => probeIndex !== index));
  }

  function parseFeedsFromDom(): Array<{
    id: string;
    name: string;
    url: string;
    enabled: boolean;
    jsonRoot: string;
  }> {
    const root = document.getElementById("pull-feeds-form");
    if (!root) {
      return feedsWithUrls.map((feed) => ({
        ...feed,
        enabled: feed.enabled ?? true,
        jsonRoot: feed.jsonRoot || "temp",
      }));
    }

    const parsed: Array<{
      id: string;
      name: string;
      url: string;
      enabled: boolean;
      jsonRoot: string;
    }> = [];

    for (let index = 0; index < 12; index += 1) {
      const urlInput = root.querySelector<HTMLInputElement>(`[name="feed_${index}_url"]`);
      if (!urlInput) continue;
      const url = urlInput.value.trim();
      if (!url) continue;
      const idInput = root.querySelector<HTMLInputElement>(`[name="feed_${index}_id"]`);
      const nameInput = root.querySelector<HTMLInputElement>(`[name="feed_${index}_name"]`);
      const rootInput = root.querySelector<HTMLInputElement>(`[name="feed_${index}_json_root"]`);
      const enabledInput = root.querySelector<HTMLInputElement>(`[name="feed_${index}_enabled"]`);
      parsed.push({
        id: idInput?.value.trim() || `feed-${index}`,
        name: nameInput?.value.trim() || `Feed ${index + 1}`,
        url,
        enabled: enabledInput?.checked ?? true,
        jsonRoot: rootInput?.value.trim() || "temp",
      });
    }

    return parsed.length > 0
      ? parsed
      : feedsWithUrls.map((feed) => ({
          ...feed,
          enabled: feed.enabled ?? true,
          jsonRoot: feed.jsonRoot || "temp",
        }));
  }

  function acceptSuggestedNames() {
    setProbes((current) =>
      current.map((probe) => ({
        ...probe,
        label: probe.label.match(/^Probe \d+$/) ? humanizeKey(probe.key) : probe.label,
      })),
    );
    setStatus("Applied suggested names — edit below, then save.");
  }

  function hideAverageProbes() {
    setProbes((current) =>
      current.map((probe) =>
        probe.key === "avg" ? { ...probe, visible: false } : probe,
      ),
    );
    setStatus('Hidden "avg" probes from Home — save pull setup to persist.');
  }

  async function savePullSetupInternal() {
    setSaving(true);
    setStatus(null);

    const feedsPayload = parseFeedsFromDom();

    try {
      const response = await fetch("/api/user/pull-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect: redirectTo.includes("tab=") ? redirectTo : `${redirectTo}?tab=pull`,
          feeds: feedsPayload,
          probes: probesRef.current.map((probe) => ({
            id: probe.id,
            feedId: probe.feedId,
            key: probe.key,
            label: probe.label,
            visible: probe.visible,
          })),
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        redirect?: string;
        discoveredProbes?: number;
      };
      if (!response.ok || !data.ok) {
        setStatus(data.error ?? "Failed to save pull setup.");
        window.dispatchEvent(
          new CustomEvent("pull-setup:save-error", {
            detail: data.error ?? "Failed to save pull setup.",
          }),
        );
        return;
      }
      trackProductEvent("pull_setup_saved", {
        discovered_probes: data.discoveredProbes ?? 0,
      });
      window.location.href = data.redirect ?? `${redirectTo}?pull_saved=1&tab=pull`;
    } catch {
      setStatus("Unable to save pull setup.");
      window.dispatchEvent(
        new CustomEvent("pull-setup:save-error", { detail: "Unable to save pull setup." }),
      );
    } finally {
      setSaving(false);
    }
  }

  async function savePullSetup(event: Event) {
    event.preventDefault();
    await savePullSetupInternal();
  }

  useEffect(() => {
    const handler = () => {
      void savePullSetupInternal();
    };
    window.addEventListener("pull-setup:save", handler);
    return () => window.removeEventListener("pull-setup:save", handler);
  });


  if (feedsWithUrls.length === 0) {
    return (
      <p class="mb-0 text-sm text-[var(--color-text-muted)]">
        Save a feed URL first, then discover probe keys here.
      </p>
    );
  }

  return (
    <form class="space-y-4" onSubmit={savePullSetup}>
      <div>
        <h3 class="text-base font-semibold m-0">Probe labels</h3>
        <p class="card-subtitle mb-0 mt-1">
          Discover probes from your feed JSON, then rename them for Home. Keys stay tied to the feed;
          you only edit display names.
        </p>
      </div>

      <div class="flex flex-col gap-2">
        {feedsWithUrls.map((feed) => (
          <div
            key={feed.id}
            class="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] p-3"
          >
            <span class="text-sm font-medium">{feed.name || feed.id}</span>
            <button
              type="button"
              class="btn-secondary"
              disabled={loadingFeedId === feed.id}
              onClick={() => discoverFeed(feed)}
            >
              {loadingFeedId === feed.id ? "Reading feed…" : "Discover from feed"}
            </button>
          </div>
        ))}
      </div>

      {probes.length > 0 ? (
        <div class="flex flex-col gap-3">
          {probes.map((probe, index) => {
            const feed = feedsWithUrls.find((item) => item.id === probe.feedId);
            return (
              <div class="sensor-map-row" key={`${probe.feedId}-${probe.key}-${probe.id}`}>
                <div class="sensor-map-primary">
                  <div class="form-field mb-0">
                    <label class="form-label">Feed</label>
                    <div class="form-input bg-[var(--color-bg-muted)]">
                      {feed?.name || probe.feedId}
                    </div>
                  </div>
                  <div class="form-field mb-0">
                    <label class="form-label">JSON key</label>
                    <div class="form-input font-mono bg-[var(--color-bg-muted)]">{probe.key}</div>
                  </div>
                  <div class="form-field mb-0">
                    <label class="form-label">Name on Home</label>
                    <input
                      class="form-input"
                      type="text"
                      value={probe.label}
                      required
                      onInput={(event) =>
                        updateProbe(index, {
                          label: (event.currentTarget as HTMLInputElement).value,
                        })
                      }
                    />
                  </div>
                  <div class="sensor-map-actions">
                    {probe.reading ? (
                      <span class="text-sm text-[var(--color-text-muted)]">{probe.reading}</span>
                    ) : null}
                    <label class="checkbox-row mb-0">
                      <input
                        type="checkbox"
                        checked={probe.visible}
                        onChange={(event) =>
                          updateProbe(index, {
                            visible: (event.currentTarget as HTMLInputElement).checked,
                          })
                        }
                      />
                      <span>Show on Home</span>
                    </label>
                    <button
                      type="button"
                      class="btn-ghost"
                      onClick={() => removeProbe(index)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p class="mb-0 text-sm text-[var(--color-text-muted)]">
          {loadingFeedId
            ? "Reading feed and importing probe keys…"
            : "Save a feed URL to auto-import keys, or click Discover from feed."}
        </p>
      )}

      <div class="flex flex-wrap items-center gap-3">
        <button type="submit" class="btn-primary" id="pull-setup-save-btn" disabled={saving}>
          {saving ? "Saving…" : "Save pull setup"}
        </button>
        {probes.length > 0 ? (
          <button type="button" class="btn-secondary" onClick={acceptSuggestedNames}>
            Accept suggested names
          </button>
        ) : null}
        {probes.some((probe) => probe.key === "avg") ? (
          <button type="button" class="btn-secondary" onClick={hideAverageProbes}>
            Hide avg on Home
          </button>
        ) : null}
        {status ? <span class="text-sm text-[var(--color-text-muted)]">{status}</span> : null}
      </div>
    </form>
  );
}

function humanizeKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) return "Probe";
  if (/^\d+$/.test(trimmed)) return `Probe ${trimmed}`;
  return trimmed
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
