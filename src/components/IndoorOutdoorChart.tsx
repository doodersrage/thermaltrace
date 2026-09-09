import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  brushPixelsToWindow,
  CHART_VIEW_PRESETS,
  downloadCanvasPng,
  formatAxisTime,
  formatHoverTime,
  isFullyZoomedOut,
  matchingPresetId,
  nearestPointByTime,
  panTimeWindow,
  presetNarrowsDomain,
  timeDomainFromPoints,
  timestampToX,
  windowForTrailingSpan,
  xToTimestamp,
  zoomTimeWindow,
  type PlotBounds,
  type TimeWindow,
} from "../lib/historyChartInteraction";
import type { IndoorOutdoorPoint } from "../lib/indoorOutdoorDelta";

interface Props {
  points: IndoorOutdoorPoint[];
  title?: string;
}

const LINE_COLOR = "#60a5fa";

export default function IndoorOutdoorChart({
  points,
  title = "Indoor vs outdoor delta",
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const plotBoundsRef = useRef<PlotBounds | null>(null);
  const expandBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const wasExpandedRef = useRef(false);
  const viewWindowRef = useRef<TimeWindow | null>(null);
  const domainRef = useRef<TimeWindow | null>(null);
  const dragRef = useRef<{
    kind: "pan" | "brush";
    pointerId: number;
    startX: number;
    startView: TimeWindow;
    brushStartX: number;
    brushEndX: number;
    moved: boolean;
  } | null>(null);

  const [viewWindow, setViewWindow] = useState<TimeWindow | null>(null);
  const [hover, setHover] = useState<{
    point: IndoorOutdoorPoint;
    x: number;
    y: number;
  } | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [expanded, setExpanded] = useState(false);
  const [lightboxSlotHeight, setLightboxSlotHeight] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [isBrushing, setIsBrushing] = useState(false);
  const [brushRange, setBrushRange] = useState<{ startX: number; endX: number } | null>(
    null,
  );

  const domain = useMemo(() => timeDomainFromPoints(points), [points]);
  const activeView = viewWindow && domain ? viewWindow : domain;
  const zoomed =
    !!domain && !!activeView && !isFullyZoomedOut(activeView, domain);
  const activePreset = domain ? matchingPresetId(viewWindow, domain) : "all";

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

  useEffect(() => {
    viewWindowRef.current = viewWindow;
  }, [viewWindow]);

  useEffect(() => {
    domainRef.current = domain;
    if (!domain) {
      setViewWindow(null);
      return;
    }
    setViewWindow((prev) => {
      if (!prev) return null;
      const next = {
        minTs: Math.max(prev.minTs, domain.minTs),
        maxTs: Math.min(prev.maxTs, domain.maxTs),
      };
      if (next.maxTs <= next.minTs || isFullyZoomedOut(next, domain)) return null;
      return next;
    });
  }, [domain]);

  useEffect(() => {
    if (!expanded) {
      if (wasExpandedRef.current) expandBtnRef.current?.focus();
      wasExpandedRef.current = false;
      return;
    }
    wasExpandedRef.current = true;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtnRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

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

    const onWheel = (event: WheelEvent) => {
      const currentDomain = domainRef.current;
      if (!currentDomain || !plotBoundsRef.current) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const anchor =
        xToTimestamp(event.clientX - rect.left, plotBoundsRef.current) ??
        (currentDomain.minTs + currentDomain.maxTs) / 2;
      const currentView = viewWindowRef.current ?? currentDomain;
      const factor = event.deltaY > 0 ? 1.18 : 1 / 1.18;
      const next = zoomTimeWindow(currentView, currentDomain, anchor, factor);
      setViewWindow(isFullyZoomedOut(next, currentDomain) ? null : next);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      ro.disconnect();
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [points, activeView, hover, brushRange]);

  function canvasLocalX(clientX: number): number {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    return clientX - canvas.getBoundingClientRect().left;
  }

  function clearHover() {
    setHover(null);
    setTooltipPos(null);
  }

  function updateHover(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    const bounds = plotBoundsRef.current;
    if (!canvas || !bounds) return;
    const rect = canvas.getBoundingClientRect();
    const ts = xToTimestamp(clientX - rect.left, bounds);
    if (ts == null) {
      clearHover();
      return;
    }
    const nearest = nearestPointByTime(seriesAsChartPoints, ts);
    if (!nearest) {
      clearHover();
      return;
    }
    const point = points.find((p) => p.timestamp === nearest.timestamp);
    if (!point) {
      clearHover();
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
  }

  function applyPreset(spanMs: number | null) {
    if (!domain) return;
    if (spanMs == null) {
      setViewWindow(null);
      return;
    }
    if (!presetNarrowsDomain(domain, spanMs)) {
      setViewWindow(null);
      return;
    }
    const next = windowForTrailingSpan(domain, spanMs);
    setViewWindow(isFullyZoomedOut(next, domain) ? null : next);
  }

  function onPointerDown(e: {
    clientX: number;
    clientY: number;
    pointerId: number;
    shiftKey: boolean;
    currentTarget: EventTarget;
  }) {
    updateHover(e.clientX, e.clientY);
    if (!domain || !activeView) return;
    (e.currentTarget as HTMLCanvasElement).setPointerCapture?.(e.pointerId);
    const useBrush = e.shiftKey || !zoomed;
    const localX = canvasLocalX(e.clientX);
    dragRef.current = {
      kind: useBrush ? "brush" : "pan",
      pointerId: e.pointerId,
      startX: e.clientX,
      startView: activeView,
      brushStartX: localX,
      brushEndX: localX,
      moved: false,
    };
    if (useBrush) {
      setBrushRange({ startX: localX, endX: localX });
      setIsBrushing(false);
    }
  }

  function onPointerMove(e: { clientX: number; clientY: number; pointerId: number }) {
    const drag = dragRef.current;
    if (drag && drag.pointerId === e.pointerId && domain && plotBoundsRef.current) {
      const dx = e.clientX - drag.startX;
      if (drag.kind === "brush") {
        if (!drag.moved && Math.abs(dx) < 5) {
          updateHover(e.clientX, e.clientY);
          return;
        }
        drag.moved = true;
        drag.brushEndX = canvasLocalX(e.clientX);
        setIsBrushing(true);
        setBrushRange({ startX: drag.brushStartX, endX: drag.brushEndX });
        clearHover();
        return;
      }
      if (!isPanning && Math.abs(dx) < 5) {
        updateHover(e.clientX, e.clientY);
        return;
      }
      if (!isPanning) setIsPanning(true);
      const bounds = plotBoundsRef.current;
      const innerW = bounds.width - bounds.padLeft - bounds.padRight;
      const span = drag.startView.maxTs - drag.startView.minTs || 1;
      setViewWindow(
        panTimeWindow(
          drag.startView,
          domain,
          -(dx / Math.max(innerW, 1)) * span,
        ),
      );
      clearHover();
      return;
    }
    updateHover(e.clientX, e.clientY);
  }

  function onPointerUp(e: { pointerId: number; currentTarget: EventTarget }) {
    const drag = dragRef.current;
    if (drag?.pointerId !== e.pointerId) return;
    if (drag.kind === "brush" && drag.moved && domain && plotBoundsRef.current) {
      const next = brushPixelsToWindow(
        drag.brushStartX,
        drag.brushEndX,
        plotBoundsRef.current,
        domain,
      );
      if (next) setViewWindow(isFullyZoomedOut(next, domain) ? null : next);
    }
    dragRef.current = null;
    setIsPanning(false);
    setIsBrushing(false);
    setBrushRange(null);
    try {
      (e.currentTarget as HTMLCanvasElement).releasePointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  }

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
          <div class="history-chart-zoom" role="group" aria-label="Chart controls">
            <button
              type="button"
              class="history-chart-zoom-btn"
              aria-label="Reset zoom"
              disabled={!zoomed}
              onClick={() => setViewWindow(null)}
            >
              Reset
            </button>
            <button
              type="button"
              class="history-chart-zoom-btn history-chart-expand-btn"
              aria-label="Download chart PNG"
              onClick={() => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                downloadCanvasPng(
                  canvas,
                  `thermaltrace-delta-${new Date().toISOString().slice(0, 10)}.png`,
                );
              }}
            >
              PNG
            </button>
            {expanded ? (
              <button
                ref={closeBtnRef}
                type="button"
                class="history-chart-zoom-btn history-chart-expand-btn"
                aria-label="Close expanded chart"
                onClick={() => setExpanded(false)}
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
                onClick={() => {
                  if (wrapRef.current) {
                    setLightboxSlotHeight(wrapRef.current.offsetHeight);
                  }
                  setExpanded(true);
                }}
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
            if (!dragRef.current) clearHover();
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
