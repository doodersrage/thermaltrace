import { beforeEach, describe, expect, it, vi } from "vitest";

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "gte", "order", "limit"]) {
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
  createAdminClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}));

const mockListRecentIngestStatsAdmin = vi.fn();
vi.mock("./ingestStats", () => ({
  listRecentIngestStatsAdmin: (...a: unknown[]) => mockListRecentIngestStatsAdmin(...a),
}));

const mockFlagIngestAbuse = vi.fn();
vi.mock("./ingestAbuse", () => ({
  flagIngestAbuse: (...a: unknown[]) => mockFlagIngestAbuse(...a),
}));

const mockListRecentJobRuns = vi.fn();
vi.mock("./jobRuns", () => ({
  listRecentJobRuns: (...a: unknown[]) => mockListRecentJobRuns(...a),
}));

const mockFetchLastSuccessfulCollectHistory = vi.fn();
const mockIsCollectHistoryStale = vi.fn();
vi.mock("./cronHealth", () => ({
  fetchLastSuccessfulCollectHistory: (...a: unknown[]) => mockFetchLastSuccessfulCollectHistory(...a),
  isCollectHistoryStale: (...a: unknown[]) => mockIsCollectHistoryStale(...a),
}));

beforeEach(() => {
  mockFrom.mockReset();
  mockListRecentIngestStatsAdmin.mockReset().mockResolvedValue([]);
  mockFlagIngestAbuse.mockReset().mockReturnValue([]);
  mockListRecentJobRuns.mockReset().mockResolvedValue({ runs: [] });
  mockFetchLastSuccessfulCollectHistory.mockReset().mockResolvedValue("2024-06-15T11:00:00.000Z");
  mockIsCollectHistoryStale.mockReset().mockReturnValue(false);
});

function jobsQuery(jobs: Array<{ job_name: string; status: string; started_at: string }>) {
  return mockQuery({ data: jobs });
}

describe("fetchAppStatus", () => {
  it("is healthy when the latest job succeeded, there are no errors, and history isn't stale", async () => {
    mockFrom.mockReturnValue(
      jobsQuery([{ job_name: "collect-history", status: "success", started_at: "2024-06-15T11:00:00.000Z" }]),
    );
    const { fetchAppStatus } = await import("./appStatus");

    const status = await fetchAppStatus();

    expect(status.healthy).toBe(true);
    expect(status.lastCronAt).toBe("2024-06-15T11:00:00.000Z");
    expect(status.lastCronJob).toBe("collect-history");
    expect(status.lastCronStatus).toBe("success");
  });

  it("is unhealthy when there are any job errors in the window", async () => {
    mockFrom.mockReturnValue(
      jobsQuery([
        { job_name: "collect-history", status: "success", started_at: "2024-06-15T11:00:00.000Z" },
        { job_name: "retention", status: "error", started_at: "2024-06-15T03:00:00.000Z" },
      ]),
    );
    const { fetchAppStatus } = await import("./appStatus");

    const status = await fetchAppStatus();

    expect(status.healthy).toBe(false);
    expect(status.recentJobErrors).toBe(1);
  });

  it("is unhealthy and reports nulls when there are no jobs at all", async () => {
    mockFrom.mockReturnValue(jobsQuery([]));
    const { fetchAppStatus } = await import("./appStatus");

    const status = await fetchAppStatus();

    expect(status.healthy).toBe(false);
    expect(status.lastCronAt).toBeNull();
    expect(status.lastCronJob).toBeNull();
    expect(status.lastCronStatus).toBeNull();
  });

  it("is unhealthy when the most recent job did not succeed", async () => {
    mockFrom.mockReturnValue(
      jobsQuery([{ job_name: "collect-history", status: "running", started_at: "2024-06-15T11:00:00.000Z" }]),
    );
    const { fetchAppStatus } = await import("./appStatus");

    expect((await fetchAppStatus()).healthy).toBe(false);
  });

  it("is unhealthy when the history poll is stale, even with a successful latest job", async () => {
    mockFrom.mockReturnValue(
      jobsQuery([{ job_name: "collect-history", status: "success", started_at: "2024-06-15T11:00:00.000Z" }]),
    );
    mockIsCollectHistoryStale.mockReturnValue(true);
    const { fetchAppStatus } = await import("./appStatus");

    const status = await fetchAppStatus();

    expect(status.healthy).toBe(false);
    expect(status.historyPollStale).toBe(true);
  });

  it("derives ingestAbuseCount and ingestRateLimitElevated from flagIngestAbuse", async () => {
    mockFrom.mockReturnValue(jobsQuery([]));
    mockFlagIngestAbuse.mockReturnValue([{ device_id: "d1" }, { device_id: "d2" }]);
    const { fetchAppStatus } = await import("./appStatus");

    const status = await fetchAppStatus();

    expect(status.ingestAbuseCount).toBe(2);
    expect(status.ingestRateLimitElevated).toBe(true);
  });

  it("reports no rate-limit elevation when nothing is flagged", async () => {
    mockFrom.mockReturnValue(jobsQuery([]));
    mockFlagIngestAbuse.mockReturnValue([]);
    const { fetchAppStatus } = await import("./appStatus");

    expect((await fetchAppStatus()).ingestRateLimitElevated).toBe(false);
  });

  it("passes through the recent job runs and a valid checkedAt timestamp", async () => {
    mockFrom.mockReturnValue(jobsQuery([]));
    mockListRecentJobRuns.mockResolvedValue({ runs: [{ id: 1 }] });
    const { fetchAppStatus } = await import("./appStatus");

    const status = await fetchAppStatus();

    expect(mockListRecentJobRuns).toHaveBeenCalledWith(14);
    expect(status.recentJobRuns).toEqual([{ id: 1 }]);
    expect(() => new Date(status.checkedAt).toISOString()).not.toThrow();
  });
});

describe("fetchAppStatusSummary", () => {
  it("reports healthy when the history poll is not stale", async () => {
    mockIsCollectHistoryStale.mockReturnValue(false);
    const { fetchAppStatusSummary } = await import("./appStatus");

    expect(await fetchAppStatusSummary()).toEqual({ healthy: true });
  });

  it("reports unhealthy when the history poll is stale", async () => {
    mockIsCollectHistoryStale.mockReturnValue(true);
    const { fetchAppStatusSummary } = await import("./appStatus");

    expect(await fetchAppStatusSummary()).toEqual({ healthy: false });
  });

  it("returns null instead of throwing when the lookup fails", async () => {
    mockFetchLastSuccessfulCollectHistory.mockRejectedValue(new Error("db down"));
    const { fetchAppStatusSummary } = await import("./appStatus");

    expect(await fetchAppStatusSummary()).toBeNull();
  });
});
