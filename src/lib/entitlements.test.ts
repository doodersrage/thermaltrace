import { describe, expect, it, vi, beforeEach } from "vitest";

const mockIsUserAdmin = vi.fn();
const mockIsUserInGroup = vi.fn();

vi.mock("./adminAccess", () => ({
  MEMBER_GROUP_NAME: "member",
  isUserAdmin: (...args: unknown[]) => mockIsUserAdmin(...args),
  isUserInGroup: (...args: unknown[]) => mockIsUserInGroup(...args),
}));

// entitlements.ts imports PRO_GROUP_NAME/PORTFOLIO_GROUP_NAME from itself
// (defined locally) but resolves group membership through isUserInGroup,
// so the mock above only needs to fake admin + generic group lookups.

function mockGroups(memberships: { admin?: boolean; portfolio?: boolean; pro?: boolean; member?: boolean }) {
  mockIsUserAdmin.mockResolvedValue(Boolean(memberships.admin));
  mockIsUserInGroup.mockImplementation(async (_userId: string, groupName: string) => {
    if (groupName === "portfolio") return Boolean(memberships.portfolio);
    if (groupName === "pro") return Boolean(memberships.pro);
    if (groupName === "member") return Boolean(memberships.member);
    return false;
  });
}

beforeEach(() => {
  mockIsUserAdmin.mockReset();
  mockIsUserInGroup.mockReset();
});

describe("getUserEntitlements tier resolution", () => {
  it("falls back to free when the user has no group memberships", async () => {
    mockGroups({});
    const { getUserEntitlements } = await import("./entitlements");

    const entitlements = await getUserEntitlements("user-1");

    expect(entitlements.tier).toBe("free");
    expect(entitlements.maxDevices).toBe(2);
    expect(entitlements.historyDays).toBe(7);
    expect(entitlements.canDownloadCsv).toBe(false);
    expect(entitlements.canUseSms).toBe(false);
    // Every tier, including free, gets one family live share link.
    expect(entitlements.canCreateFamilyShareLink).toBe(true);
  });

  it("grants member-tier gates for a member-only user", async () => {
    mockGroups({ member: true });
    const { getUserEntitlements } = await import("./entitlements");

    const entitlements = await getUserEntitlements("user-2");

    expect(entitlements.tier).toBe("member");
    expect(entitlements.canDownloadCsv).toBe(true);
    expect(entitlements.canUseForecastAlerts).toBe(true);
    // Pro-only gates must stay locked for member.
    expect(entitlements.canUseSms).toBe(false);
    expect(entitlements.canUsePortfolio).toBe(false);
    expect(entitlements.maxDevices).toBe(6);
    expect(entitlements.historyDays).toBe(90);
  });

  it("grants pro-tier gates for a pro user", async () => {
    mockGroups({ pro: true });
    const { getUserEntitlements } = await import("./entitlements");

    const entitlements = await getUserEntitlements("user-3");

    expect(entitlements.tier).toBe("pro");
    expect(entitlements.canUseSms).toBe(true);
    expect(entitlements.canUsePush).toBe(true);
    expect(entitlements.canUseOutboundWebhook).toBe(true);
    expect(entitlements.canCreateShareLinks).toBe(true);
    expect(entitlements.canUseClaimsPack).toBe(true);
    expect(entitlements.canUsePortfolio).toBe(true);
    expect(entitlements.canUseThermostatIntegration).toBe(true);
    expect(entitlements.maxDevices).toBe(24);
    expect(entitlements.maxOwnedHouseholds).toBe(50);
    expect(entitlements.historyDays).toBe(365);
  });

  it("gives portfolio a higher household ceiling than pro without lowering any other pro gate", async () => {
    mockGroups({ portfolio: true });
    const { getUserEntitlements } = await import("./entitlements");

    const entitlements = await getUserEntitlements("user-4");

    expect(entitlements.tier).toBe("portfolio");
    expect(entitlements.maxOwnedHouseholds).toBe(500);
    // Portfolio is a strict superset of pro -- same feature gates.
    expect(entitlements.canUseSms).toBe(true);
    expect(entitlements.canUsePortfolio).toBe(true);
    expect(entitlements.maxDevices).toBe(24);
  });

  it("treats admin as at least portfolio-equivalent regardless of group membership", async () => {
    mockGroups({ admin: true });
    const { getUserEntitlements } = await import("./entitlements");

    const entitlements = await getUserEntitlements("user-5");

    expect(entitlements.tier).toBe("admin");
    expect(entitlements.canUsePortfolio).toBe(true);
    expect(entitlements.maxOwnedHouseholds).toBe(500);
  });

  it("prioritizes admin over portfolio/pro/member when a user somehow holds multiple groups", async () => {
    mockGroups({ admin: true, portfolio: true, pro: true, member: true });
    const { getUserEntitlements } = await import("./entitlements");

    const entitlements = await getUserEntitlements("user-6");

    expect(entitlements.tier).toBe("admin");
  });

  it("prioritizes portfolio over pro and member when both are present", async () => {
    mockGroups({ portfolio: true, pro: true, member: true });
    const { getUserEntitlements } = await import("./entitlements");

    const entitlements = await getUserEntitlements("user-7");

    expect(entitlements.tier).toBe("portfolio");
  });
});

describe("formatHistoryRetention", () => {
  it("formats sub-year retention in days", async () => {
    const { formatHistoryRetention } = await import("./entitlements");
    expect(formatHistoryRetention(7)).toBe("7 days");
    expect(formatHistoryRetention(90)).toBe("90 days");
  });

  it("formats exactly one year as a singular label", async () => {
    const { formatHistoryRetention } = await import("./entitlements");
    expect(formatHistoryRetention(365)).toBe("1 year");
  });

  it("formats multi-year retention with a plural label", async () => {
    const { formatHistoryRetention } = await import("./entitlements");
    expect(formatHistoryRetention(730)).toBe("2 years");
  });

  it("formats a non-integer number of years to one decimal place", async () => {
    const { formatHistoryRetention } = await import("./entitlements");
    expect(formatHistoryRetention(400)).toBe(`${(400 / 365).toFixed(1)} years`);
  });
});
