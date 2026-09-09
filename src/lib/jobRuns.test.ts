import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function mockQuery(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit", "lt", "not", "insert", "update", "upsert"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.delete = vi.fn(() => builder);
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  (builder as { then: unknown }).then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

const mockFrom = vi.fn();
vi.mock("./supabase", () => ({
  createServerClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}));

beforeEach(() => {
  mockFrom.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("startJobRun", () => {
  it("inserts a running job row and returns its id", async () => {
    const builder = mockQuery({ data: { id: 42 }, error: null });
    mockFrom.mockReturnValue(builder);
    const { startJobRun } = await import("./jobRuns");

    const id = await startJobRun("nightly-retention", { note: "kickoff" });

    expect(id).toBe(42);
    expect(mockFrom).toHaveBeenCalledWith("job_runs");
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        job_name: "nightly-retention",
        status: "running",
        detail: { note: "kickoff" },
      }),
    );
  });

  it("returns null and logs when the insert fails", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: "insert failed" } }));
    const { startJobRun } = await import("./jobRuns");

    expect(await startJobRun("nightly-retention")).toBeNull();
  });
});

describe("finishJobRun", () => {
  it("updates the row with a finished timestamp and status", async () => {
    const builder = mockQuery({ error: null });
    mockFrom.mockReturnValue(builder);
    const { finishJobRun } = await import("./jobRuns");

    await finishJobRun(42, "success", { rows: 10 });

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "success", detail: { rows: 10 } }),
    );
    expect(builder.eq).toHaveBeenCalledWith("id", 42);
  });

  it("does nothing when id is null", async () => {
    const { finishJobRun } = await import("./jobRuns");

    await finishJobRun(null, "error");

    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe("listRecentJobRuns", () => {
  it("returns runs ordered by supabase, defaulting the limit to 50", async () => {
    const builder = mockQuery({ data: [{ id: 1 }], error: null });
    mockFrom.mockReturnValue(builder);
    const { listRecentJobRuns } = await import("./jobRuns");

    const result = await listRecentJobRuns();

    expect(result).toEqual({ runs: [{ id: 1 }], error: null });
    expect(builder.limit).toHaveBeenCalledWith(50);
  });

  it("passes through a custom limit", async () => {
    const builder = mockQuery({ data: [], error: null });
    mockFrom.mockReturnValue(builder);
    const { listRecentJobRuns } = await import("./jobRuns");

    await listRecentJobRuns(5);

    expect(builder.limit).toHaveBeenCalledWith(5);
  });

  it("returns an empty array and the message on error", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: "boom" } }));
    const { listRecentJobRuns } = await import("./jobRuns");

    expect(await listRecentJobRuns()).toEqual({ runs: [], error: "boom" });
  });
});

describe("runSensorReadingRetention", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:34:56.000Z"));
  });

  it("uses the retention window to compute the cutoff passed to the select", async () => {
    const selectBuilder = mockQuery({ data: [], error: null });
    const deleteBuilder = mockQuery({ error: null, count: 0 });
    mockFrom.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(deleteBuilder);
    const { runSensorReadingRetention } = await import("./jobRuns");

    await runSensorReadingRetention(90);

    expect(selectBuilder.lt).toHaveBeenCalledWith("recorded_at", "2024-03-17T12:34:56.000Z");
    expect(selectBuilder.not).toHaveBeenCalledWith("value_num", "is", null);
    expect(selectBuilder.limit).toHaveBeenCalledWith(20000);
  });

  it("returns the select error immediately", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: "select failed" } }));
    const { runSensorReadingRetention } = await import("./jobRuns");

    expect(await runSensorReadingRetention(90)).toEqual({
      rolledUp: 0,
      deleted: 0,
      error: "select failed",
    });
  });

  it("skips the upsert and rolls up nothing when there are no old rows", async () => {
    const selectBuilder = mockQuery({ data: [], error: null });
    const deleteBuilder = mockQuery({ error: null, count: 0 });
    mockFrom.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(deleteBuilder);
    const { runSensorReadingRetention } = await import("./jobRuns");

    const result = await runSensorReadingRetention(90);

    expect(result).toEqual({ rolledUp: 0, deleted: 0, error: null });
    expect(mockFrom).toHaveBeenCalledTimes(2);
    expect(mockFrom).toHaveBeenNthCalledWith(1, "sensor_readings");
    expect(mockFrom).toHaveBeenNthCalledWith(2, "sensor_readings");
  });

  it("buckets readings by sensor and hour, computing avg/min/max/count", async () => {
    const oldRows = [
      { sensor_id: "s1", household_id: "h1", recorded_at: "2024-01-01T05:10:00.000Z", value_num: 10 },
      { sensor_id: "s1", household_id: "h1", recorded_at: "2024-01-01T05:50:00.000Z", value_num: 20 },
      { sensor_id: "s1", household_id: "h1", recorded_at: "2024-01-01T06:05:00.000Z", value_num: 100 },
      { sensor_id: "s2", household_id: "h1", recorded_at: "2024-01-01T05:15:00.000Z", value_num: 5 },
      { sensor_id: "s1", household_id: "h1", recorded_at: "2024-01-01T05:59:59.999Z", value_num: null },
    ];
    const selectBuilder = mockQuery({ data: oldRows, error: null });
    const upsertBuilder = mockQuery({ error: null });
    const deleteBuilder = mockQuery({ error: null, count: 4 });
    mockFrom
      .mockReturnValueOnce(selectBuilder)
      .mockReturnValueOnce(upsertBuilder)
      .mockReturnValueOnce(deleteBuilder);
    const { runSensorReadingRetention } = await import("./jobRuns");

    const result = await runSensorReadingRetention(90);

    expect(mockFrom).toHaveBeenNthCalledWith(2, "sensor_reading_rollups");
    const [rollupRows, options] = (upsertBuilder.upsert as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(options).toEqual({ onConflict: "sensor_id,bucket_start" });
    expect(rollupRows).toHaveLength(3);

    const s1Hour5 = rollupRows.find(
      (r: { sensor_id: string; bucket_start: string }) =>
        r.sensor_id === "s1" && r.bucket_start === "2024-01-01T05:00:00.000Z",
    );
    expect(s1Hour5).toEqual({
      sensor_id: "s1",
      household_id: "h1",
      bucket_start: "2024-01-01T05:00:00.000Z",
      avg_num: 15,
      min_num: 10,
      max_num: 20,
      sample_count: 2,
    });

    const s1Hour6 = rollupRows.find(
      (r: { sensor_id: string; bucket_start: string }) =>
        r.sensor_id === "s1" && r.bucket_start === "2024-01-01T06:00:00.000Z",
    );
    expect(s1Hour6).toMatchObject({ avg_num: 100, min_num: 100, max_num: 100, sample_count: 1 });

    const s2Hour5 = rollupRows.find((r: { sensor_id: string }) => r.sensor_id === "s2");
    expect(s2Hour5).toMatchObject({ avg_num: 5, sample_count: 1 });

    expect(result).toEqual({ rolledUp: 3, deleted: 4, error: null });
  });

  it("returns the upsert error without attempting the delete", async () => {
    const oldRows = [
      { sensor_id: "s1", household_id: "h1", recorded_at: "2024-01-01T05:10:00.000Z", value_num: 10 },
    ];
    const selectBuilder = mockQuery({ data: oldRows, error: null });
    const upsertBuilder = mockQuery({ error: { message: "upsert failed" } });
    mockFrom.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(upsertBuilder);
    const { runSensorReadingRetention } = await import("./jobRuns");

    const result = await runSensorReadingRetention(90);

    expect(result).toEqual({ rolledUp: 0, deleted: 0, error: "upsert failed" });
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it("returns the delete error while still reporting the rollup count", async () => {
    const oldRows = [
      { sensor_id: "s1", household_id: "h1", recorded_at: "2024-01-01T05:10:00.000Z", value_num: 10 },
    ];
    const selectBuilder = mockQuery({ data: oldRows, error: null });
    const upsertBuilder = mockQuery({ error: null });
    const deleteBuilder = mockQuery({ error: { message: "delete failed" }, count: null });
    mockFrom
      .mockReturnValueOnce(selectBuilder)
      .mockReturnValueOnce(upsertBuilder)
      .mockReturnValueOnce(deleteBuilder);
    const { runSensorReadingRetention } = await import("./jobRuns");

    const result = await runSensorReadingRetention(90);

    expect(result).toEqual({ rolledUp: 1, deleted: 0, error: "delete failed" });
  });

  it("defaults deleted to 0 when supabase returns a null count", async () => {
    const selectBuilder = mockQuery({ data: [], error: null });
    const deleteBuilder = mockQuery({ error: null, count: null });
    mockFrom.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(deleteBuilder);
    const { runSensorReadingRetention } = await import("./jobRuns");

    expect(await runSensorReadingRetention(90)).toEqual({ rolledUp: 0, deleted: 0, error: null });
  });
});
