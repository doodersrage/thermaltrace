import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { RefObject } from "preact";
import {
  brushPixelsToWindow,
  downloadCanvasPng,
  isFullyZoomedOut,
  matchingPresetId,
  panTimeWindow,
  presetNarrowsDomain,
  timeDomainFromPoints,
  windowForTrailingSpan,
  xToTimestamp,
  zoomTimeWindow,
  type PlotBounds,
  type TimeWindow,
  type ChartViewPresetId,
} from "./historyChartInteraction";

type HoverHandlers = {
  updateHover: (clientX: number, clientY: number) => void;
  clearHover: () => void;
};

/**
 * Shared brush / pan / zoom / presets / lightbox / PNG for History + ΔT charts.
 * Hosts still own canvas drawing and hover semantics.
 */
export function useHistoryChartInteraction(options: {
  points: Array<{ timestamp: string }>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  wrapRef: RefObject<HTMLDivElement | null>;
  /** Host may supply this so hover handlers can close over it before the hook runs. */
  plotBoundsRef?: RefObject<PlotBounds | null>;
  pngFilenamePrefix?: string;
  hover: HoverHandlers;
  /** Optional initial preset restored from prefs once domain is ready. */
  initialPresetId?: ChartViewPresetId | "all" | null;
  onPresetChange?: (presetId: ChartViewPresetId | "all" | "custom") => void;
}) {
  const {
    points,
    canvasRef,
    wrapRef,
    pngFilenamePrefix = "thermaltrace-chart",
    hover,
    initialPresetId = null,
    onPresetChange,
  } = options;

  const internalPlotBoundsRef = useRef<PlotBounds | null>(null);
  const plotBoundsRef = options.plotBoundsRef ?? internalPlotBoundsRef;
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
  const initialPresetAppliedRef = useRef(false);
  const hoverRef = useRef(hover);
  hoverRef.current = hover;
  const onPresetChangeRef = useRef(onPresetChange);
  onPresetChangeRef.current = onPresetChange;

  const [viewWindow, setViewWindow] = useState<TimeWindow | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [lightboxSlotHeight, setLightboxSlotHeight] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [isBrushing, setIsBrushing] = useState(false);
  const [brushRange, setBrushRange] = useState<{ startX: number; endX: number } | null>(
    null,
  );
  const setViewWindowRef = useRef(setViewWindow);
  setViewWindowRef.current = setViewWindow;

  const domain = useMemo(() => timeDomainFromPoints(points), [points]);
  const activeView = viewWindow && domain ? viewWindow : domain;
  const zoomed =
    !!domain && !!activeView && !isFullyZoomedOut(activeView, domain);
  const activePreset = domain ? matchingPresetId(viewWindow, domain) : "all";

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
    if (!domain || initialPresetAppliedRef.current || !initialPresetId) return;
    initialPresetAppliedRef.current = true;
    if (initialPresetId === "all") {
      setViewWindow(null);
      return;
    }
    const presetSpan =
      initialPresetId === "24h"
        ? 24 * 60 * 60 * 1000
        : initialPresetId === "7d"
          ? 7 * 24 * 60 * 60 * 1000
          : 30 * 24 * 60 * 60 * 1000;
    if (!presetNarrowsDomain(domain, presetSpan)) {
      setViewWindow(null);
      return;
    }
    const next = windowForTrailingSpan(domain, presetSpan);
    setViewWindow(isFullyZoomedOut(next, domain) ? null : next);
  }, [domain, initialPresetId]);

  useEffect(() => {
    onPresetChangeRef.current?.(activePreset);
  }, [activePreset]);

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

  function openLightbox() {
    if (wrapRef.current) setLightboxSlotHeight(wrapRef.current.offsetHeight);
    setExpanded(true);
  }

  function closeLightbox() {
    setExpanded(false);
  }

  function canvasLocalX(clientX: number): number {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    return clientX - canvas.getBoundingClientRect().left;
  }

  function applyZoom(factor: number) {
    if (!domain) return;
    const currentView = viewWindow ?? domain;
    const anchor = (currentView.minTs + currentView.maxTs) / 2;
    const next = zoomTimeWindow(currentView, domain, anchor, factor);
    setViewWindow(isFullyZoomedOut(next, domain) ? null : next);
  }

  function resetZoom() {
    setViewWindow(null);
    dragRef.current = null;
    setIsPanning(false);
    setIsBrushing(false);
    setBrushRange(null);
  }

  function applyPreset(spanMs: number | null) {
    if (!domain) return;
    if (spanMs == null) {
      resetZoom();
      return;
    }
    if (!presetNarrowsDomain(domain, spanMs)) {
      resetZoom();
      return;
    }
    const next = windowForTrailingSpan(domain, spanMs);
    setViewWindow(isFullyZoomedOut(next, domain) ? null : next);
  }

  function exportPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCanvasPng(canvas, `${pngFilenamePrefix}-${stamp}.png`);
  }

  function onPointerDown(e: {
    clientX: number;
    clientY: number;
    pointerId: number;
    shiftKey: boolean;
    currentTarget: EventTarget;
  }) {
    hoverRef.current.updateHover(e.clientX, e.clientY);
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
          hoverRef.current.updateHover(e.clientX, e.clientY);
          return;
        }
        drag.moved = true;
        drag.brushEndX = canvasLocalX(e.clientX);
        setIsBrushing(true);
        setBrushRange({ startX: drag.brushStartX, endX: drag.brushEndX });
        hoverRef.current.clearHover();
        return;
      }
      if (!isPanning && Math.abs(dx) < 5) {
        hoverRef.current.updateHover(e.clientX, e.clientY);
        return;
      }
      if (!isPanning) setIsPanning(true);
      const bounds = plotBoundsRef.current;
      const innerW = bounds.width - bounds.padLeft - bounds.padRight;
      const span = drag.startView.maxTs - drag.startView.minTs || 1;
      setViewWindow(
        panTimeWindow(drag.startView, domain, -(dx / Math.max(innerW, 1)) * span),
      );
      hoverRef.current.clearHover();
      return;
    }
    hoverRef.current.updateHover(e.clientX, e.clientY);
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

  /** Attach wheel zoom; call from the host draw effect. Stable identity. */
  const bindWheelZoom = useCallback((canvas: HTMLCanvasElement): (() => void) => {
    const onWheel = (event: WheelEvent) => {
      if (!domainRef.current || !plotBoundsRef.current) return;
      event.preventDefault();
      const currentDomain = domainRef.current;
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const anchor =
        xToTimestamp(x, plotBoundsRef.current) ??
        (currentDomain.minTs + currentDomain.maxTs) / 2;
      const currentView = viewWindowRef.current ?? currentDomain;
      const factor = event.deltaY > 0 ? 1.18 : 1 / 1.18;
      const next = zoomTimeWindow(currentView, currentDomain, anchor, factor);
      setViewWindowRef.current(
        isFullyZoomedOut(next, currentDomain) ? null : next,
      );
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [plotBoundsRef]);

  return {
    domain,
    viewWindow,
    setViewWindow,
    activeView,
    zoomed,
    activePreset,
    plotBoundsRef,
    viewWindowRef,
    domainRef,
    expanded,
    lightboxSlotHeight,
    openLightbox,
    closeLightbox,
    expandBtnRef,
    closeBtnRef,
    isPanning,
    isBrushing,
    brushRange,
    applyZoom,
    applyPreset,
    resetZoom,
    exportPng,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    bindWheelZoom,
  };
}
