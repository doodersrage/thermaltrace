import { describe, expect, it } from "vitest";
import { newestLiveReadingAt } from "./liveDashboardChrome";

describe("newestLiveReadingAt", () => {
  it("returns fallback when no timestamps exist", () => {
    expect(newestLiveReadingAt([], "2026-01-01T00:00:00.000Z")).toBe(
      "2026-01-01T00:00:00.000Z",
    );
    expect(newestLiveReadingAt([{ recorded_at: null }])).toBeNull();
  });

  it("picks the newest recorded_at", () => {
    expect(
      newestLiveReadingAt([
        { recorded_at: "2026-01-01T00:00:00.000Z" },
        { recorded_at: "2026-01-02T12:00:00.000Z" },
        { recorded_at: "2026-01-02T08:00:00.000Z" },
      ]),
    ).toBe("2026-01-02T12:00:00.000Z");
  });
});
