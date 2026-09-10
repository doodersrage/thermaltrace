import { useEffect, useRef } from "preact/hooks";
import {
  applyProbeNoise,
  computeDemoProbes,
  defaultDemoControls,
  type DemoControls,
  type DemoProbe,
} from "../lib/probeDemo";

const COLORS = {
  bgTop: "#0f1319",
  bgBottom: "#090b0f",
  surface: "#1a2230",
  surfaceRaised: "#222b3a",
  accent: "#ff7a00",
  accentBright: "#ffc107",
  text: "#f8fafc",
  textMuted: "#94a3b8",
  border: "rgba(255,255,255,0.12)",
  plum: "#1e293b",
};

type ProbeNode = {
  x: number;
  y: number;
  label: string;
  key: string;
};

const PROBE_NODES: ProbeNode[] = [
  { x: 0.28, y: 0.58, label: "North wall", key: "0" },
  { x: 0.48, y: 0.68, label: "Door zone", key: "1" },
  { x: 0.72, y: 0.52, label: "Workbench", key: "2" },
];

function tempColor(tempF: number): string {
  const t = Math.min(1, Math.max(0, (tempF - 34) / 28));
  const r = Math.round(37 + t * (96 - 37));
  const g = Math.round(99 + t * (165 - 99));
  const b = Math.round(235 + t * (250 - 235));
  return `rgb(${r}, ${g}, ${b})`;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export default function AboutProbeActivity() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    reducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let lastTick = 0;
    let start = performance.now();

    let controls: DemoControls = {
      ...defaultDemoControls,
      outdoorF: 42,
      sunIntensity: 35,
      doorOpen: false,
    };
    let doorProgress = 0;
    let probes: DemoProbe[] = computeDemoProbes(controls);
    const sparkHistory: number[][] = PROBE_NODES.map(() => []);

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(rect.width, 320);
      height = Math.max(rect.height, 380);
      canvas!.width = Math.round(width * dpr);
      canvas!.height = Math.round(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawBackgroundPattern() {
      const dotStep = 28;
      ctx!.fillStyle = "rgba(148, 163, 184, 0.06)";
      for (let x = 0; x < width; x += dotStep) {
        for (let y = 0; y < height; y += dotStep) {
          ctx!.beginPath();
          ctx!.arc(x + 1, y + 1, 1, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      const topGlow = ctx!.createRadialGradient(
        width * 0.5,
        0,
        0,
        width * 0.5,
        0,
        width * 0.65,
      );
      topGlow.addColorStop(0, "rgba(59, 130, 246, 0.14)");
      topGlow.addColorStop(1, "rgba(59, 130, 246, 0)");
      ctx!.fillStyle = topGlow;
      ctx!.fillRect(0, 0, width, height * 0.55);
    }

    function getSceneControls(elapsed: number): DemoControls {
      if (reducedMotionRef.current) {
        return { ...defaultDemoControls, outdoorF: 44, sunIntensity: 40, doorOpen: false };
      }

      const cycle = elapsed % 28000;
      const doorOpen = cycle > 11000 && cycle < 17000;
      const doorAnim = doorOpen
        ? Math.min(1, (cycle - 11000) / 1200)
        : cycle >= 17000
          ? Math.max(0, 1 - (cycle - 17000) / 1200)
          : 0;

      doorProgress = doorAnim;

      return {
        ...defaultDemoControls,
        outdoorF: 38 + Math.sin(elapsed / 22000) * 6,
        sunIntensity: 22 + (0.5 + 0.5 * Math.sin(elapsed / 9000)) * 48,
        doorOpen: doorAnim > 0.5,
      };
    }

    function tickReadings(now: number) {
      if (now - lastTick < 2000) return;
      lastTick = now;
      const { probes: noisy } = applyProbeNoise(computeDemoProbes(controls));
      probes = noisy;
      probes.forEach((probe, i) => {
        sparkHistory[i].push(probe.reading.f);
        if (sparkHistory[i].length > 24) sparkHistory[i].shift();
      });
    }

    function drawSun(intensity: number) {
      const sunX = width * 0.86;
      const sunY = height * 0.14;
      const radius = 24 + intensity * 0.2;

      const corona = ctx!.createRadialGradient(sunX, sunY, 0, sunX, sunY, radius * 3.2);
      corona.addColorStop(0, `rgba(96, 165, 250, ${0.45 + intensity * 0.004})`);
      corona.addColorStop(0.45, `rgba(59, 130, 246, ${0.18 + intensity * 0.003})`);
      corona.addColorStop(1, "rgba(59, 130, 246, 0)");
      ctx!.fillStyle = corona;
      ctx!.beginPath();
      ctx!.arc(sunX, sunY, radius * 3.2, 0, Math.PI * 2);
      ctx!.fill();

      const core = ctx!.createRadialGradient(
        sunX - radius * 0.25,
        sunY - radius * 0.25,
        radius * 0.15,
        sunX,
        sunY,
        radius,
      );
      core.addColorStop(0, "#ffe8c8");
      core.addColorStop(0.55, COLORS.accentBright);
      core.addColorStop(1, COLORS.accent);
      ctx!.fillStyle = core;
      ctx!.beginPath();
      ctx!.arc(sunX, sunY, radius, 0, Math.PI * 2);
      ctx!.fill();

      if (!reducedMotionRef.current) {
        ctx!.strokeStyle = `rgba(255, 193, 7, ${0.25 + intensity * 0.004})`;
        ctx!.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const angle = (elapsedRayAngle(start) + i * Math.PI) / 4;
          const inner = radius + 8;
          const outer = radius + 20 + intensity * 0.08;
          ctx!.beginPath();
          ctx!.moveTo(sunX + Math.cos(angle) * inner, sunY + Math.sin(angle) * inner);
          ctx!.lineTo(sunX + Math.cos(angle) * outer, sunY + Math.sin(angle) * outer);
          ctx!.stroke();
        }
      }

      ctx!.fillStyle = COLORS.textMuted;
      ctx!.font = "600 11px system-ui, sans-serif";
      ctx!.textAlign = "center";
      ctx!.fillText(`Sun load ${Math.round(intensity)}%`, sunX, sunY + radius + 24);
    }

    function elapsedRayAngle(t0: number) {
      return (performance.now() - t0) / 1200;
    }

    function drawGarage(doorAmount: number, outdoorF: number) {
      const gx = width * 0.1;
      const gy = height * 0.22;
      const gw = width * 0.72;
      const gh = height * 0.42;
      const doorW = gw * 0.34;
      const doorH = gh * 0.72;

      const sky = ctx!.createLinearGradient(0, 0, 0, gy + gh * 0.35);
      sky.addColorStop(0, "#182030");
      sky.addColorStop(1, COLORS.bgTop);
      ctx!.fillStyle = sky;
      ctx!.fillRect(0, 0, width, gy + gh * 0.35);

      const slab = ctx!.createLinearGradient(gx, gy + gh, gx, gy + gh + 28);
      slab.addColorStop(0, "rgba(255,255,255,0.04)");
      slab.addColorStop(1, "rgba(255,255,255,0)");
      ctx!.fillStyle = slab;
      ctx!.fillRect(gx - 8, gy + gh - 4, gw + 16, 32);

      const interior = ctx!.createLinearGradient(gx, gy, gx, gy + gh);
      interior.addColorStop(0, COLORS.surfaceRaised);
      interior.addColorStop(1, COLORS.surface);
      ctx!.fillStyle = interior;
      drawRoundedRect(ctx!, gx, gy, gw, gh, 12);
      ctx!.fill();

      ctx!.strokeStyle = "rgba(59, 130, 246, 0.25)";
      ctx!.lineWidth = 1.5;
      ctx!.stroke();
      ctx!.strokeStyle = COLORS.border;
      ctx!.lineWidth = 1;
      ctx!.stroke();

      ctx!.fillStyle = COLORS.textMuted;
      ctx!.font = "600 13px system-ui, sans-serif";
      ctx!.textAlign = "left";
      ctx!.fillText("Bay interior", gx + 16, gy + 24);

      const doorLift = doorAmount * doorH * 0.82;
      const doorX = gx + 16;
      const doorY = gy + gh - doorH - 12 + doorLift;

      if (doorAmount > 0.05) {
        const coldAir = ctx!.createLinearGradient(gx, gy, gx + 24, gy);
        coldAir.addColorStop(0, tempColor(outdoorF));
        coldAir.addColorStop(1, "rgba(59, 130, 246, 0)");
        ctx!.fillStyle = coldAir;
        ctx!.fillRect(gx, gy, 48, gh);
      }

      ctx!.fillStyle = `rgba(59, 130, 246, ${0.05 + doorAmount * 0.12})`;
      ctx!.fillRect(gx + 1, gy + 1, gw - 2, gh - 2);

      const doorGrad = ctx!.createLinearGradient(doorX, doorY, doorX + doorW, doorY);
      doorGrad.addColorStop(0, lerpColor(doorAmount, "#2a3444", "#3d4d66"));
      doorGrad.addColorStop(1, lerpColor(doorAmount, "#222b3a", "#334155"));
      ctx!.fillStyle = doorGrad;
      drawRoundedRect(ctx!, doorX, doorY, doorW, doorH - doorLift, 8);
      ctx!.fill();
      ctx!.strokeStyle = "rgba(255, 255, 255, 0.14)";
      ctx!.lineWidth = 1.5;
      ctx!.stroke();

      for (let i = 0; i < 4; i++) {
        const ly = doorY + 18 + i * ((doorH - doorLift - 28) / 3);
        ctx!.strokeStyle = "rgba(255, 255, 255, 0.1)";
        ctx!.beginPath();
        ctx!.moveTo(doorX + 10, ly);
        ctx!.lineTo(doorX + doorW - 10, ly);
        ctx!.stroke();
      }

      if (doorAmount > 0.05) {
        ctx!.fillStyle = tempColor(outdoorF);
        ctx!.fillRect(gx, gy, 10, gh);
        ctx!.fillStyle = COLORS.textMuted;
        ctx!.font = "500 10px system-ui, sans-serif";
        ctx!.save();
        ctx!.translate(gx + 5, gy + gh / 2);
        ctx!.rotate(-Math.PI / 2);
        ctx!.textAlign = "center";
        ctx!.fillText(`${Math.round(outdoorF)}°F outside`, 0, 0);
        ctx!.restore();
      }

      return { gx, gy, gw, gh };
    }

    function lerpColor(t: number, a: string, b: string): string {
      return t > 0.5 ? b : a;
    }

    function drawProbeNode(
      node: ProbeNode,
      probe: DemoProbe | undefined,
      pulse: number,
      garage: { gx: number; gy: number; gw: number; gh: number },
    ) {
      const x = garage.gx + garage.gw * node.x;
      const y = garage.gy + garage.gh * node.y;
      const tempF = probe?.reading.f ?? 45;
      const humidity = probe?.reading.h ?? 50;

      if (!reducedMotionRef.current) {
        const ring = 18 + pulse * 12;
        ctx!.strokeStyle = `rgba(96, 165, 250, ${0.5 - pulse * 0.28})`;
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        ctx!.arc(x, y, ring, 0, Math.PI * 2);
        ctx!.stroke();
      }

      const probeGlow = ctx!.createRadialGradient(x, y, 0, x, y, 14);
      probeGlow.addColorStop(0, tempColor(tempF));
      probeGlow.addColorStop(1, "rgba(59, 130, 246, 0)");
      ctx!.fillStyle = probeGlow;
      ctx!.beginPath();
      ctx!.arc(x, y, 14, 0, Math.PI * 2);
      ctx!.fill();

      ctx!.fillStyle = tempColor(tempF);
      ctx!.beginPath();
      ctx!.arc(x, y, 9, 0, Math.PI * 2);
      ctx!.fill();
      ctx!.strokeStyle = COLORS.text;
      ctx!.lineWidth = 2;
      ctx!.stroke();

      const cardW = 108;
      const cardH = 52;
      const cardX = x - cardW / 2;
      const cardY = y - 58;

      ctx!.fillStyle = "rgba(21, 27, 36, 0.92)";
      drawRoundedRect(ctx!, cardX, cardY, cardW, cardH, 8);
      ctx!.fill();
      ctx!.strokeStyle = "rgba(59, 130, 246, 0.22)";
      ctx!.lineWidth = 1;
      ctx!.stroke();

      ctx!.fillStyle = COLORS.textMuted;
      ctx!.font = "600 10px system-ui, sans-serif";
      ctx!.textAlign = "center";
      ctx!.fillText(node.label, x, cardY + 16);

      ctx!.font = "700 14px system-ui, sans-serif";
      ctx!.fillStyle = COLORS.accentBright;
      ctx!.fillText(`${tempF.toFixed(1)}°F`, x, cardY + 34);

      ctx!.font = "500 10px system-ui, sans-serif";
      ctx!.fillStyle = COLORS.textMuted;
      ctx!.fillText(`${humidity.toFixed(0)}% RH`, x, cardY + 46);
    }

    function drawProbeLinks(
      garage: { gx: number; gy: number; gw: number; gh: number },
      sparkY: number,
    ) {
      PROBE_NODES.forEach((node, i) => {
        const x = garage.gx + garage.gw * node.x;
        const y = garage.gy + garage.gh * node.y;
        const sparkW = (width * 0.72 - 24) / 3;
        const sparkX0 = width * 0.12;
        const targetX = sparkX0 + i * (sparkW + 8) + sparkW / 2;
        const targetY = sparkY;

        ctx!.strokeStyle = "rgba(59, 130, 246, 0.18)";
        ctx!.lineWidth = 1.5;
        ctx!.setLineDash([5, 6]);
        ctx!.beginPath();
        ctx!.moveTo(x, y + 12);
        ctx!.quadraticCurveTo(x, targetY - 30, targetX, targetY);
        ctx!.stroke();
        ctx!.setLineDash([]);
      });
    }

    function drawSparkline(
      history: number[],
      x: number,
      y: number,
      w: number,
      h: number,
      label: string,
    ) {
      ctx!.fillStyle = "rgba(21, 27, 36, 0.94)";
      drawRoundedRect(ctx!, x, y, w, h, 8);
      ctx!.fill();
      ctx!.strokeStyle = "rgba(59, 130, 246, 0.18)";
      ctx!.lineWidth = 1;
      ctx!.stroke();

      ctx!.fillStyle = COLORS.textMuted;
      ctx!.font = "600 9px system-ui, sans-serif";
      ctx!.textAlign = "left";
      ctx!.fillText(label, x + 8, y + 14);

      if (history.length < 2) return;

      const min = Math.min(...history) - 1;
      const max = Math.max(...history) + 1;
      const range = max - min || 1;
      const padX = 8;
      const padY = 6;
      const innerW = w - padX * 2;
      const innerH = h - 24;

      ctx!.strokeStyle = COLORS.accentBright;
      ctx!.lineWidth = 2;
      ctx!.shadowColor = "rgba(59, 130, 246, 0.45)";
      ctx!.shadowBlur = 6;
      ctx!.beginPath();
      history.forEach((val, i) => {
        const px = x + padX + (i / (history.length - 1)) * innerW;
        const py = y + 20 + padY + innerH - ((val - min) / range) * innerH;
        if (i === 0) ctx!.moveTo(px, py);
        else ctx!.lineTo(px, py);
      });
      ctx!.stroke();
      ctx!.shadowBlur = 0;

      const last = history[history.length - 1];
      const lastX = x + padX + innerW;
      const lastY =
        y + 20 + padY + innerH - ((last - min) / range) * innerH;
      ctx!.fillStyle = COLORS.accentBright;
      ctx!.beginPath();
      ctx!.arc(lastX, lastY, 3, 0, Math.PI * 2);
      ctx!.fill();
    }

    function drawDataPulse(elapsed: number) {
      const pulseX = width * 0.1;
      const pulseY = height * 0.91;
      const pulseW = width * 0.8;

      const track = ctx!.createLinearGradient(pulseX, pulseY, pulseX + pulseW, pulseY);
      track.addColorStop(0, "rgba(59, 130, 246, 0.05)");
      track.addColorStop(0.5, "rgba(59, 130, 246, 0.12)");
      track.addColorStop(1, "rgba(59, 130, 246, 0.05)");
      ctx!.fillStyle = track;
      drawRoundedRect(ctx!, pulseX, pulseY - 4, pulseW, 22, 11);
      ctx!.fill();

      ctx!.fillStyle = COLORS.textMuted;
      ctx!.font = "600 11px system-ui, sans-serif";
      ctx!.textAlign = "left";
      ctx!.fillText("JSON feed → website dashboard", pulseX, pulseY - 10);

      const dotCount = 6;
      for (let i = 0; i < dotCount; i++) {
        const progress = (elapsed / 1600 + i / dotCount) % 1;
        const dx = pulseX + 12 + progress * (pulseW - 24);
        const alpha = progress < 0.88 ? 0.95 : (1 - progress) * 8;
        const glow = ctx!.createRadialGradient(dx, pulseY + 8, 0, dx, pulseY + 8, 10);
        glow.addColorStop(0, `rgba(96, 165, 250, ${alpha})`);
        glow.addColorStop(1, "rgba(96, 165, 250, 0)");
        ctx!.fillStyle = glow;
        ctx!.beginPath();
        ctx!.arc(dx, pulseY + 8, 10, 0, Math.PI * 2);
        ctx!.fill();
        ctx!.fillStyle = `rgba(191, 219, 254, ${alpha})`;
        ctx!.beginPath();
        ctx!.arc(dx, pulseY + 8, 3.5, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    function drawFrame(now: number) {
      const elapsed = now - start;
      controls = getSceneControls(elapsed);
      tickReadings(now);

      if (sparkHistory[0].length === 0) {
        probes.forEach((probe, i) => sparkHistory[i].push(probe.reading.f));
      }

      const bg = ctx!.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, "#0d1219");
      bg.addColorStop(0.55, COLORS.bgTop);
      bg.addColorStop(1, COLORS.bgBottom);
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, width, height);
      drawBackgroundPattern();

      drawSun(controls.sunIntensity);
      const garage = drawGarage(doorProgress, controls.outdoorF);

      const pulse = reducedMotionRef.current
        ? 0
        : 0.5 + 0.5 * Math.sin(elapsed / 600);

      PROBE_NODES.forEach((node, i) => {
        const probe = probes.find((p) => p.key === node.key);
        drawProbeNode(node, probe, pulse, garage);
      });

      const sparkW = (width * 0.72 - 24) / 3;
      const sparkY = height * 0.74;
      const sparkX0 = width * 0.12;
      drawProbeLinks(garage, sparkY);
      PROBE_NODES.forEach((node, i) => {
        drawSparkline(
          sparkHistory[i],
          sparkX0 + i * (sparkW + 8),
          sparkY,
          sparkW,
          48,
          node.label,
        );
      });

      drawDataPulse(elapsed);

      ctx!.fillStyle = COLORS.textMuted;
      ctx!.font = "500 10px system-ui, sans-serif";
      ctx!.textAlign = "right";
      ctx!.fillText(
        reducedMotionRef.current ? "Static preview" : "Simulated probe activity",
        width - 12,
        height - 8,
      );
    }

    function loop(now: number) {
      drawFrame(now);
      if (!reducedMotionRef.current) {
        raf = requestAnimationFrame(loop);
      }
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    probes = computeDemoProbes(controls);
    lastTick = performance.now();
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div class="about-probe-activity" aria-hidden="false">
      <canvas
        ref={canvasRef}
        class="about-probe-activity-canvas"
        role="img"
        aria-label="Animated bay cross-section showing three temperature probes reporting live readings, a door opening and closing, sun load changing, and data pulses traveling to the website dashboard."
      />
      <p class="about-probe-activity-caption">
        North wall, door zone, and workbench probes refresh every few seconds—the same rhythm as the live dashboard feed.
      </p>
    </div>
  );
}
