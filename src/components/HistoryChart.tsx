import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import {
  brushPixelsToWindow,
  CHART_VIEW_PRESETS,
  collectHoverHits,
  downloadCanvasPng,
  formatAxisTime,
  formatHoverTime,
  isFullyZoomedOut,
  matchingPresetId,
  panTimeWindow,
  presetNarrowsDomain,
  tempToY,
  timeDomainFromPoints,
  timestampToX,
  windowForTrailingSpan,
  xToTimestamp,
  zoomTimeWindow,
  type HoverSeriesHit,
  type PlotBounds,
  type TimeWindow,
} from "../lib/historyChartInteraction";

type Point = {
  timestamp: string;
  tempf: number;
  humidity: number;
  probeLabel: string;
};

interface Props {
  points: Point[];
  priorYearPoints?: Point[];
  priorYearLegend?: string | null;
  housePoints?: Point[];
  houseLegend?: string | null;
  title?: string;
  /** Freeze / low alert line from account settings (°F). */
  freezeThresholdF?: number | null;
  /** Optional default high-temp warning (°F); user can override in the chart. */
  defaultHighTempF?: number | null;
  /** Optional default ambient target (°F). */
  defaultTargetAmbientF?: number | null;
  /** Plot humidity % and dew point on a secondary axis when data exists. */
  showHumidity?: boolean;
}

const PROBE_COLORS = ["#60a5fa", "#34d399", "#f472b6", "#fbbf24", "#a78bfa", "#fb7185"];
const HOUSE_COLOR = "#f59e0b";
const COLOR_BELOW = "#38bdf8";
const COLOR_ABOVE = "#fb923c";
const HUMIDITY_COLOR = "#a78bfa";
const DEW_COLOR = "#2dd4bf";
const STORAGE_HIGH = "tt-chart-high-f";
const STORAGE_TARGET = "tt-chart-target-f";

function dewPointF(tempF: number, rhPct: number): number | null {
  if (!Number.isFinite(tempF) || !Number.isFinite(rhPct) || rhPct <= 0 || rhPct > 100) {
    return null;
  }
  const tC = (tempF - 32) * (5 / 9);
  const a = 17.62;
  const b = 243.12;
  const gamma = Math.log(rhPct / 100) + (a * tC) / (b + tC);
  const tdC = (b * gamma) / (a - gamma);
  if (!Number.isFinite(tdC)) return null;
  return tdC * (9 / 5) + 32;
}

function readStoredNumber(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function writeStoredNumber(key: string, value: number | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
  } catch {
    /* ignore quota / private mode */
  }
}

function segmentColor(
  tempf: number,
  freeze: number | null,
  high: number | null,
  base: string,
): string {
  if (freeze != null && tempf <= freeze) return COLOR_BELOW;
  if (high != null && tempf >= high) return COLOR_ABOVE;
  return base;
}

export default function HistoryChart({
  points,
  priorYearPoints = [],
  priorYearLegend = null,
  housePoints = [],
  houseLegend = "House",
  title = "Temperature trend (last 7 days)",
  freezeThresholdF = null,
  defaultHighTempF = null,
  defaultTargetAmbientF = null,
  showHumidity = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const plotBoundsRef = useRef<PlotBounds | null>(null);
  const probeLabels = useMemo(
    () => [...new Set(points.map((p) => p.probeLabel || "Probe"))],
    [points],
  );

  const [highTempF, setHighTempF] = useState<number | null>(defaultHighTempF);
  const [targetAmbientF, setTargetAmbientF] = useState<number | null>(
    defaultTargetAmbientF,
  );
  const [humidityOn, setHumidityOn] = useState(showHumidity);
  const [hydrated, setHydrated] = useState(false);
  const [visibleProbes, setVisibleProbes] = useState<Set<string>>(
    () => new Set(probeLabels),
  );
  const [hoverTs, setHoverTs] = useState<number | null>(null);
  const [hoverHits, setHoverHits] = useState<HoverSeriesHit[]>([]);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [houseVisible, setHouseVisible] = useState(true);
  const [viewWindow, setViewWindow] = useState<TimeWindow | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isBrushing, setIsBrushing] = useState(false);
  const [brushRange, setBrushRange] = useState<{ startX: number; endX: number } | null>(
    null,
  );
  const [expanded, setExpanded] = useState(false);
  const [lightboxSlotHeight, setLightboxSlotHeight] = useState(0);
  const prevProbeLabelsRef = useRef<string[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const expandBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const wasExpandedRef = useRef(false);
  const dragRef = useRef<{
    kind: "pan" | "brush";
    pointerId: number;
    startX: number;
    startView: TimeWindow;
    shiftKey: boolean;
    brushStartX: number;
    brushEndX: number;
    moved: boolean;
  } | null>(null);
  const viewWindowRef = useRef<TimeWindow | null>(null);
  const domainRef = useRef<TimeWindow | null>(null);

  const domain = useMemo(() => timeDomainFromPoints(points), [points]);
  const activeView = viewWindow && domain ? viewWindow : domain;
  const zoomed =
    !!domain && !!activeView && !isFullyZoomedOut(activeView, domain);
  const activePreset = domain
    ? matchingPresetId(viewWindow, domain)
    : "all";

  useEffect(() => {
    viewWindowRef.current = viewWindow;
  }, [viewWindow]);

  useEffect(() => {
    if (!expanded) {
      if (wasExpandedRef.current) {
        expandBtnRef.current?.focus();
      }
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
    // Remeasure after paint so the taller canvas redraws cleanly.
    requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [expanded]);

  function openLightbox() {
    if (wrapRef.current) {
      setLightboxSlotHeight(wrapRef.current.offsetHeight);
    }
    setExpanded(true);
  }

  function closeLightbox() {
    setExpanded(false);
  }

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
    const prevLabels = prevProbeLabelsRef.current;
    setVisibleProbes((prev) => {
      const next = new Set(prev);
      for (const label of [...next]) {
        if (!probeLabels.includes(label)) next.delete(label);
      }
      for (const label of probeLabels) {
        if (!prevLabels.includes(label)) next.add(label);
      }
      if (next.size === 0) {
        for (const label of probeLabels) next.add(label);
      }
      return next;
    });
    prevProbeLabelsRef.current = probeLabels;
  }, [probeLabels]);

  const humidityPoints = useMemo(() => {
    if (!showHumidity) return [] as Point[];
    const labeled = probeLabels.find((label) =>
      points.some(
        (p) =>
          (p.probeLabel || "Probe") === label &&
          Number.isFinite(p.humidity) &&
          p.humidity > 0,
      ),
    );
    const source = labeled
      ? points.filter((p) => (p.probeLabel || "Probe") === labeled)
      : points;
    return source.filter((p) => Number.isFinite(p.humidity) && p.humidity > 0);
  }, [points, probeLabels, showHumidity]);

  const byProbe = useMemo(() => {
    const map = new Map<string, Point[]>();
    for (const point of points) {
      const label = point.probeLabel || "Probe";
      const list = map.get(label) ?? [];
      list.push(point);
      map.set(label, list);
    }
    return map;
  }, [points]);

  useEffect(() => {
    const storedHigh = readStoredNumber(STORAGE_HIGH);
    const storedTarget = readStoredNumber(STORAGE_TARGET);
    if (storedHigh != null) setHighTempF(storedHigh);
    else if (defaultHighTempF != null) setHighTempF(defaultHighTempF);
    if (storedTarget != null) setTargetAmbientF(storedTarget);
    else if (defaultTargetAmbientF != null) setTargetAmbientF(defaultTargetAmbientF);
    setHydrated(true);
  }, [defaultHighTempF, defaultTargetAmbientF]);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredNumber(STORAGE_HIGH, highTempF);
  }, [highTempF, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredNumber(STORAGE_TARGET, targetAmbientF);
  }, [targetAmbientF, hydrated]);

  const chartSummary = useMemo(() => {
    if (points.length < 2) return "Not enough readings yet for a chart.";
    let min = points[0]!;
    let max = points[0]!;
    let below = 0;
    for (const p of points) {
      if (p.tempf < min.tempf) min = p;
      if (p.tempf > max.tempf) max = p;
      if (freezeThresholdF != null && p.tempf <= freezeThresholdF) below += 1;
    }
    const latest = points[points.length - 1]!;
    const parts = [
      `Latest reading ${latest.tempf.toFixed(1)}°F.`,
      `Range over this period: ${min.tempf.toFixed(1)}°F to ${max.tempf.toFixed(1)}°F.`,
    ];
    if (freezeThresholdF != null) {
      parts.push(
        below > 0
          ? `Dropped to or below the ${freezeThresholdF}°F freeze line in ${below} of ${points.length} readings.`
          : `Stayed above the ${freezeThresholdF}°F freeze line the whole period.`,
      );
    }
    return parts.join(" ");
  }, [points, freezeThresholdF]);

  const hoverLive = useMemo(() => {
    if (!hoverHits.length) return "";
    const when = formatHoverTime(hoverHits[0]!.timestamp);
    const parts = hoverHits.map(
      (h) => `${h.probeLabel} ${h.tempf.toFixed(1)}°F`,
    );
    return `${when}: ${parts.join(", ")}`;
  }, [hoverHits]);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl || points.length < 2) return;

    const ctx = canvasEl.getContext("2d");
    if (!ctx) return;
    const g = ctx;
    const canvas = canvasEl;

    function draw() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);

      const plotHumidity = humidityOn && humidityPoints.length >= 2;

      const pad = {
        top: 16,
        right: plotHumidity ? 40 : 16,
        bottom: 28,
        left: 44,
      };
      const innerW = width - pad.left - pad.right;
      const innerH = height - pad.top - pad.bottom;

      const sortedPoints = [...points].sort(
        (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
      );
      const fullMinTs = Date.parse(sortedPoints[0]!.timestamp);
      const fullMaxTs = Date.parse(sortedPoints[sortedPoints.length - 1]!.timestamp);
      const minTs = activeView?.minTs ?? fullMinTs;
      const maxTs = activeView?.maxTs ?? fullMaxTs;
      const tsRange = maxTs - minTs || 1;
      const inView = (ts: number) => ts >= minTs && ts <= maxTs;

      const guideTemps = [
        freezeThresholdF,
        highTempF,
        targetAmbientF,
      ].filter((v): v is number => v != null && Number.isFinite(v));

      const visiblePoints = points.filter((p) =>
        visibleProbes.has(p.probeLabel || "Probe"),
      );
      const houseForScale =
        houseVisible && housePoints.length >= 2 ? housePoints : [];

      const scaleSource = (
        visiblePoints.length > 0 ? visiblePoints : points
      ).filter((p) => inView(Date.parse(p.timestamp)));
      const houseInView = houseForScale.filter((p) =>
        inView(Date.parse(p.timestamp)),
      );
      const priorInView = priorYearPoints.filter((p) =>
        inView(Date.parse(p.timestamp)),
      );
      const dewInView = plotHumidity
        ? humidityPoints
            .filter((p) => inView(Date.parse(p.timestamp)))
            .map((p) => dewPointF(p.tempf, p.humidity))
            .filter((v): v is number => v != null)
        : [];

      const allTemps = [
        ...(scaleSource.length > 0
          ? scaleSource
          : visiblePoints.length > 0
            ? visiblePoints
            : points
        ).map((p) => p.tempf),
        ...priorInView.map((p) => p.tempf),
        ...houseInView.map((p) => p.tempf),
        ...dewInView,
        ...guideTemps,
      ];
      const min = Math.min(...allTemps) - 2;
      const max = Math.max(...allTemps) + 2;
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

      const yFor = (tempf: number) =>
        pad.top + innerH - ((tempf - min) / range) * innerH;
      const yForRh = (rh: number) =>
        pad.top + innerH - (Math.min(100, Math.max(0, rh)) / 100) * innerH;
      const xFor = (ts: number) =>
        pad.left + ((ts - minTs) / tsRange) * innerW;

      g.clearRect(0, 0, width, height);
      g.fillStyle = "#151b24";
      g.fillRect(0, 0, width, height);

      g.strokeStyle = "rgba(255,255,255,0.06)";
      g.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + (innerH / 4) * i;
        g.beginPath();
        g.moveTo(pad.left, y);
        g.lineTo(width - pad.right, y);
        g.stroke();
        const val = max - (range / 4) * i;
        g.fillStyle = "#94a3b8";
        g.font = "10px system-ui, sans-serif";
        g.textAlign = "right";
        g.fillText(`${val.toFixed(0)}°F`, pad.left - 6, y + 3);
        if (plotHumidity) {
          const rh = 100 - (100 / 4) * i;
          g.textAlign = "left";
          g.fillStyle = HUMIDITY_COLOR;
          g.fillText(`${rh.toFixed(0)}%`, width - pad.right + 6, y + 3);
        }
      }

      function drawGuide(
        tempf: number | null,
        color: string,
        label: string,
        dash: number[],
      ) {
        if (tempf == null || !Number.isFinite(tempf)) return;
        const y = yFor(tempf);
        g.save();
        g.strokeStyle = color;
        g.lineWidth = 1.5;
        g.setLineDash(dash);
        g.beginPath();
        g.moveTo(pad.left, y);
        g.lineTo(width - pad.right, y);
        g.stroke();
        g.setLineDash([]);
        g.fillStyle = color;
        g.font = "10px system-ui, sans-serif";
        g.textAlign = "left";
        g.fillText(`${label} ${tempf.toFixed(0)}°F`, pad.left + 4, y - 4);
        g.restore();
      }

      drawGuide(freezeThresholdF, "rgba(56, 189, 248, 0.9)", "Freeze", [6, 4]);
      drawGuide(targetAmbientF, "rgba(167, 139, 250, 0.85)", "Target", [2, 4]);
      drawGuide(highTempF, "rgba(251, 146, 60, 0.9)", "High", [6, 4]);

      g.save();
      g.beginPath();
      g.rect(pad.left, pad.top, innerW, innerH);
      g.clip();

      function drawSeriesColored(series: Point[], baseColor: string) {
        if (series.length < 2) return;
        const ordered = [...series].sort(
          (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
        );
        for (let i = 1; i < ordered.length; i++) {
          const a = ordered[i - 1]!;
          const b = ordered[i]!;
          const mid = (a.tempf + b.tempf) / 2;
          g.strokeStyle = segmentColor(mid, freezeThresholdF, highTempF, baseColor);
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(xFor(Date.parse(a.timestamp)), yFor(a.tempf));
          g.lineTo(xFor(Date.parse(b.timestamp)), yFor(b.tempf));
          g.stroke();
        }
      }

      function drawSeriesFlat(series: Point[], color: string) {
        if (series.length < 2) return;
        const ordered = [...series].sort(
          (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
        );
        g.strokeStyle = color;
        g.lineWidth = 2;
        g.beginPath();
        ordered.forEach((point, i) => {
          const x = xFor(Date.parse(point.timestamp));
          const y = yFor(point.tempf);
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        });
        g.stroke();
      }

      function drawSeriesDashed(series: Point[], color: string) {
        if (series.length < 2) return;
        const ordered = [...series].sort(
          (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
        );
        g.save();
        g.strokeStyle = color;
        g.lineWidth = 2;
        g.setLineDash([6, 4]);
        g.beginPath();
        ordered.forEach((point, i) => {
          const x = xFor(Date.parse(point.timestamp));
          const y = yFor(point.tempf);
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        });
        g.stroke();
        g.restore();
      }

      if (priorYearPoints.length >= 2) {
        drawSeriesFlat(priorYearPoints, "rgba(148, 163, 184, 0.55)");
      }

      [...byProbe.entries()].forEach(([label, series], index) => {
        if (!visibleProbes.has(label)) return;
        drawSeriesColored(series, PROBE_COLORS[index % PROBE_COLORS.length]!);
      });

      if (houseVisible && housePoints.length >= 2) {
        drawSeriesDashed(housePoints, HOUSE_COLOR);
      }

      if (plotHumidity) {
        const orderedHum = [...humidityPoints].sort(
          (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
        );
        g.save();
        g.strokeStyle = HUMIDITY_COLOR;
        g.lineWidth = 1.5;
        g.globalAlpha = 0.9;
        g.beginPath();
        orderedHum.forEach((point, i) => {
          const x = xFor(Date.parse(point.timestamp));
          const y = yForRh(point.humidity);
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        });
        g.stroke();

        g.strokeStyle = DEW_COLOR;
        g.setLineDash([4, 3]);
        g.beginPath();
        let dewStarted = false;
        for (const point of orderedHum) {
          const dew = dewPointF(point.tempf, point.humidity);
          if (dew == null) continue;
          const x = xFor(Date.parse(point.timestamp));
          const y = yFor(dew);
          if (!dewStarted) {
            g.moveTo(x, y);
            dewStarted = true;
          } else {
            g.lineTo(x, y);
          }
        }
        g.stroke();
        g.restore();
      }

      if (hoverTs != null && hoverHits.length > 0) {
        const lineBounds = plotBoundsRef.current!;
        const lineX = timestampToX(hoverTs, lineBounds);
        g.strokeStyle = "rgba(248, 250, 252, 0.45)";
        g.lineWidth = 1;
        g.setLineDash([3, 3]);
        g.beginPath();
        g.moveTo(lineX, pad.top);
        g.lineTo(lineX, height - pad.bottom);
        g.stroke();
        g.setLineDash([]);

        for (const hit of hoverHits) {
          const hx = timestampToX(Date.parse(hit.timestamp), lineBounds);
          const y = tempToY(hit.tempf, lineBounds);
          g.fillStyle = hit.color;
          g.beginPath();
          g.arc(hx, y, 4.5, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = "#0f172a";
          g.lineWidth = 1.5;
          g.stroke();
        }
      }

      if (brushRange) {
        const left = Math.min(brushRange.startX, brushRange.endX);
        const right = Math.max(brushRange.startX, brushRange.endX);
        const clippedLeft = Math.max(left, pad.left);
        const clippedRight = Math.min(right, width - pad.right);
        if (clippedRight > clippedLeft) {
          g.fillStyle = "rgba(96, 165, 250, 0.18)";
          g.fillRect(clippedLeft, pad.top, clippedRight - clippedLeft, innerH);
          g.strokeStyle = "rgba(147, 197, 253, 0.85)";
          g.lineWidth = 1;
          g.strokeRect(clippedLeft, pad.top, clippedRight - clippedLeft, innerH);
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
    const ro = new ResizeObserver(() => {
      draw();
    });
    ro.observe(canvas);

    const onWheel = (event: WheelEvent) => {
      const currentDomain = domainRef.current;
      if (!currentDomain || !plotBoundsRef.current) return;
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const anchor =
        xToTimestamp(x, plotBoundsRef.current) ??
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
  }, [
    points,
    priorYearPoints,
    housePoints,
    freezeThresholdF,
    highTempF,
    targetAmbientF,
    humidityOn,
    humidityPoints,
    visibleProbes,
    houseVisible,
    byProbe,
    hoverTs,
    hoverHits,
    activeView,
    brushRange,
  ]);

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
    // Presets longer than the loaded series cannot change the viewport.
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
    downloadCanvasPng(canvas, `thermaltrace-chart-${stamp}.png`);
  }

  function updateHoverFromClientX(clientX: number, clientY: number) {
    const canvas = canvasRef.current;
    const bounds = plotBoundsRef.current;
    if (!canvas || !bounds) return;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const ts = xToTimestamp(x, bounds);
    if (ts == null) {
      clearHover();
      return;
    }

    const hits = collectHoverHits({
      targetTs: ts,
      byProbe,
      probeColors: PROBE_COLORS,
      visibleProbes,
      housePoints: houseVisible && housePoints.length >= 2 ? housePoints : [],
      houseLegend,
      houseColor: HOUSE_COLOR,
      dewPointF: humidityOn ? dewPointF : undefined,
    });

    const snapTs = hits[0] ? Date.parse(hits[0].timestamp) : ts;
    setHoverTs(snapTs);
    setHoverHits(hits);

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    setTooltipPos({
      x: Math.min(Math.max(localX + 12, 8), Math.max(8, rect.width - 188)),
      y: Math.min(Math.max(localY - 8, 8), Math.max(8, rect.height - 8)),
    });
  }

  function clearHover() {
    setHoverTs(null);
    setHoverHits([]);
    setTooltipPos(null);
  }

  function canvasLocalX(clientX: number): number {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    return clientX - canvas.getBoundingClientRect().left;
  }

  function onCanvasPointerDown(e: {
    clientX: number;
    clientY: number;
    pointerId: number;
    shiftKey: boolean;
    currentTarget: EventTarget;
  }) {
    updateHoverFromClientX(e.clientX, e.clientY);
    if (!domain || !activeView) return;
    const canvas = e.currentTarget as HTMLCanvasElement;
    canvas.setPointerCapture?.(e.pointerId);
    const useBrush = e.shiftKey || !zoomed;
    const localX = canvasLocalX(e.clientX);
    dragRef.current = {
      kind: useBrush ? "brush" : "pan",
      pointerId: e.pointerId,
      startX: e.clientX,
      startView: activeView,
      shiftKey: e.shiftKey,
      brushStartX: localX,
      brushEndX: localX,
      moved: false,
    };
    if (useBrush) {
      setBrushRange({ startX: localX, endX: localX });
      setIsBrushing(false);
    }
  }

  function onCanvasPointerMove(e: {
    clientX: number;
    clientY: number;
    pointerId: number;
  }) {
    const drag = dragRef.current;
    if (drag && drag.pointerId === e.pointerId && domain && plotBoundsRef.current) {
      const dx = e.clientX - drag.startX;
      if (drag.kind === "brush") {
        if (!drag.moved && Math.abs(dx) < 5) {
          updateHoverFromClientX(e.clientX, e.clientY);
          return;
        }
        drag.moved = true;
        drag.brushEndX = canvasLocalX(e.clientX);
        setIsBrushing(true);
        setBrushRange({
          startX: drag.brushStartX,
          endX: drag.brushEndX,
        });
        clearHover();
        return;
      }

      if (!isPanning && Math.abs(dx) < 5) {
        updateHoverFromClientX(e.clientX, e.clientY);
        return;
      }
      if (!isPanning) setIsPanning(true);
      const bounds = plotBoundsRef.current;
      const innerW = bounds.width - bounds.padLeft - bounds.padRight;
      const span = drag.startView.maxTs - drag.startView.minTs || 1;
      const deltaTs = -(dx / Math.max(innerW, 1)) * span;
      setViewWindow(panTimeWindow(drag.startView, domain, deltaTs));
      clearHover();
      return;
    }
    updateHoverFromClientX(e.clientX, e.clientY);
  }

  function onCanvasPointerUp(e: {
    clientX: number;
    pointerId: number;
    currentTarget: EventTarget;
  }) {
    const drag = dragRef.current;
    if (drag?.pointerId === e.pointerId) {
      if (drag.kind === "brush" && drag.moved && domain && plotBoundsRef.current) {
        const next = brushPixelsToWindow(
          drag.brushStartX,
          drag.brushEndX,
          plotBoundsRef.current,
          domain,
        );
        if (next) {
          setViewWindow(isFullyZoomedOut(next, domain) ? null : next);
        }
      }
      dragRef.current = null;
      setIsPanning(false);
      setIsBrushing(false);
      setBrushRange(null);
      try {
        (e.currentTarget as HTMLCanvasElement).releasePointerCapture?.(e.pointerId);
      } catch {
        /* already released */
      }
    }
  }

  function toggleProbe(label: string) {
    setVisibleProbes((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        if (next.size <= 1) return prev;
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }

  if (points.length < 2) {
    return (
      <div class="history-chart-wrap">
        <p class="history-chart-title m-0">{title}</p>
        <p class="m-0 text-sm text-[var(--color-text-muted)]">
          Not enough readings yet for a chart.
        </p>
        <p class="mt-3 mb-0 text-sm">
          <a class="text-link" href="/dashboard/temperature">Add a device</a>
          {" → "}
          verify ingest
          {" → "}
          <a class="text-link" href="/">open Home</a>
          {" "}so snapshots can collect.
        </p>
      </div>
    );
  }

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
            aria-label="Zoom in"
            onClick={() => applyZoom(1 / 1.35)}
          >
            +
          </button>
          <button
            type="button"
            class="history-chart-zoom-btn"
            aria-label="Zoom out"
            onClick={() => applyZoom(1.35)}
            disabled={!zoomed}
          >
            −
          </button>
          <button
            type="button"
            class="history-chart-zoom-btn"
            aria-label="Reset zoom"
            onClick={resetZoom}
            disabled={!zoomed}
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
          const domainSpan = domain ? domain.maxTs - domain.minTs : 0;
          const canNarrow = domain ? presetNarrowsDomain(domain, preset.spanMs) : false;
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
              title={
                !domain
                  ? undefined
                  : canNarrow
                    ? `Show last ${preset.label}`
                    : isCurrentWindow
                      ? `Already showing about ${preset.label} of loaded data`
                      : `Only ${Math.max(1, Math.round(domainSpan / 36e5))}h loaded here — open History for a longer range`
              }
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
      {domain && !presetNarrowsDomain(domain, 7 * 24 * 60 * 60 * 1000) && (
        <p class="m-0 mb-2 text-xs text-[var(--color-text-muted)]">
          Loaded window is about{" "}
          {Math.max(1, Math.round((domain.maxTs - domain.minTs) / 36e5))}h.
          {domain.maxTs - domain.minTs < 30 * 24 * 60 * 60 * 1000 - 36e5 && (
            <>
              {" "}
              <a class="text-link" href="/dashboard/history">Open History</a> for 30-day views.
            </>
          )}
        </p>
      )}
      {(probeLabels.length > 0 || housePoints.length >= 2) && (
        <div class="history-chart-legend" role="group" aria-label="Series visibility">
          {probeLabels.map((label, i) => {
            const on = visibleProbes.has(label);
            return (
              <button
                key={label}
                type="button"
                class={`history-chart-legend-btn${on ? " is-on" : ""}`}
                style={{ "--legend-color": PROBE_COLORS[i % PROBE_COLORS.length] } as never}
                aria-pressed={on}
                onClick={() => toggleProbe(label)}
              >
                {label}
              </button>
            );
          })}
          {housePoints.length >= 2 && (
            <button
              type="button"
              class={`history-chart-legend-btn${houseVisible ? " is-on" : ""}`}
              style={{ "--legend-color": HOUSE_COLOR } as never}
              aria-pressed={houseVisible}
              onClick={() => setHouseVisible((v) => !v)}
            >
              {houseLegend ?? "House"}
            </button>
          )}
        </div>
      )}
      {priorYearPoints.length >= 2 && (
        <p class="m-0 mb-2 text-xs text-[var(--color-text-muted)]">
          {priorYearLegend ?? "Gray = comparison overlay"}
        </p>
      )}
      {humidityOn && humidityPoints.length >= 2 && (
        <p class="m-0 mb-2 text-xs text-[var(--color-text-muted)]">
          <span style={{ color: HUMIDITY_COLOR }}>Humidity %</span>
          {" · "}
          <span style={{ color: DEW_COLOR }}>dew point °F</span> (dashed)
        </p>
      )}
      <p class="m-0 mb-2 text-xs text-[var(--color-text-muted)]">
        {expanded
          ? "Expanded view — drag to select a range, scroll to zoom, Esc or Close to exit."
          : "Drag to select a range (Shift+drag when zoomed), scroll to zoom, PNG to save."}{" "}
        Trace turns <span style={{ color: COLOR_BELOW }}>cool</span> at/below freeze
        and <span style={{ color: COLOR_ABOVE }}>warm</span> at/above the high line.
      </p>
      <div
        class="history-chart-canvas-wrap"
        onPointerLeave={() => {
          if (!dragRef.current) clearHover();
        }}
        onPointerCancel={() => {
          dragRef.current = null;
          setIsPanning(false);
          clearHover();
        }}
      >
        <canvas
          ref={canvasRef}
          class={`w-full history-chart-canvas${zoomed ? " is-zoomed" : ""}${isPanning ? " is-panning" : ""}${isBrushing ? " is-brushing" : ""}`}
          role="img"
          aria-label={`Interactive line chart of ${title}. Drag to select a range, scroll to zoom, expand for a larger view.`}
          aria-describedby="history-chart-summary"
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onCanvasPointerMove}
          onPointerUp={onCanvasPointerUp}
          onDblClick={resetZoom}
        />
        {tooltipPos && hoverHits.length > 0 && !isPanning && (
          <div
            class="history-chart-tooltip"
            style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
            role="status"
          >
            <p class="history-chart-tooltip-time">
              {formatHoverTime(hoverHits[0]!.timestamp)}
            </p>
            <ul class="history-chart-tooltip-list">
              {hoverHits.map((hit) => (
                <li key={hit.probeLabel}>
                  <span
                    class="history-chart-tooltip-swatch"
                    style={{ background: hit.color }}
                  />
                  <span class="history-chart-tooltip-label">{hit.probeLabel}</span>
                  <span class="history-chart-tooltip-value">
                    {hit.tempf.toFixed(1)}°F
                    {humidityOn &&
                      Number.isFinite(hit.humidity) &&
                      hit.humidity > 0 &&
                      ` · ${hit.humidity.toFixed(0)}%`}
                    {hit.dewPointF != null &&
                      ` · dew ${hit.dewPointF.toFixed(1)}°F`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <p id="history-chart-summary" class="sr-only">{chartSummary}</p>
      <p class="sr-only" aria-live="polite">
        {hoverLive}
      </p>
      <form
        class="chart-threshold-controls"
        onSubmit={(e) => e.preventDefault()}
      >
        <label class="chart-threshold-field">
          <span>Target ambient (°F)</span>
          <input
            type="number"
            step="0.5"
            class="form-input"
            value={targetAmbientF ?? ""}
            placeholder="Optional"
            onInput={(e) => {
              const v = (e.target as HTMLInputElement).value;
              setTargetAmbientF(v === "" ? null : Number(v));
            }}
          />
        </label>
        <label class="chart-threshold-field">
          <span>High warning (°F)</span>
          <input
            type="number"
            step="0.5"
            class="form-input"
            value={highTempF ?? ""}
            placeholder="Optional"
            onInput={(e) => {
              const v = (e.target as HTMLInputElement).value;
              setHighTempF(v === "" ? null : Number(v));
            }}
          />
        </label>
        {showHumidity && humidityPoints.length >= 2 && (
          <label class="chart-threshold-field chart-threshold-check">
            <span>Humidity + dew</span>
            <input
              type="checkbox"
              checked={humidityOn}
              onChange={(e) =>
                setHumidityOn((e.target as HTMLInputElement).checked)
              }
            />
          </label>
        )}
        {freezeThresholdF != null && (
          <p class="chart-threshold-note mb-0">
            Freeze line from alerts: {freezeThresholdF}°F
          </p>
        )}
      </form>
      </div>
    </>
  );
}
