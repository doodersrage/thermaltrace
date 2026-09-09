import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedHealthStatus } from "./collectHistory";

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "insert", "update"]) {
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
  createServerClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}));

const mockCheckFeedHealth = vi.fn();
vi.mock("./collectHistory", () => ({
  checkFeedHealth: (...a: unknown[]) => mockCheckFeedHealth(...a),
}));

const mockGetAlertSettingsForUser = vi.fn();
const mockNotifyUser = vi.fn();
vi.mock("./notify", () => ({
  getAlertSettingsForUser: (...a: unknown[]) => mockGetAlertSettingsForUser(...a),
  notifyUser: (...a: unknown[]) => mockNotifyUser(...a),
}));

const mockListAllHouseholdOwnerUserIds = vi.fn();
vi.mock("./households", () => ({
  listAllHouseholdOwnerUserIds: (...a: unknown[]) => mockListAllHouseholdOwnerUserIds(...a),
}));

function status(overrides: Partial<FeedHealthStatus> = {}): FeedHealthStatus {
  return {
    feedId: "feed-1",
    feedName: "Garage",
    url: "https://example.com/feed",
    ok: true,
    message: "ok",
    probeCount: 2,
    checkedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  mockFrom.mockReset();
  mockCheckFeedHealth.mockReset().mockResolvedValue({ statuses: [], error: null });
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue({
    feedUptimeAlertsEnabled: true,
    lastFeedUptimeAlertAt: null,
    email: "user@example.com",
  });
  mockNotifyUser.mockReset().mockResolvedValue(undefined);
  mockListAllHouseholdOwnerUserIds.mockReset().mockResolvedValue([]);
});

describe("storeFeedUptimeChecks", () => {
  it("does nothing for an empty status list", async () => {
    const { storeFeedUptimeChecks } = await import("./feedUptimeMonitor");

    await storeFeedUptimeChecks("user-1", []);

    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("maps statuses into insertable rows", async () => {
    const builder = mockQuery({ error: null });
    mockFrom.mockReturnValue(builder);
    const { storeFeedUptimeChecks } = await import("./feedUptimeMonitor");

    await storeFeedUptimeChecks("user-1", [
      status({ feedId: "f1", feedName: "Garage", ok: false, message: "timeout" }),
    ]);

    expect(mockFrom).toHaveBeenCalledWith("feed_uptime_checks");
    expect(builder.insert).toHaveBeenCalledWith([
      {
        user_id: "user-1",
        feed_id: "f1",
        feed_name: "Garage",
        url: "https://example.com/feed",
        ok: false,
        message: "timeout",
        latency_ms: null,
        checked_at: "2024-01-01T00:00:00.000Z",
      },
    ]);
  });
});

describe("runFeedUptimeForAllUsers", () => {
  it("records a health-check error and moves on without storing or counting", async () => {
    mockListAllHouseholdOwnerUserIds.mockResolvedValue(["u1"]);
    mockCheckFeedHealth.mockResolvedValue({ statuses: [], error: "no devices" });
    const { runFeedUptimeForAllUsers } = await import("./feedUptimeMonitor");

    const result = await runFeedUptimeForAllUsers();

    expect(result).toEqual({ checked: 0, failed: 0, alertsSent: 0, errors: ["u1: no devices"] });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("counts checked/failed and skips notifying when everything is healthy", async () => {
    mockListAllHouseholdOwnerUserIds.mockResolvedValue(["u1"]);
    mockCheckFeedHealth.mockResolvedValue({
      statuses: [status({ ok: true }), status({ feedId: "f2", ok: true })],
      error: null,
    });
    mockFrom.mockReturnValue(mockQuery({ error: null }));
    const { runFeedUptimeForAllUsers } = await import("./feedUptimeMonitor");

    const result = await runFeedUptimeForAllUsers();

    expect(result).toEqual({ checked: 2, failed: 0, alertsSent: 0, errors: [] });
    expect(mockGetAlertSettingsForUser).not.toHaveBeenCalled();
  });

  it("skips notifying when feed uptime alerts are disabled", async () => {
    mockListAllHouseholdOwnerUserIds.mockResolvedValue(["u1"]);
    mockCheckFeedHealth.mockResolvedValue({
      statuses: [status({ ok: false, message: "timeout" })],
      error: null,
    });
    mockFrom.mockReturnValue(mockQuery({ error: null }));
    mockGetAlertSettingsForUser.mockResolvedValue({ feedUptimeAlertsEnabled: false });
    const { runFeedUptimeForAllUsers } = await import("./feedUptimeMonitor");

    const result = await runFeedUptimeForAllUsers();

    expect(result).toEqual({ checked: 1, failed: 1, alertsSent: 0, errors: [] });
    expect(mockNotifyUser).not.toHaveBeenCalled();
  });

  it("skips notifying while still within the 4-hour cooldown", async () => {
    mockListAllHouseholdOwnerUserIds.mockResolvedValue(["u1"]);
    mockCheckFeedHealth.mockResolvedValue({
      statuses: [status({ ok: false })],
      error: null,
    });
    mockFrom.mockReturnValue(mockQuery({ error: null }));
    mockGetAlertSettingsForUser.mockResolvedValue({
      feedUptimeAlertsEnabled: true,
      lastFeedUptimeAlertAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    });
    const { runFeedUptimeForAllUsers } = await import("./feedUptimeMonitor");

    await runFeedUptimeForAllUsers();

    expect(mockNotifyUser).not.toHaveBeenCalled();
  });

  it("notifies after the cooldown, builds the digest body, and marks the alert timestamp", async () => {
    mockListAllHouseholdOwnerUserIds.mockResolvedValue(["u1"]);
    mockCheckFeedHealth.mockResolvedValue({
      statuses: [
        status({ feedName: "Garage", ok: false, message: "timeout" }),
        status({ feedId: "f2", feedName: "Attic", ok: false, message: "503" }),
        status({ feedId: "f3", feedName: "Basement", ok: true }),
      ],
      error: null,
    });
    const updateBuilder = mockQuery({ error: null });
    mockFrom.mockReturnValue(updateBuilder);
    mockGetAlertSettingsForUser.mockResolvedValue({
      feedUptimeAlertsEnabled: true,
      lastFeedUptimeAlertAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      email: "user@example.com",
    });
    const { runFeedUptimeForAllUsers } = await import("./feedUptimeMonitor");

    const result = await runFeedUptimeForAllUsers();

    expect(mockNotifyUser).toHaveBeenCalledWith(
      "u1",
      "user@example.com",
      expect.objectContaining({ feedUptimeAlertsEnabled: true }),
      {
        title: "Feed unreachable",
        body: "Garage: timeout\nAttic: 503",
        kind: "outage",
      },
    );
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_feed_uptime_alert_at: expect.any(String) }),
    );
    expect(result).toEqual({ checked: 3, failed: 2, alertsSent: 1, errors: [] });
  });

  it("notifies immediately when there is no prior alert timestamp", async () => {
    mockListAllHouseholdOwnerUserIds.mockResolvedValue(["u1"]);
    mockCheckFeedHealth.mockResolvedValue({
      statuses: [status({ ok: false })],
      error: null,
    });
    mockFrom.mockReturnValue(mockQuery({ error: null }));
    mockGetAlertSettingsForUser.mockResolvedValue({
      feedUptimeAlertsEnabled: true,
      lastFeedUptimeAlertAt: null,
      email: "user@example.com",
    });
    const { runFeedUptimeForAllUsers } = await import("./feedUptimeMonitor");

    await runFeedUptimeForAllUsers();

    expect(mockNotifyUser).toHaveBeenCalled();
  });

  it("truncates a very long digest body to 1500 characters", async () => {
    mockListAllHouseholdOwnerUserIds.mockResolvedValue(["u1"]);
    const longMessage = "x".repeat(2000);
    mockCheckFeedHealth.mockResolvedValue({
      statuses: [status({ ok: false, message: longMessage })],
      error: null,
    });
    mockFrom.mockReturnValue(mockQuery({ error: null }));
    const { runFeedUptimeForAllUsers } = await import("./feedUptimeMonitor");

    await runFeedUptimeForAllUsers();

    const call = mockNotifyUser.mock.calls[0]!;
    expect((call[3] as { body: string }).body).toHaveLength(1500);
  });

  it("isolates a per-user error without stopping the batch", async () => {
    mockListAllHouseholdOwnerUserIds.mockResolvedValue(["u1", "u2"]);
    mockCheckFeedHealth.mockImplementation(async (userId: string) => {
      if (userId === "u1") throw new Error("boom");
      return { statuses: [], error: null };
    });
    const { runFeedUptimeForAllUsers } = await import("./feedUptimeMonitor");

    const result = await runFeedUptimeForAllUsers();

    expect(result.errors).toEqual(["u1: boom"]);
    expect(result.checked).toBe(0);
  });

  it("uses a generic message for a non-Error throw", async () => {
    mockListAllHouseholdOwnerUserIds.mockResolvedValue(["u1"]);
    mockCheckFeedHealth.mockRejectedValue("nope");
    const { runFeedUptimeForAllUsers } = await import("./feedUptimeMonitor");

    const result = await runFeedUptimeForAllUsers();

    expect(result.errors).toEqual(["u1: Unknown error"]);
  });
});
