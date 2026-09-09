import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  formatHoverTime,
  nearestPointByTime,
  timeDomainFromPoints,
  timestampToX,
  xToTimestamp,
  type PlotBounds,
} from "../lib/historyChartInteraction";
import type { ProbeSpreadPoint } from "../lib/probeSpread";

interface Props {
  points: ProbeSpreadPoint[];
  title?: string;
}

const LINE = "#f472b6";

export default function ProbeSpreadChart({
  points,
  title = "Probe spread (°F)",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const plotBoundsRef = useRef<PlotBounds | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [slotHeight, setSlotHeight] = useState(0);
  const [hover, setHover] = useState<ProbeSpreadPoint | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const domain = useMemo(() => timeDomainFromPoints(points), [points]);
  const mapped = useMemo(
    () =>
      points.map((p) => ({
        timestamp: p.timestamp,
        tempf: p.spreadF,
        humidity: 0,
        probeLabel: "spread",
      })),
    [points],
  );

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
    if (!canvasEl || !domain || points.length < 2) return;
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

      const pad = { top: 16, right: 16, bottom: 28, left: 40 };
      const innerW = width - pad.left - pad.right;
      const innerH = height - pad.top - pad.bottom;
      const minTs = domain!.minTs;
      const maxTs = domain!.maxTs;
      const tsRange = maxTs - minTs || 1;
      const spreads = points.map((p) => p.spreadF);
      const min = 0;
      const max = Math.max(...spreads, 1) + 1;
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
      const yFor = (v: number) => pad.top + innerH - ((v - min) / range) * innerH;

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
        g.fillText(`${val.toFixed(0)}°F`, pad.left - 6, y + 3);
      }

      g.strokeStyle = LINE;
      g.lineWidth = 2;
      g.beginPath();
      points.forEach((point, i) => {
        const x = xFor(Date.parse(point.timestamp));
        const y = yFor(point.spreadF);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.stroke();

      if (hover && plotBoundsRef.current) {
        const hx = timestampToX(Date.parse(hover.timestamp), plotBoundsRef.current);
        g.strokeStyle = "rgba(248, 250, 252, 0.45)";
        g.setLineDash([3, 3]);
        g.beginPath();
        g.moveTo(hx, pad.top);
        g.lineTo(hx, height - pad.bottom);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = LINE;
        g.beginPath();
        g.arc(hx, yFor(hover.spreadF), 4.5, 0, Math.PI * 2);
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
  }, [points, domain, hover, expanded]);

  if (points.length < 2) return null;

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
          Hourly warmest−coldest gap across probes. Wider spread can mean stratification or a failing sensor.
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
            class="w-full history-chart-canvas history-chart-canvas--bars"
            role="img"
            aria-label={title}
            onPointerMove={(e) => {
              const bounds = plotBoundsRef.current;
              const canvas = canvasRef.current;
              if (!bounds || !canvas) return;
              const rect = canvas.getBoundingClientRect();
              const ts = xToTimestamp(e.clientX - rect.left, bounds);
              if (ts == null) return;
              const nearest = nearestPointByTime(mapped, ts);
              if (!nearest) return;
              const point = points.find((p) => p.timestamp === nearest.timestamp);
              if (!point) return;
              setHover(point);
              setTooltipPos({
                x: Math.min(Math.max(e.clientX - rect.left + 12, 8), rect.width - 170),
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
              <p class="history-chart-tooltip-time">{formatHoverTime(hover.timestamp)}</p>
              <ul class="history-chart-tooltip-list">
                <li>
                  <span class="history-chart-tooltip-swatch" style={{ background: LINE }} />
                  <span class="history-chart-tooltip-label">Spread</span>
                  <span class="history-chart-tooltip-value">
                    {hover.spreadF.toFixed(1)}°F
                  </span>
                </li>
                <li>
                  <span class="history-chart-tooltip-swatch" style={{ background: "#38bdf8" }} />
                  <span class="history-chart-tooltip-label">Coldest</span>
                  <span class="history-chart-tooltip-value">{hover.minF.toFixed(1)}°F</span>
                </li>
                <li>
                  <span class="history-chart-tooltip-swatch" style={{ background: "#fb923c" }} />
                  <span class="history-chart-tooltip-label">Warmest</span>
                  <span class="history-chart-tooltip-value">{hover.maxF.toFixed(1)}°F</span>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
