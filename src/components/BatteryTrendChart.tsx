import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  formatHoverTime,
  nearestPointByTime,
  timeDomainFromPoints,
  timestampToX,
  xToTimestamp,
  type PlotBounds,
} from "../lib/historyChartInteraction";

export type MetaTrendSample = { value: number; at: string };

export type MetaTrendSeries = {
  label: string;
  samples: MetaTrendSample[];
  color?: string;
};

/** @deprecated Prefer MetaTrendSeries — kept for existing battery card imports. */
export type BatteryTrendSeries = MetaTrendSeries;

interface Props {
  series: MetaTrendSeries[];
  title?: string;
  /** Axis / tooltip unit, e.g. "%" or "dBm". */
  unitSuffix?: string;
  /** Extra padding around the value domain. */
  valuePad?: number;
  canvasClassName?: string;
}

const COLORS = ["#ff7a00", "#34d399", "#fbbf24", "#f472b6"];

export default function BatteryTrendChart({
  series,
  title = "Battery % over recent samples",
  unitSuffix = "%",
  valuePad = 5,
  canvasClassName = "history-chart-canvas--battery",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const plotBoundsRef = useRef<PlotBounds | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [slotHeight, setSlotHeight] = useState(0);
  const [hover, setHover] = useState<{
    label: string;
    color: string;
    value: number;
    at: string;
  } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const usable = useMemo(
    () => series.filter((s) => s.samples.length >= 2).slice(0, 6),
    [series],
  );

  const allPoints = useMemo(
    () =>
      usable.flatMap((s) =>
        s.samples.map((sample) => ({
          timestamp: sample.at,
          tempf: sample.value,
          humidity: 0,
          probeLabel: s.label,
        })),
      ),
    [usable],
  );

  const domain = useMemo(() => timeDomainFromPoints(allPoints), [allPoints]);

  useEffect(() => {
    if (!expanded) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl || !domain || usable.length === 0) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    const canvas = canvasEl;
    const g = ctx;

    function draw() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);

      const pad = { top: 16, right: 16, bottom: 28, left: 44 };
      const innerW = width - pad.left - pad.right;
      const innerH = height - pad.top - pad.bottom;
      const minTs = domain!.minTs;
      const maxTs = domain!.maxTs;
      const tsRange = maxTs - minTs || 1;
      const values = usable.flatMap((s) => s.samples.map((sample) => sample.value));
      const rawMin = Math.min(...values);
      const rawMax = Math.max(...values);
      const min = rawMin - valuePad;
      const max = rawMax + valuePad;
      const range = max - min || 1;

      plotBoundsRef.current = {
        padLeft: pad.left,
        padRight: pad.right,
        padTop: pad.top,
        padBottom: pad.bottom,
        width,
        height,
        minTs,
        maxTs,
        minTemp: min,
        maxTemp: max,
      };

      const xFor = (ts: number) => pad.left + ((ts - minTs) / tsRange) * innerW;
      const yFor = (value: number) =>
        pad.top + innerH - ((value - min) / range) * innerH;

      g.clearRect(0, 0, width, height);
      g.fillStyle = "#151b24";
      g.fillRect(0, 0, width, height);

      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (innerH / 4) * i;
        g.strokeStyle = "rgba(255,255,255,0.06)";
        g.beginPath();
        g.moveTo(pad.left, y);
        g.lineTo(width - pad.right, y);
        g.stroke();
        const val = max - (range / 4) * i;
        g.fillStyle = "#94a3b8";
        g.font = "10px system-ui, sans-serif";
        g.textAlign = "right";
        g.fillText(`${val.toFixed(0)}${unitSuffix}`, pad.left - 6, y + 3);
      }

      usable.forEach((s, index) => {
        const color = s.color ?? COLORS[index % COLORS.length]!;
        const ordered = [...s.samples].sort(
          (a, b) => Date.parse(a.at) - Date.parse(b.at),
        );
        g.strokeStyle = color;
        g.lineWidth = 2;
        g.beginPath();
        ordered.forEach((sample, i) => {
          const x = xFor(Date.parse(sample.at));
          const y = yFor(sample.value);
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        });
        g.stroke();
      });

      if (hover && plotBoundsRef.current) {
        const hx = timestampToX(Date.parse(hover.at), plotBoundsRef.current);
        g.strokeStyle = "rgba(248, 250, 252, 0.45)";
        g.setLineDash([3, 3]);
        g.beginPath();
        g.moveTo(hx, pad.top);
        g.lineTo(hx, height - pad.bottom);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = hover.color;
        g.beginPath();
        g.arc(hx, yFor(hover.value), 4.5, 0, Math.PI * 2);
        g.fill();
      }

      g.fillStyle = "#94a3b8";
      g.font = "10px system-ui, sans-serif";
      g.textAlign = "left";
      g.fillText(new Date(minTs).toLocaleDateString(), pad.left, height - 8);
      g.textAlign = "right";
      g.fillText(new Date(maxTs).toLocaleDateString(), width - pad.right, height - 8);
    }

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [usable, domain, hover, expanded, unitSuffix, valuePad]);

  if (usable.length === 0) return null;

  return (
    <>
      {expanded && (
        <div
          class="history-chart-lightbox-spacer"
          style={{ height: slotHeight || undefined }}
          aria-hidden="true"
        />
      )}
      {expanded && (
        <button
          type="button"
          class="history-chart-lightbox-scrim"
          aria-label="Close expanded chart"
          onClick={() => setExpanded(false)}
        />
      )}
      <div
        ref={wrapRef}
        class={`history-chart-wrap${expanded ? " is-lightbox" : ""}`}
        role={expanded ? "dialog" : undefined}
        aria-modal={expanded ? "true" : undefined}
        aria-label={expanded ? title : undefined}
      >
        <div class="history-chart-header">
          <p class="history-chart-title">{title}</p>
          <div class="history-chart-zoom">
            {expanded ? (
              <button
                type="button"
                class="history-chart-zoom-btn history-chart-expand-btn"
                onClick={() => setExpanded(false)}
              >
                Close
              </button>
            ) : (
              <button
                type="button"
                class="history-chart-zoom-btn history-chart-expand-btn"
                onClick={() => {
                  if (wrapRef.current) setSlotHeight(wrapRef.current.offsetHeight);
                  setExpanded(true);
                }}
              >
                Expand
              </button>
            )}
          </div>
        </div>
        <p class="m-0 mb-2 text-xs text-[var(--color-text-muted)]">
          {usable.map((s, i) => (
            <span key={s.label}>
              {i > 0 ? " · " : ""}
              <span style={{ color: s.color ?? COLORS[i % COLORS.length] }}>{s.label}</span>
            </span>
          ))}
        </p>
        <div
          class="history-chart-canvas-wrap"
          onPointerLeave={() => {
            setHover(null);
            setTooltipPos(null);
          }}
        >
          <canvas
            ref={canvasRef}
            class={`w-full history-chart-canvas ${canvasClassName}`}
            role="img"
            aria-label={title}
            onPointerMove={(e) => {
              const bounds = plotBoundsRef.current;
              const canvas = canvasRef.current;
              if (!bounds || !canvas) return;
              const rect = canvas.getBoundingClientRect();
              const ts = xToTimestamp(e.clientX - rect.left, bounds);
              if (ts == null) return;
              let best: {
                label: string;
                color: string;
                value: number;
                at: string;
                delta: number;
              } | null = null;
              usable.forEach((s, index) => {
                const mapped = s.samples.map((sample) => ({
                  timestamp: sample.at,
                  tempf: sample.value,
                  humidity: 0,
                  probeLabel: s.label,
                }));
                const nearest = nearestPointByTime(mapped, ts);
                if (!nearest) return;
                const delta = Math.abs(Date.parse(nearest.timestamp) - ts);
                if (!best || delta < best.delta) {
                  best = {
                    label: s.label,
                    color: s.color ?? COLORS[index % COLORS.length]!,
                    value: nearest.tempf,
                    at: nearest.timestamp,
                    delta,
                  };
                }
              });
              if (!best) return;
              setHover(best);
              setTooltipPos({
                x: Math.min(Math.max(e.clientX - rect.left + 12, 8), rect.width - 160),
                y: Math.min(Math.max(e.clientY - rect.top - 8, 8), rect.height - 8),
              });
            }}
          />
          {tooltipPos && hover && (
            <div
              class="history-chart-tooltip"
              style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
              role="status"
            >
              <p class="history-chart-tooltip-time">{formatHoverTime(hover.at)}</p>
              <ul class="history-chart-tooltip-list">
                <li>
                  <span
                    class="history-chart-tooltip-swatch"
                    style={{ background: hover.color }}
                  />
                  <span class="history-chart-tooltip-label">{hover.label}</span>
                  <span class="history-chart-tooltip-value">
                    {hover.value.toFixed(0)}
                    {unitSuffix}
                  </span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
