import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "lt", "limit", "insert"]) {
    builder[method] = vi.fn(() => builder);
  }
  (builder as { then: unknown }).then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

const mockFrom = vi.fn();
vi.mock("./supabase", () => ({
  createServerClient: () => ({ from: (...a: unknown[]) => mockFrom(...a) }),
}));

function r2Bucket() {
  return { put: vi.fn().mockResolvedValue(undefined) };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
  mockFrom.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("archiveOldReadings", () => {
  it("returns the error immediately when the households query fails", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: "db down" } }));
    const { archiveOldReadings } = await import("./archiveHistory");

    const result = await archiveOldReadings({ r2: r2Bucket() as never });

    expect(result).toEqual({ archived: 0, skipped: false, error: "db down" });
  });

  it("skips archiving (without querying readings) when no r2 binding is given", async () => {
    const householdsBuilder = mockQuery({ data: [{ id: "house-1" }], error: null });
    mockFrom.mockReturnValue(householdsBuilder);
    const { archiveOldReadings } = await import("./archiveHistory");

    const result = await archiveOldReadings();

    expect(result).toEqual({ archived: 0, skipped: true, error: null });
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("skips a household with no aged readings", async () => {
    const householdsBuilder = mockQuery({ data: [{ id: "house-1" }], error: null });
    const readingsBuilder = mockQuery({ data: [] });
    mockFrom.mockImplementation((table: string) =>
      table === "households" ? householdsBuilder : readingsBuilder,
    );
    const r2 = r2Bucket();
    const { archiveOldReadings } = await import("./archiveHistory");

    const result = await archiveOldReadings({ r2: r2 as never });

    expect(result).toEqual({ archived: 0, skipped: false, error: null });
    expect(r2.put).not.toHaveBeenCalled();
  });

  it("archives readings for a household, uploading to r2 and recording the archive row", async () => {
    const householdsBuilder = mockQuery({ data: [{ id: "house-1" }], error: null });
    const readings = [{ id: "r1", value_num: 30, recorded_at: "2024-01-01", sensor_id: "s1" }];
    const readingsBuilder = mockQuery({ data: readings });
    const archivesBuilder = mockQuery({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "households") return householdsBuilder;
      if (table === "sensor_readings") return readingsBuilder;
      return archivesBuilder;
    });
    const r2 = r2Bucket();
    const { archiveOldReadings } = await import("./archiveHistory");

    const result = await archiveOldReadings({ r2: r2 as never, retentionDays: 90 });

    // cutoff = now (2024-06-15T12:00) - 90 days = 2024-03-17T12:00:00.000Z
    expect(r2.put).toHaveBeenCalledWith(
      "archives/house-1/2024-03-17.json",
      JSON.stringify(readings),
      { httpMetadata: { contentType: "application/json" } },
    );
    expect(archivesBuilder.insert).toHaveBeenCalledWith({
      household_id: "house-1",
      period_start: "2024-03-17",
      period_end: "2024-06-15",
      object_key: "archives/house-1/2024-03-17.json",
      row_count: 1,
    });
    expect(result).toEqual({ archived: 1, skipped: false, error: null });
  });

  it("uses a custom retentionDays for the cutoff instead of the default", async () => {
    const householdsBuilder = mockQuery({ data: [{ id: "house-1" }], error: null });
    const readingsBuilder = mockQuery({ data: [] });
    mockFrom.mockImplementation((table: string) =>
      table === "households" ? householdsBuilder : readingsBuilder,
    );
    const { archiveOldReadings } = await import("./archiveHistory");

    await archiveOldReadings({ r2: r2Bucket() as never, retentionDays: 30 });

    // cutoff = now - 30 days = 2024-05-16T12:00:00.000Z
    expect(readingsBuilder.lt).toHaveBeenCalledWith("recorded_at", "2024-05-16T12:00:00.000Z");
  });

  it("sums archived counts across multiple households", async () => {
    const householdsBuilder = mockQuery({
      data: [{ id: "house-1" }, { id: "house-2" }],
      error: null,
    });
    const readingsBuilder1 = mockQuery({ data: [{ id: "r1" }, { id: "r2" }] });
    const readingsBuilder2 = mockQuery({ data: [{ id: "r3" }] });
    const archivesBuilder = mockQuery({ error: null });
    let readingsCall = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === "households") return householdsBuilder;
      if (table === "sensor_readings") {
        readingsCall += 1;
        return readingsCall === 1 ? readingsBuilder1 : readingsBuilder2;
      }
      return archivesBuilder;
    });
    const { archiveOldReadings } = await import("./archiveHistory");

    const result = await archiveOldReadings({ r2: r2Bucket() as never });

    expect(result).toEqual({ archived: 3, skipped: false, error: null });
  });

  it("handles a null households result as an empty list", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: null }));
    const { archiveOldReadings } = await import("./archiveHistory");

    const result = await archiveOldReadings({ r2: r2Bucket() as never });

    expect(result).toEqual({ archived: 0, skipped: false, error: null });
  });
});
