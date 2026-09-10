import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  CHART_VIEW_PRESETS,
  formatAxisTime,
  formatHoverTime,
  nearestPointByTime,
  presetNarrowsDomain,
  timestampToX,
  xToTimestamp,
} from "../lib/historyChartInteraction";
import {
  readDeltaChartPrefs,
  writeDeltaChartPrefs,
} from "../lib/chartPrefs";
import { useHistoryChartInteraction } from "../lib/useHistoryChartInteraction";
import type { IndoorOutdoorPoint } from "../lib/indoorOutdoorDelta";

interface Props {
  points: IndoorOutdoorPoint[];
  title?: string;
}

const LINE_COLOR = "#ff7a00";

export default function IndoorOutdoorChart({
  points,
  title = "Indoor vs outdoor delta",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const plotBoundsRef = useRef<import("../lib/historyChartInteraction").PlotBounds | null>(
    null,
  );
  const dragActiveRef = useRef(false);

  const [hover, setHover] = useState<{
    point: IndoorOutdoorPoint;
    x: number;
    y: number;
  } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [initialPresetId, setInitialPresetId] = useState<
    "24h" | "7d" | "30d" | "all" | null
  >(null);
  const [prefsReady, setPrefsReady] = useState(false);

  useEffect(() => {
    const prefs = readDeltaChartPrefs();
    if (prefs?.presetId) setInitialPresetId(prefs.presetId);
    setPrefsReady(true);
  }, []);

  const seriesAsChartPoints = useMemo(
    () =>
      points.map((p) => ({
        timestamp: p.timestamp,
        tempf: p.deltaF,
        humidity: 0,
        probeLabel: "ΔT",
      })),
    [points],
  );

  const hoverHandlers = useMemo(
    () => ({
      clearHover() {
        setHover(null);
        setTooltipPos(null);
      },
      updateHover(clientX: number, clientY: number) {
        const canvas = canvasRef.current;
        const bounds = plotBoundsRef.current;
        if (!canvas || !bounds) return;
        const rect = canvas.getBoundingClientRect();
        const ts = xToTimestamp(clientX - rect.left, bounds);
        if (ts == null) {
          setHover(null);
          setTooltipPos(null);
          return;
        }
        const nearest = nearestPointByTime(seriesAsChartPoints, ts);
        if (!nearest) {
          setHover(null);
          setTooltipPos(null);
          return;
        }
        const point = points.find((p) => p.timestamp === nearest.timestamp);
        if (!point) {
          setHover(null);
          setTooltipPos(null);
          return;
        }
        setHover({
          point,
          x: timestampToX(Date.parse(point.timestamp), bounds),
          y: 0,
        });
        setTooltipPos({
          x: Math.min(Math.max(clientX - rect.left + 12, 8), Math.max(8, rect.width - 188)),
          y: Math.min(Math.max(clientY - rect.top - 8, 8), Math.max(8, rect.height - 8)),
        });
      },
    }),
    [points, seriesAsChartPoints],
  );

  const interaction = useHistoryChartInteraction({
    points,
    canvasRef,
    wrapRef,
    plotBoundsRef,
    pngFilenamePrefix: "thermaltrace-delta",
    hover: hoverHandlers,
    initialPresetId: prefsReady ? initialPresetId : null,
    onPresetChange: (presetId) => {
      if (presetId === "custom") return;
      writeDeltaChartPrefs({ presetId });
    },
  });

  const {
    domain,
    activeView,
    zoomed,
    activePreset,
    expanded,
    lightboxSlotHeight,
    openLightbox,
    closeLightbox,
    expandBtnRef,
    closeBtnRef,
    isPanning,
    isBrushing,
    brushRange,
    applyPreset,
    resetZoom,
    exportPng,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    bindWheelZoom,
    setViewWindow,
  } = interaction;

  // Keep a live flag so pointer-leave can ignore mid-drag clears.
  useEffect(() => {
    dragActiveRef.current = isPanning || isBrushing;
  }, [isPanning, isBrushing]);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl || points.length < 2 || !activeView) return;
    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    const canvas = canvasEl;
    const g = ctx;
    const view = activeView;

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
      const minTs = view.minTs;
      const maxTs = view.maxTs;
      const tsRange = maxTs - minTs || 1;

      const visible = points.filter((p) => {
        const ts = Date.parse(p.timestamp);
        return ts >= minTs && ts <= maxTs;
      });
      const scalePoints = visible.length > 0 ? visible : points;
      const deltas = scalePoints.map((p) => p.deltaF);
      const min = Math.min(...deltas, 0) - 2;
      const max = Math.max(...deltas, 0) + 2;
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
      const yFor = (delta: number) =>
        pad.top + innerH - ((delta - min) / range) * innerH;

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
        g.fillText(`${val >= 0 ? "+" : ""}${val.toFixed(0)}°F`, pad.left - 6, y + 3);
      }

      const zeroY = yFor(0);
      g.strokeStyle = "rgba(255,255,255,0.2)";
      g.beginPath();
      g.moveTo(pad.left, zeroY);
      g.lineTo(width - pad.right, zeroY);
      g.stroke();

      g.save();
      g.beginPath();
      g.rect(pad.left, pad.top, innerW, innerH);
      g.clip();

      g.strokeStyle = LINE_COLOR;
      g.lineWidth = 2;
      g.beginPath();
      points.forEach((point, i) => {
        const x = xFor(Date.parse(point.timestamp));
        const y = yFor(point.deltaF);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.stroke();

      if (hover) {
        const hx = timestampToX(Date.parse(hover.point.timestamp), plotBoundsRef.current!);
        const hy = yFor(hover.point.deltaF);
        g.strokeStyle = "rgba(248, 250, 252, 0.45)";
        g.setLineDash([3, 3]);
        g.beginPath();
        g.moveTo(hx, pad.top);
        g.lineTo(hx, height - pad.bottom);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = LINE_COLOR;
        g.beginPath();
        g.arc(hx, hy, 4.5, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "#0f172a";
        g.lineWidth = 1.5;
        g.stroke();
      }

      if (brushRange) {
        const left = Math.max(Math.min(brushRange.startX, brushRange.endX), pad.left);
        const right = Math.min(
          Math.max(brushRange.startX, brushRange.endX),
          width - pad.right,
        );
        if (right > left) {
          g.fillStyle = "rgba(96, 165, 250, 0.18)";
          g.fillRect(left, pad.top, right - left, innerH);
          g.strokeStyle = "rgba(147, 197, 253, 0.85)";
          g.strokeRect(left, pad.top, right - left, innerH);
        }
      }

      g.restore();

      g.fillStyle = "#94a3b8";
      g.font = "10px system-ui, sans-serif";
      g.textAlign = "left";
      g.fillText(formatAxisTime(minTs, tsRange), pad.left, height - 8);
      g.textAlign = "right";
      g.fillText(formatAxisTime(maxTs, tsRange), width - pad.right, height - 8);
    }

    draw();
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    const unbindWheel = bindWheelZoom(canvas);

    return () => {
      ro.disconnect();
      unbindWheel();
    };
  }, [points, activeView, hover, brushRange, bindWheelZoom, plotBoundsRef]);

  if (points.length < 2) return null;

  return (
    <>
      {expanded && (
        <div
          class="history-chart-lightbox-spacer"
          style={{ height: lightboxSlotHeight || undefined }}
          aria-hidden="true"
        />
      )}
      {expanded && (
        <button
          type="button"
          class="history-chart-lightbox-scrim"
          aria-label="Close expanded chart"
          onClick={closeLightbox}
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
          <div class="history-chart-zoom" role="group" aria-label="Chart controls">
            <button
              type="button"
              class="history-chart-zoom-btn"
              aria-label="Reset zoom"
              disabled={!zoomed}
              onClick={resetZoom}
            >
              Reset
            </button>
            <button
              type="button"
              class="history-chart-zoom-btn history-chart-expand-btn"
              aria-label="Download chart PNG"
              onClick={exportPng}
            >
              PNG
            </button>
            {expanded ? (
              <button
                ref={closeBtnRef}
                type="button"
                class="history-chart-zoom-btn history-chart-expand-btn"
                aria-label="Close expanded chart"
                onClick={closeLightbox}
              >
                Close
              </button>
            ) : (
              <button
                ref={expandBtnRef}
                type="button"
                class="history-chart-zoom-btn history-chart-expand-btn"
                aria-label="Expand chart"
                aria-haspopup="dialog"
                onClick={openLightbox}
              >
                Expand
              </button>
            )}
          </div>
        </div>

        <div class="history-chart-presets" role="group" aria-label="Time range presets">
          {CHART_VIEW_PRESETS.map((preset) => {
            const canNarrow = domain ? presetNarrowsDomain(domain, preset.spanMs) : false;
            const domainSpan = domain ? domain.maxTs - domain.minTs : 0;
            const isCurrentWindow =
              !canNarrow &&
              domain != null &&
              Math.abs(domainSpan - preset.spanMs) <= 2 * 60 * 60 * 1000;
            return (
              <button
                key={preset.id}
                type="button"
                class={`history-chart-preset-btn${activePreset === preset.id ? " is-active" : ""}`}
                aria-pressed={activePreset === preset.id}
                disabled={!domain || (!canNarrow && !isCurrentWindow)}
                onClick={() => applyPreset(preset.spanMs)}
              >
                {preset.label}
              </button>
            );
          })}
          <button
            type="button"
            class={`history-chart-preset-btn${activePreset === "all" ? " is-active" : ""}`}
            aria-pressed={activePreset === "all"}
            onClick={() => applyPreset(null)}
          >
            All
          </button>
        </div>

        <p class="m-0 mb-2 text-xs text-[var(--color-text-muted)]">
          Blue line = indoor minus outdoor forecast reference. Drag to select a range;
          hover for readings.
        </p>

        <div
          class="history-chart-canvas-wrap"
          onPointerLeave={() => {
            if (!dragActiveRef.current) {
              setHover(null);
              setTooltipPos(null);
            }
          }}
        >
          <canvas
            ref={canvasRef}
            class={`w-full history-chart-canvas history-chart-canvas--delta${zoomed ? " is-zoomed" : ""}${isPanning ? " is-panning" : ""}${isBrushing ? " is-brushing" : ""}`}
            role="img"
            aria-label={title}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDblClick={() => setViewWindow(null)}
          />
          {tooltipPos && hover && !isPanning && !isBrushing && (
            <div
              class="history-chart-tooltip"
              style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
              role="status"
            >
              <p class="history-chart-tooltip-time">
                {formatHoverTime(hover.point.timestamp)}
              </p>
              <ul class="history-chart-tooltip-list">
                <li>
                  <span
                    class="history-chart-tooltip-swatch"
                    style={{ background: LINE_COLOR }}
                  />
                  <span class="history-chart-tooltip-label">ΔT</span>
                  <span class="history-chart-tooltip-value">
                    {hover.point.deltaF > 0 ? "+" : ""}
                    {hover.point.deltaF.toFixed(1)}°F
                  </span>
                </li>
                <li>
                  <span class="history-chart-tooltip-swatch" style={{ background: "#94a3b8" }} />
                  <span class="history-chart-tooltip-label">Indoor</span>
                  <span class="history-chart-tooltip-value">
                    {hover.point.indoorF.toFixed(1)}°F
                  </span>
                </li>
                <li>
                  <span class="history-chart-tooltip-swatch" style={{ background: "#fbbf24" }} />
                  <span class="history-chart-tooltip-label">Outdoor</span>
                  <span class="history-chart-tooltip-value">
                    {hover.point.outdoorF.toFixed(1)}°F
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
