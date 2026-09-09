import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "gte", "order", "insert", "update"]) {
    builder[method] = vi.fn(() => builder);
  }
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
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("recordIngestStat", () => {
  it("inserts a new row when none exists for today, for a success", async () => {
    const selectBuilder = mockQuery({ data: null });
    const insertBuilder = mockQuery({ error: null });
    mockFrom.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(insertBuilder);
    const { recordIngestStat } = await import("./ingestStats");

    await recordIngestStat("device-1", true);

    expect(insertBuilder.insert).toHaveBeenCalledWith({
      device_id: "device-1",
      day: "2024-06-15",
      success_count: 1,
      error_count: 0,
    });
  });

  it("inserts a new row for a failure", async () => {
    const selectBuilder = mockQuery({ data: null });
    const insertBuilder = mockQuery({ error: null });
    mockFrom.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(insertBuilder);
    const { recordIngestStat } = await import("./ingestStats");

    await recordIngestStat("device-1", false);

    expect(insertBuilder.insert).toHaveBeenCalledWith({
      device_id: "device-1",
      day: "2024-06-15",
      success_count: 0,
      error_count: 1,
    });
  });

  it("increments success_count on an existing row", async () => {
    const selectBuilder = mockQuery({ data: { success_count: 4, error_count: 1 } });
    const updateBuilder = mockQuery({ error: null });
    mockFrom.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(updateBuilder);
    const { recordIngestStat } = await import("./ingestStats");

    await recordIngestStat("device-1", true);

    expect(updateBuilder.update).toHaveBeenCalledWith({ success_count: 5 });
  });

  it("increments error_count on an existing row", async () => {
    const selectBuilder = mockQuery({ data: { success_count: 4, error_count: 1 } });
    const updateBuilder = mockQuery({ error: null });
    mockFrom.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(updateBuilder);
    const { recordIngestStat } = await import("./ingestStats");

    await recordIngestStat("device-1", false);

    expect(updateBuilder.update).toHaveBeenCalledWith({ error_count: 2 });
  });

  it("treats a missing count as 0 before incrementing", async () => {
    const selectBuilder = mockQuery({ data: { success_count: null, error_count: null } });
    const updateBuilder = mockQuery({ error: null });
    mockFrom.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(updateBuilder);
    const { recordIngestStat } = await import("./ingestStats");

    await recordIngestStat("device-1", true);

    expect(updateBuilder.update).toHaveBeenCalledWith({ success_count: 1 });
  });
});

describe("listIngestStatsForHousehold", () => {
  it("returns an empty array when the household has no devices", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [] }));
    const { listIngestStatsForHousehold } = await import("./ingestStats");

    expect(await listIngestStatsForHousehold("house-1")).toEqual([]);
  });

  it("attaches device names and falls back to 'Device' for unmatched ids", async () => {
    const devicesBuilder = mockQuery({ data: [{ id: "d1", name: "Garage" }] });
    const statsBuilder = mockQuery({
      data: [
        { device_id: "d1", day: "2024-06-15", success_count: 3, error_count: 0 },
        { device_id: "d2", day: "2024-06-14", success_count: 1, error_count: 1 },
      ],
    });
    mockFrom.mockReturnValueOnce(devicesBuilder).mockReturnValueOnce(statsBuilder);
    const { listIngestStatsForHousehold } = await import("./ingestStats");

    const result = await listIngestStatsForHousehold("house-1");

    expect(result).toEqual([
      { device_id: "d1", day: "2024-06-15", success_count: 3, error_count: 0, device_name: "Garage" },
      { device_id: "d2", day: "2024-06-14", success_count: 1, error_count: 1, device_name: "Device" },
    ]);
  });

  it("computes the since-day cutoff from the days parameter", async () => {
    const devicesBuilder = mockQuery({ data: [{ id: "d1", name: "Garage" }] });
    const statsBuilder = mockQuery({ data: [] });
    mockFrom.mockReturnValueOnce(devicesBuilder).mockReturnValueOnce(statsBuilder);
    const { listIngestStatsForHousehold } = await import("./ingestStats");

    await listIngestStatsForHousehold("house-1", 3);

    expect(statsBuilder.gte).toHaveBeenCalledWith("day", "2024-06-12");
  });
});

describe("listRecentIngestStatsAdmin", () => {
  it("returns an empty array when there are no stats", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [] }));
    const { listRecentIngestStatsAdmin } = await import("./ingestStats");

    expect(await listRecentIngestStatsAdmin()).toEqual([]);
  });

  it("looks up only the unique device ids referenced by the stats", async () => {
    const statsBuilder = mockQuery({
      data: [
        { device_id: "d1", day: "2024-06-15", success_count: 1, error_count: 0 },
        { device_id: "d1", day: "2024-06-14", success_count: 2, error_count: 0 },
        { device_id: "d2", day: "2024-06-15", success_count: 0, error_count: 1 },
      ],
    });
    const devicesBuilder = mockQuery({ data: [{ id: "d1", name: "Garage" }, { id: "d2", name: "Attic" }] });
    mockFrom.mockReturnValueOnce(statsBuilder).mockReturnValueOnce(devicesBuilder);
    const { listRecentIngestStatsAdmin } = await import("./ingestStats");

    const result = await listRecentIngestStatsAdmin();

    expect(devicesBuilder.in).toHaveBeenCalledWith("id", ["d1", "d2"]);
    expect(result.map((r) => r.device_name)).toEqual(["Garage", "Garage", "Attic"]);
  });

  it("falls back to 'Device' when the device lookup returns nothing", async () => {
    const statsBuilder = mockQuery({
      data: [{ device_id: "gone", day: "2024-06-15", success_count: 1, error_count: 0 }],
    });
    const devicesBuilder = mockQuery({ data: null });
    mockFrom.mockReturnValueOnce(statsBuilder).mockReturnValueOnce(devicesBuilder);
    const { listRecentIngestStatsAdmin } = await import("./ingestStats");

    const result = await listRecentIngestStatsAdmin();

    expect(result[0]!.device_name).toBe("Device");
  });
});
