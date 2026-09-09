import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  alertMarkerColor,
  drawAlertMarkers,
  nearestAlertMarker,
  toChartAlertMarkers,
  type ChartAlertMarker,
} from "./chartAlertMarkers";
import type { AlertEventRow } from "./alertEvents";
import type { PlotBounds } from "./historyChartInteraction";

function row(overrides: Partial<AlertEventRow> = {}): AlertEventRow {
  return {
    id: 1,
    user_id: "user-1",
    kind: "threshold",
    title: "Freeze warning",
    body: "Garage is freezing",
    channels_sent: ["email"],
    channels_skipped: [],
    created_at: "2024-01-15T12:00:00.000Z",
    acknowledged_at: null,
    ...overrides,
  };
}

const bounds: PlotBounds = {
  padLeft: 40,
  padRight: 16,
  padTop: 16,
  padBottom: 28,
  width: 400,
  height: 200,
  minTs: Date.parse("2024-01-01T00:00:00.000Z"),
  maxTs: Date.parse("2024-01-31T00:00:00.000Z"),
  minTemp: 20,
  maxTemp: 50,
};

describe("chartAlertMarkers", () => {
  it("maps critical kinds and drops others", () => {
    const markers = toChartAlertMarkers([
      row({ id: 1, kind: "threshold" }),
      row({ id: 2, kind: "digest" }),
      row({ id: 3, kind: "flood" }),
    ]);
    expect(markers.map((m) => m.id)).toEqual([1, 3]);
  });

  it("returns stable colors for known kinds", () => {
    expect(alertMarkerColor("threshold")).toBe("#38bdf8");
    expect(alertMarkerColor("unknown")).toBe("#94a3b8");
  });

  it("finds the nearest in-view marker", () => {
    const markers: ChartAlertMarker[] = [
      {
        id: 1,
        createdAt: "2024-01-10T00:00:00.000Z",
        kind: "threshold",
        title: "A",
      },
      {
        id: 2,
        createdAt: "2024-01-20T00:00:00.000Z",
        kind: "flood",
        title: "B",
      },
    ];
    // mid-January is closer to id 1 on this domain.
    const mid = (bounds.padLeft + (bounds.width - bounds.padRight)) / 2;
    const hit = nearestAlertMarker(markers, bounds, mid, 200);
    expect(hit?.id).toBeTruthy();
  });

  it("draws without throwing", () => {
    const g = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      setLineDash: vi.fn(),
      globalAlpha: 1,
      strokeStyle: "",
      fillStyle: "",
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    drawAlertMarkers(
      g,
      [
        {
          id: 1,
          createdAt: "2024-01-15T12:00:00.000Z",
          kind: "threshold",
          title: "Freeze",
        },
      ],
      bounds,
    );
    expect(g.stroke).toHaveBeenCalled();
    expect(g.fill).toHaveBeenCalled();
  });
});
