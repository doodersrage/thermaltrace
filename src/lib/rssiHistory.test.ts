import { describe, expect, it } from "vitest";
import {
  appendRssiSample,
  enrichDeviceMetaHistories,
  parseRssiHistory,
} from "./rssiHistory";

describe("rssiHistory", () => {
  it("appends and trims rssi samples", () => {
    let history: unknown = [];
    for (let i = 0; i < 16; i++) {
      history = appendRssiSample(history, -50 - i, `2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`);
    }
    expect(history).toHaveLength(14);
    expect((history as { dbm: number }[])[0]?.dbm).toBe(-52);
  });

  it("parses rssi_history from device meta", () => {
    expect(
      parseRssiHistory({
        rssi_history: [
          { dbm: -60, at: "2026-01-01T00:00:00Z" },
          { dbm: "bad", at: "x" },
        ],
      }),
    ).toEqual([{ dbm: -60, at: "2026-01-01T00:00:00Z" }]);
  });

  it("enriches battery and rssi patches with history rings", () => {
    const next = enrichDeviceMetaHistories(
      {
        battery_history: [{ pct: 90, at: "2026-01-01T00:00:00Z" }],
        rssi_history: [{ dbm: -55, at: "2026-01-01T00:00:00Z" }],
      },
      { battery_pct: 80, rssi: -70 },
      "2026-01-02T00:00:00Z",
    );
    expect(next.battery_history).toEqual([
      { pct: 90, at: "2026-01-01T00:00:00Z" },
      { pct: 80, at: "2026-01-02T00:00:00Z" },
    ]);
    expect(next.rssi_history).toEqual([
      { dbm: -55, at: "2026-01-01T00:00:00Z" },
      { dbm: -70, at: "2026-01-02T00:00:00Z" },
    ]);
  });
});
