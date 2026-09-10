import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  applyProbeNoise,
  buildDemoFeedJson,
  buildDemoIngestJson,
  buildDemoSpaceStatus,
  computeAverageReading,
  computeDemoProbes,
  coldestProbeTempF,
  defaultDemoControls,
  doorDraftSpreadF,
  DEMO_PRESETS,
  DEMO_SPACES,
  type DemoControls,
  type DemoPresetId,
  type DemoProbe,
  type DemoSpaceKind,
} from "../lib/probeDemo";

function formatHistoryTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

type JsonTab = "pull" | "push";

function presetFromLocation(): DemoPresetId | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = (params.get("preset") ?? "").trim();
  if (raw && raw in DEMO_PRESETS) return raw as DemoPresetId;
  const hash = window.location.hash.replace(/^#/, "");
  if (hash === "cold-snap" || hash === "coldSnap") return "coldSnap";
  if (hash === "door-draft" || hash === "doorDraft") return "doorDraft";
  if (hash === "sun-load" || hash === "sunny") return "sunny";
  if (hash === "mild") return "mild";
  return null;
}

export default function ProbeDemo() {
  const [controls, setControls] = useState<DemoControls>(() => {
    const preset = presetFromLocation();
    if (!preset) return defaultDemoControls;
    return { ...defaultDemoControls, ...DEMO_PRESETS[preset].controls };
  });
  const [probes, setProbes] = useState<DemoProbe[]>(() =>
    computeDemoProbes(controls),
  );
  const [average, setAverage] = useState(() =>
    computeAverageReading(computeDemoProbes(controls)),
  );
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [jsonTab, setJsonTab] = useState<JsonTab>("push");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const copyTimersRef = useRef<number[]>([]);

  useEffect(() => {
    const baseProbes = computeDemoProbes(controls);
    setProbes(baseProbes);
    setAverage(computeAverageReading(baseProbes));
    setLastUpdated(new Date());
  }, [controls]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      const baseProbes = computeDemoProbes(controls);
      const { probes: nextProbes, average: nextAverage } =
        applyProbeNoise(baseProbes);
      setProbes(nextProbes);
      setAverage(nextAverage);
      setLastUpdated(new Date());
    }, 2000);

    return () => window.clearInterval(interval);
  }, [controls]);

  useEffect(() => {
    return () => {
      for (const id of copyTimersRef.current) window.clearTimeout(id);
      copyTimersRef.current = [];
    };
  }, []);

  const pullJson = useMemo(
    () => buildDemoFeedJson(probes, average),
    [probes, average],
  );
  const pushJson = useMemo(
    () => buildDemoIngestJson(probes, average),
    [probes, average],
  );
  const activeJson = jsonTab === "push" ? pushJson : pullJson;
  const spaceStatus = useMemo(
    () => buildDemoSpaceStatus(probes, controls),
    [probes, controls],
  );
  const coldest = coldestProbeTempF(probes);
  const space = DEMO_SPACES[controls.space];
  const draftSpread = doorDraftSpreadF(probes);
  const maxBarTemp = Math.max(
    ...probes.map((probe) => probe.reading.f),
    average.f,
    controls.freezeThresholdF + 5,
    1,
  );
  const freezeBarPct = Math.min(100, (controls.freezeThresholdF / maxBarTemp) * 100);

  function updateControl<K extends keyof DemoControls>(
    key: K,
    value: DemoControls[K],
  ) {
    setControls((current) => ({ ...current, [key]: value }));
  }

  function applyPreset(id: DemoPresetId) {
    setControls((current) => ({
      ...current,
      ...DEMO_PRESETS[id].controls,
    }));
  }

  function resetDemo() {
    setControls(defaultDemoControls);
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(activeJson);
      setCopyStatus("Copied");
      const id = window.setTimeout(() => setCopyStatus(null), 1500);
      copyTimersRef.current.push(id);
    } catch {
      setCopyStatus("Copy failed");
      const id = window.setTimeout(() => setCopyStatus(null), 2000);
      copyTimersRef.current.push(id);
    }
  }

  return (
    <div class="probe-demo">
      <section class="card">
        <h2 class="card-title">Probe conditions</h2>
        <p class="card-subtitle">
          Pick a space, tweak weather, and watch zones respond the way Overview and Devices do with
          live ingest. Try <strong>Door draft</strong> or <strong>Cold snap</strong> first — cause
          the change, then read the bars.
        </p>

        <div class="probe-demo-presets" role="group" aria-label="Scenario presets">
          {(Object.keys(DEMO_PRESETS) as DemoPresetId[]).map((id) => (
            <button
              key={id}
              type="button"
              class="btn-ghost"
              title={DEMO_PRESETS[id].hint}
              onClick={() => applyPreset(id)}
            >
              {DEMO_PRESETS[id].label}
            </button>
          ))}
        </div>

        <div class="probe-demo-controls">
          <label class="probe-demo-control">
            <span class="form-label">Monitored space</span>
            <select
              class="form-input"
              value={controls.space}
              onChange={(event) =>
                updateControl(
                  "space",
                  (event.currentTarget as HTMLSelectElement).value as DemoSpaceKind,
                )
              }
            >
              {(Object.keys(DEMO_SPACES) as DemoSpaceKind[]).map((id) => (
                <option value={id}>{DEMO_SPACES[id].label}</option>
              ))}
            </select>
            <span class="probe-demo-space-hint">{space.modelHint}</span>
          </label>

          <label class="probe-demo-control">
            <span class="form-label">Outdoor temperature ({controls.outdoorF} °F)</span>
            <input
              class="probe-demo-range"
              type="range"
              min={5}
              max={95}
              step={1}
              value={controls.outdoorF}
              onInput={(event) =>
                updateControl(
                  "outdoorF",
                  Number((event.currentTarget as HTMLInputElement).value),
                )
              }
            />
          </label>

          <label class="probe-demo-control">
            <span class="form-label">Sun / heat load ({controls.sunIntensity}%)</span>
            <input
              class="probe-demo-range"
              type="range"
              min={0}
              max={100}
              step={5}
              value={controls.sunIntensity}
              onInput={(event) =>
                updateControl(
                  "sunIntensity",
                  Number((event.currentTarget as HTMLInputElement).value),
                )
              }
            />
          </label>

          <label class="probe-demo-control">
            <span class="form-label">
              Freeze threshold ({controls.freezeThresholdF} °F)
            </span>
            <input
              class="probe-demo-range"
              type="range"
              min={20}
              max={45}
              step={0.5}
              value={controls.freezeThresholdF}
              onInput={(event) =>
                updateControl(
                  "freezeThresholdF",
                  Number((event.currentTarget as HTMLInputElement).value),
                )
              }
            />
          </label>

          <label class="checkbox-row probe-demo-toggle">
            <input
              type="checkbox"
              checked={controls.doorOpen}
              onChange={(event) =>
                updateControl(
                  "doorOpen",
                  (event.currentTarget as HTMLInputElement).checked,
                )
              }
            />
            <span>{space.doorLabel}</span>
          </label>
        </div>

        {controls.doorOpen && draftSpread != null && draftSpread >= 3 && (
          <p class="probe-demo-draft-callout" role="status">
            Door/entry zone is about <strong>{draftSpread.toFixed(1)}°F</strong> colder than the
            warmest other probe — same reason a single workbench sensor can miss freeze risk at the
            door.
          </p>
        )}

        <div class="probe-demo-actions">
          <button class="btn-secondary" type="button" onClick={resetDemo}>
            Reset demo
          </button>
          <p class="probe-demo-updated m-0">
            Simulated refresh every 2 seconds · Last update {formatHistoryTime(lastUpdated)}
          </p>
        </div>
      </section>

      <section
        class={`card garage-risk-status garage-risk-status--${spaceStatus.level}`}
        aria-live="polite"
      >
        <p class="garage-risk-eyebrow">Space status (simulated)</p>
        <h2 class="card-title garage-risk-title">{spaceStatus.title}</h2>
        <p class="card-subtitle mb-2">{spaceStatus.detail}</p>
        {coldest != null && (
          <p class="text-sm text-[var(--color-text-muted)] mb-0">
            Coldest probe {coldest.toFixed(1)}°F · threshold {controls.freezeThresholdF}°F · outdoor{" "}
            {controls.outdoorF}°F
          </p>
        )}
        {spaceStatus.level === "risk" && (
          <p class="alert-warning mt-3 mb-0">
            In the real app this would fire your freeze essentials (email by default) — same logic as
            Overview’s space status card.
          </p>
        )}
      </section>

      <section class="card">
        <h2 class="card-title">Live probe readings</h2>
        <p class="card-subtitle">
          Each card mirrors a sensor label you’d rename on Devices after first POST.
        </p>

        <div class="stat-grid">
          {probes.map((probe) => {
            const atRisk = probe.reading.f <= controls.freezeThresholdF;
            const near =
              !atRisk && probe.reading.f <= controls.freezeThresholdF + 5;
            const isDoorZone = probe.key === "1";
            return (
              <article
                class={`stat-item${atRisk ? " probe-demo-stat--risk" : near ? " probe-demo-stat--watch" : ""}${
                  controls.doorOpen && isDoorZone ? " probe-demo-stat--draft" : ""
                }`}
                key={probe.key}
              >
                <span class="stat-label">
                  {probe.label}
                  <span class="probe-demo-key"> · {probe.ingestKey}</span>
                  {controls.doorOpen && isDoorZone ? (
                    <span class="probe-demo-draft-badge"> draft</span>
                  ) : null}
                </span>
                <p class="stat-value m-0">{probe.reading.f.toFixed(1)} °F</p>
                <p class="stat-detail m-0">
                  {probe.reading.c.toFixed(1)} °C · {probe.reading.h.toFixed(1)}% humidity
                  {atRisk ? " · below freeze" : near ? " · near freeze" : ""}
                </p>
              </article>
            );
          })}
          <article class="stat-item">
            <span class="stat-label">Average · avg</span>
            <p class="stat-value m-0">{average.f.toFixed(1)} °F</p>
            <p class="stat-detail m-0">
              {average.c.toFixed(1)} °C · {average.h.toFixed(1)}% humidity
            </p>
          </article>
        </div>
      </section>

      <section class="card">
        <h2 class="card-title">Probe comparison</h2>
        <p class="card-subtitle">
          {controls.doorOpen
            ? "Open-door mix should drop the door/entry bar vs the others — dashed line is your freeze threshold."
            : "Relative temperature by zone — dashed line is your freeze threshold. Toggle the door open to widen the gap."}
        </p>
        <div class="probe-demo-bars" role="img" aria-label="Bar chart comparing probe temperatures">
          {probes.map((probe) => (
            <div
              class={`probe-demo-bar-row${
                controls.doorOpen && probe.key === "1" ? " probe-demo-bar-row--draft" : ""
              }`}
              key={probe.key}
            >
              <span class="probe-demo-bar-label">{probe.label}</span>
              <div class="probe-demo-bar-track">
                <div
                  class={`probe-demo-bar-fill${
                    probe.reading.f <= controls.freezeThresholdF
                      ? " probe-demo-bar-fill--risk"
                      : controls.doorOpen && probe.key === "1"
                        ? " probe-demo-bar-fill--draft"
                        : ""
                  }`}
                  style={{ width: `${(probe.reading.f / maxBarTemp) * 100}%` }}
                />
                <span
                  class="probe-demo-bar-threshold"
                  style={{ left: `${freezeBarPct}%` }}
                  title={`Freeze ${controls.freezeThresholdF}°F`}
                />
              </div>
              <span class="probe-demo-bar-value">{probe.reading.f.toFixed(1)} °F</span>
            </div>
          ))}
        </div>
        <p class="mt-3 mb-0 text-sm text-[var(--color-text-muted)]">
          Vertical marks show the {controls.freezeThresholdF}°F freeze threshold on each bar.
        </p>
      </section>

      <section class="card">
        <h2 class="card-title">JSON feed preview</h2>
        <p class="card-subtitle mb-3">
          Push ingest is what ESP/Arduino POST to Devices. Pull nests the same named probes under
          <code>temp</code> for scheduled HTTPS JSON.
        </p>
        <div class="probe-demo-json-tabs" role="tablist" aria-label="JSON format">
          <button
            type="button"
            role="tab"
            class={jsonTab === "push" ? "btn-secondary ring-2 ring-[var(--color-accent)]" : "btn-ghost"}
            aria-selected={jsonTab === "push"}
            onClick={() => setJsonTab("push")}
          >
            Push ingest
          </button>
          <button
            type="button"
            role="tab"
            class={jsonTab === "pull" ? "btn-secondary ring-2 ring-[var(--color-accent)]" : "btn-ghost"}
            aria-selected={jsonTab === "pull"}
            onClick={() => setJsonTab("pull")}
          >
            Pull feed
          </button>
          <button type="button" class="btn-ghost" onClick={() => void copyJson()}>
            {copyStatus ?? "Copy JSON"}
          </button>
        </div>
        <pre class="probe-demo-json"><code>{activeJson}</code></pre>
      </section>

      <section class="card probe-demo-convert" id="try-real">
        <h2 class="card-title">Now try it with your own probe</h2>
        <p class="card-subtitle mb-4">
          Same JSON shapes, same Overview space-status logic, same freeze essentials — create a free
          account, POST once, and set a threshold before the next cold night.
        </p>
        <div class="flex flex-wrap gap-3 mb-3">
          <a class="btn-primary" href="/register?next=/dashboard/devices">
            Create free account
          </a>
          <a class="btn-secondary" href="/about/adding-devices">
            Adding devices guide
          </a>
          <a class="btn-ghost" href="/demo">
            Or watch the live demo feed
          </a>
        </div>
        <p class="mb-0 text-sm text-[var(--color-text-muted)]">
          Already signed in?
          {" "}
          <a class="text-link" href="/dashboard">Overview + demo feed</a>
          {" · "}
          <a class="text-link" href="/dashboard/alerts#alert-section-essentials">
            Freeze + email essentials
          </a>
        </p>
      </section>
    </div>
  );
}
