import { beforeEach, describe, expect, it, vi } from "vitest";

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "update"]) {
    builder[method] = vi.fn(() => builder);
  }
  (builder as { then: unknown }).then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

const mockFrom = vi.fn();
const mockGetUserById = vi.fn();
vi.mock("./supabase", () => ({
  createServerClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
  createAdminClient: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
    auth: { admin: { getUserById: (...a: unknown[]) => mockGetUserById(...a) } },
  }),
}));

const mockFetchCrossPropertySnapshots = vi.fn();
vi.mock("./crossProperty", () => ({
  fetchCrossPropertySnapshots: (...a: unknown[]) => mockFetchCrossPropertySnapshots(...a),
}));

const mockGetAlertSettingsForUser = vi.fn();
const mockNotifyUser = vi.fn();
vi.mock("./notify", () => ({
  getAlertSettingsForUser: (...a: unknown[]) => mockGetAlertSettingsForUser(...a),
  notifyUser: (...a: unknown[]) => mockNotifyUser(...a),
}));

const mockListUserHouseholds = vi.fn();
vi.mock("./households", () => ({
  listUserHouseholds: (...a: unknown[]) => mockListUserHouseholds(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("./entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

beforeEach(() => {
  mockFrom.mockReset();
  mockGetUserById.mockReset().mockResolvedValue({
    data: { user: { email: "owner@example.com", user_metadata: {} } },
  });
  mockFetchCrossPropertySnapshots.mockReset().mockResolvedValue({ properties: [] });
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue({
    enabled: true,
    portfolioAlertsEnabled: true,
    lastPortfolioAlertAt: null,
  });
  mockNotifyUser.mockReset().mockResolvedValue(undefined);
  mockListUserHouseholds.mockReset().mockResolvedValue({
    households: [{ id: "h1" }, { id: "h2" }],
  });
  mockGetUserEntitlements.mockReset().mockResolvedValue({ canUsePortfolio: true });
});

function ownersQuery(userIds: string[]) {
  return mockQuery({ data: userIds.map((user_id) => ({ user_id })) });
}

describe("sendPortfolioAlertsForAllUsers", () => {
  it("dedupes owner rows and processes each user once", async () => {
    mockFrom.mockImplementation((table: string) =>
      table === "household_members" ? ownersQuery(["u1", "u1", "u2"]) : mockQuery({ error: null }),
    );
    mockGetUserEntitlements.mockResolvedValue({ canUsePortfolio: false });
    const { sendPortfolioAlertsForAllUsers } = await import("./portfolioAlerts");

    const result = await sendPortfolioAlertsForAllUsers();

    expect(mockGetUserEntitlements).toHaveBeenCalledTimes(2);
    expect(result.skipped).toBe(2);
  });

  it("skips a user whose plan does not include portfolio alerts", async () => {
    mockFrom.mockImplementation((table: string) =>
      table === "household_members" ? ownersQuery(["u1"]) : mockQuery({ error: null }),
    );
    mockGetUserEntitlements.mockResolvedValue({ canUsePortfolio: false });
    const { sendPortfolioAlertsForAllUsers } = await import("./portfolioAlerts");

    expect(await sendPortfolioAlertsForAllUsers()).toEqual({ sent: 0, skipped: 1, errors: [] });
    expect(mockListUserHouseholds).not.toHaveBeenCalled();
  });

  it("skips a user with fewer than 2 households", async () => {
    mockFrom.mockImplementation((table: string) =>
      table === "household_members" ? ownersQuery(["u1"]) : mockQuery({ error: null }),
    );
    mockListUserHouseholds.mockResolvedValue({ households: [{ id: "h1" }] });
    const { sendPortfolioAlertsForAllUsers } = await import("./portfolioAlerts");

    expect(await sendPortfolioAlertsForAllUsers()).toEqual({ sent: 0, skipped: 1, errors: [] });
    expect(mockGetAlertSettingsForUser).not.toHaveBeenCalled();
  });

  it("skips a user who has portfolio alerts disabled", async () => {
    mockFrom.mockImplementation((table: string) =>
      table === "household_members" ? ownersQuery(["u1"]) : mockQuery({ error: null }),
    );
    mockGetAlertSettingsForUser.mockResolvedValue({
      enabled: true,
      portfolioAlertsEnabled: false,
    });
    const { sendPortfolioAlertsForAllUsers } = await import("./portfolioAlerts");

    expect(await sendPortfolioAlertsForAllUsers()).toEqual({ sent: 0, skipped: 1, errors: [] });
    expect(mockFetchCrossPropertySnapshots).not.toHaveBeenCalled();
  });

  it("skips a user whose alerts are globally disabled", async () => {
    mockFrom.mockImplementation((table: string) =>
      table === "household_members" ? ownersQuery(["u1"]) : mockQuery({ error: null }),
    );
    mockGetAlertSettingsForUser.mockResolvedValue({
      enabled: false,
      portfolioAlertsEnabled: true,
    });
    const { sendPortfolioAlertsForAllUsers } = await import("./portfolioAlerts");

    expect(await sendPortfolioAlertsForAllUsers()).toEqual({ sent: 0, skipped: 1, errors: [] });
  });

  it("skips a user still within the cooldown window", async () => {
    mockFrom.mockImplementation((table: string) =>
      table === "household_members" ? ownersQuery(["u1"]) : mockQuery({ error: null }),
    );
    mockGetAlertSettingsForUser.mockResolvedValue({
      enabled: true,
      portfolioAlertsEnabled: true,
      lastPortfolioAlertAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1h ago
    });
    const { sendPortfolioAlertsForAllUsers } = await import("./portfolioAlerts");

    expect(await sendPortfolioAlertsForAllUsers()).toEqual({ sent: 0, skipped: 1, errors: [] });
    expect(mockFetchCrossPropertySnapshots).not.toHaveBeenCalled();
  });

  it("sends after the cooldown window has passed", async () => {
    const updateBuilder = mockQuery({ error: null });
    mockFrom.mockImplementation((table: string) =>
      table === "household_members" ? ownersQuery(["u1"]) : updateBuilder,
    );
    mockGetAlertSettingsForUser.mockResolvedValue({
      enabled: true,
      portfolioAlertsEnabled: true,
      lastPortfolioAlertAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5h ago
    });
    mockFetchCrossPropertySnapshots.mockResolvedValue({
      properties: [
        { name: "Lakehouse", atRisk: true, minTempF: 28.4, freezeThresholdF: 32 },
      ],
    });
    const { sendPortfolioAlertsForAllUsers } = await import("./portfolioAlerts");

    const result = await sendPortfolioAlertsForAllUsers();

    expect(result).toEqual({ sent: 1, skipped: 0, errors: [] });
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_portfolio_alert_at: expect.any(String) }),
    );
  });

  it("skips when no properties are at risk", async () => {
    mockFrom.mockImplementation((table: string) =>
      table === "household_members" ? ownersQuery(["u1"]) : mockQuery({ error: null }),
    );
    mockFetchCrossPropertySnapshots.mockResolvedValue({
      properties: [{ name: "Lakehouse", atRisk: false, minTempF: 55, freezeThresholdF: 32 }],
    });
    const { sendPortfolioAlertsForAllUsers } = await import("./portfolioAlerts");

    expect(await sendPortfolioAlertsForAllUsers()).toEqual({ sent: 0, skipped: 1, errors: [] });
    expect(mockNotifyUser).not.toHaveBeenCalled();
  });

  it("builds a singular-vs-plural digest body and notifies the user", async () => {
    mockFrom.mockImplementation((table: string) =>
      table === "household_members" ? ownersQuery(["u1"]) : mockQuery({ error: null }),
    );
    mockFetchCrossPropertySnapshots.mockResolvedValue({
      properties: [
        { name: "Lakehouse", atRisk: true, minTempF: 28.44, freezeThresholdF: 32 },
        { name: "Cabin", atRisk: true, minTempF: 20, freezeThresholdF: 34 },
        { name: "Condo", atRisk: false, minTempF: 60, freezeThresholdF: 32 },
      ],
    });
    const { sendPortfolioAlertsForAllUsers } = await import("./portfolioAlerts");

    await sendPortfolioAlertsForAllUsers();

    expect(mockNotifyUser).toHaveBeenCalledWith(
      "u1",
      "owner@example.com",
      expect.objectContaining({ enabled: true }),
      {
        title: "Properties at risk today (2)",
        body: "Landlord digest — 2 properties are at or below freeze:\nLakehouse: 28.4°F (threshold 32°F)\nCabin: 20.0°F (threshold 34°F)",
        kind: "threshold",
      },
    );
  });

  it("uses singular phrasing for exactly one at-risk property", async () => {
    mockFrom.mockImplementation((table: string) =>
      table === "household_members" ? ownersQuery(["u1"]) : mockQuery({ error: null }),
    );
    mockFetchCrossPropertySnapshots.mockResolvedValue({
      properties: [{ name: "Lakehouse", atRisk: true, minTempF: 28.4, freezeThresholdF: 32 }],
    });
    const { sendPortfolioAlertsForAllUsers } = await import("./portfolioAlerts");

    await sendPortfolioAlertsForAllUsers();

    expect(mockNotifyUser).toHaveBeenCalledWith(
      "u1",
      "owner@example.com",
      expect.anything(),
      expect.objectContaining({
        title: "Properties at risk today (1)",
        body: expect.stringContaining("1 property is at or below freeze"),
      }),
    );
  });

  it("records a per-user error without stopping the batch", async () => {
    mockFrom.mockImplementation((table: string) =>
      table === "household_members" ? ownersQuery(["u1", "u2"]) : mockQuery({ error: null }),
    );
    mockGetUserEntitlements.mockImplementation(async (userId: string) => {
      if (userId === "u1") throw new Error("entitlements lookup failed");
      return { canUsePortfolio: false };
    });
    const { sendPortfolioAlertsForAllUsers } = await import("./portfolioAlerts");

    const result = await sendPortfolioAlertsForAllUsers();

    expect(result.errors).toEqual(["u1: entitlements lookup failed"]);
    expect(result.skipped).toBe(1);
  });

  it("records a generic message for a non-Error throw", async () => {
    mockFrom.mockImplementation((table: string) =>
      table === "household_members" ? ownersQuery(["u1"]) : mockQuery({ error: null }),
    );
    mockGetUserEntitlements.mockRejectedValue("nope");
    const { sendPortfolioAlertsForAllUsers } = await import("./portfolioAlerts");

    const result = await sendPortfolioAlertsForAllUsers();

    expect(result.errors).toEqual(["u1: Unknown error"]);
  });
});
