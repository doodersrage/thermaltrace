import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  mergeVisibleProbes,
  readDeltaChartPrefs,
  readHistoryChartPrefs,
  writeDeltaChartPrefs,
  writeHistoryChartPrefs,
  HISTORY_CHART_PREFS_KEY,
  DELTA_CHART_PREFS_KEY,
} from "./chartPrefs";

function mockLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  });
}

describe("chartPrefs", () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("round-trips history prefs", () => {
    writeHistoryChartPrefs({
      presetId: "7d",
      visibleProbes: ["Garage"],
      houseVisible: false,
      humidityOn: true,
    });
    expect(readHistoryChartPrefs()).toEqual({
      presetId: "7d",
      visibleProbes: ["Garage"],
      houseVisible: false,
      humidityOn: true,
    });
    expect(localStorage.getItem(HISTORY_CHART_PREFS_KEY)).toContain("7d");
  });

  it("merges patches into history prefs", () => {
    writeHistoryChartPrefs({ presetId: "24h" });
    writeHistoryChartPrefs({ houseVisible: false });
    expect(readHistoryChartPrefs()).toEqual({
      presetId: "24h",
      houseVisible: false,
    });
  });

  it("round-trips delta chart preset", () => {
    writeDeltaChartPrefs({ presetId: "30d" });
    expect(readDeltaChartPrefs()).toEqual({ presetId: "30d" });
    expect(localStorage.getItem(DELTA_CHART_PREFS_KEY)).toContain("30d");
  });

  it("intersects stored probes with current labels", () => {
    expect(mergeVisibleProbes(["A", "gone"], ["A", "B"])).toEqual(new Set(["A"]));
    expect(mergeVisibleProbes(["gone"], ["A", "B"])).toEqual(new Set(["A", "B"]));
    expect(mergeVisibleProbes(undefined, ["A"])).toEqual(new Set(["A"]));
  });
});
