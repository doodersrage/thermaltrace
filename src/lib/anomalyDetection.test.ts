import { describe, expect, it } from "vitest";
import type { ChartPoint } from "./garageTempsHistory";
import { detectTemperatureAnomalies } from "./anomalyDetection";

function point(
  timestamp: string,
  tempf: number,
  probeLabel = "Bay",
): ChartPoint {
  return { timestamp, tempf, humidity: 40, probeLabel };
}

describe("detectTemperatureAnomalies", () => {
  it("returns no notices when drops are below threshold", () => {
    expect(
      detectTemperatureAnomalies([
        point("2026-01-01T10:00:00.000Z", 40),
        point("2026-01-01T10:30:00.000Z", 35),
      ]),
    ).toEqual([]);
  });

  it("flags a sudden drop within the window", () => {
    const notices = detectTemperatureAnomalies([
      point("2026-01-01T10:00:00.000Z", 45),
      point("2026-01-01T10:30:00.000Z", 30),
    ]);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      probeLabel: "Bay",
      severity: "warning",
    });
    expect(notices[0]?.message).toContain("dropped 15.0°F within 30 minutes");
    expect(notices[0]?.message).toContain("45.0°F → 30.0°F");
    expect(notices[0]?.message).not.toContain("door sensor");
  });

  it("mentions nearby open door events", () => {
    const notices = detectTemperatureAnomalies(
      [
        point("2026-01-01T10:00:00.000Z", 50),
        point("2026-01-01T10:20:00.000Z", 35),
      ],
      10,
      60 * 60 * 1000,
      [{ label: "Garage", open: true, recordedAt: "2026-01-01T10:15:00.000Z" }],
    );
    expect(notices).toHaveLength(1);
    expect(notices[0]?.message).toContain("A door sensor was open around this time.");
  });

  it("ignores closed doors and doors outside the near window", () => {
    const notices = detectTemperatureAnomalies(
      [
        point("2026-01-01T10:00:00.000Z", 50),
        point("2026-01-01T10:20:00.000Z", 35),
      ],
      10,
      60 * 60 * 1000,
      [
        { label: "Garage", open: false, recordedAt: "2026-01-01T10:15:00.000Z" },
        { label: "Side", open: true, recordedAt: "2026-01-01T12:00:00.000Z" },
      ],
    );
    expect(notices[0]?.message).not.toContain("door sensor");
  });

  it("ignores drops outside the elapsed window", () => {
    expect(
      detectTemperatureAnomalies(
        [
          point("2026-01-01T10:00:00.000Z", 50),
          point("2026-01-01T12:30:00.000Z", 30),
        ],
        10,
        60 * 60 * 1000,
      ),
    ).toEqual([]);
  });

  it("reports at most one anomaly per probe", () => {
    const notices = detectTemperatureAnomalies([
      point("2026-01-01T10:00:00.000Z", 50),
      point("2026-01-01T10:20:00.000Z", 35),
      point("2026-01-01T10:40:00.000Z", 20),
    ]);
    expect(notices).toHaveLength(1);
  });

  it("detects anomalies per probe label independently", () => {
    const notices = detectTemperatureAnomalies([
      point("2026-01-01T10:00:00.000Z", 50, "Bay"),
      point("2026-01-01T10:20:00.000Z", 35, "Bay"),
      point("2026-01-01T10:00:00.000Z", 48, "Loft"),
      point("2026-01-01T10:15:00.000Z", 36, "Loft"),
    ]);
    expect(notices.map((n) => n.probeLabel).sort()).toEqual(["Bay", "Loft"]);
  });
});
