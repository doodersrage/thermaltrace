import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AstroCookies } from "astro";

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order"]) {
    builder[method] = vi.fn(() => builder);
  }
  (builder as { then: unknown }).then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

const mockGetAuthFromCookies = vi.fn();
vi.mock("./auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockGetOrCreateHouseholdForUser = vi.fn();
const mockGetUserHouseholdRole = vi.fn();
const mockCanManageHousehold = vi.fn();
vi.mock("./households", () => ({
  getOrCreateHouseholdForUser: (...a: unknown[]) => mockGetOrCreateHouseholdForUser(...a),
  getUserHouseholdRole: (...a: unknown[]) => mockGetUserHouseholdRole(...a),
  canManageHousehold: (...a: unknown[]) => mockCanManageHousehold(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("./entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

const mockFrom = vi.fn();
vi.mock("./supabase", () => ({
  createServerClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}));

const mockGetSiteUrl = vi.fn();
vi.mock("./stripe", () => ({
  getSiteUrl: (...a: unknown[]) => mockGetSiteUrl(...a),
}));

const mockListHouseholdApiKeys = vi.fn();
vi.mock("./apiKeys", () => ({
  listHouseholdApiKeys: (...a: unknown[]) => mockListHouseholdApiKeys(...a),
}));

const mockListInboundWebhooks = vi.fn();
vi.mock("./inboundWebhooks", () => ({
  listInboundWebhooks: (...a: unknown[]) => mockListInboundWebhooks(...a),
}));

const mockListStatusPageTokens = vi.fn();
vi.mock("./statusPage", () => ({
  listStatusPageTokens: (...a: unknown[]) => mockListStatusPageTokens(...a),
}));

const mockListIngestStatsForHousehold = vi.fn();
vi.mock("./ingestStats", () => ({
  listIngestStatsForHousehold: (...a: unknown[]) => mockListIngestStatsForHousehold(...a),
}));

const mockListHouseholdActivity = vi.fn();
vi.mock("./householdActivity", () => ({
  listHouseholdActivity: (...a: unknown[]) => mockListHouseholdActivity(...a),
}));

const mockListRecentWebhookDeliveries = vi.fn();
vi.mock("./webhookDeliveries", () => ({
  listRecentWebhookDeliveries: (...a: unknown[]) => mockListRecentWebhookDeliveries(...a),
}));

const mockConsumeSecretFlash = vi.fn();
vi.mock("./secretFlash", () => ({
  FLASH_API_KEY: "flash_api_key",
  FLASH_INBOUND_SIGNING: "flash_inbound_signing",
  FLASH_INBOUND_TOKEN: "flash_inbound_token",
  FLASH_SHARE_TOKEN: "flash_share_token",
  FLASH_STATUS_TOKEN: "flash_status_token",
  consumeSecretFlash: (...a: unknown[]) => mockConsumeSecretFlash(...a),
}));

const cookies = {} as AstroCookies;
const request = {} as Request;

function urlWith(params: Record<string, string> = {}) {
  const url = new URL("https://example.com/dashboard/share");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { id: "session-1" },
    user: { id: "user-1", email: "user@example.com" },
  });
  mockGetOrCreateHouseholdForUser.mockReset().mockResolvedValue({ householdId: "house-1" });
  mockGetUserHouseholdRole.mockReset().mockResolvedValue("owner");
  mockCanManageHousehold.mockReset().mockReturnValue(true);
  mockGetUserEntitlements.mockReset().mockResolvedValue({ tier: "free" });
  mockFrom.mockReset().mockReturnValue(mockQuery({ data: [] }));
  mockGetSiteUrl.mockReset().mockReturnValue("https://example.com");
  mockListHouseholdApiKeys.mockReset().mockResolvedValue([]);
  mockListInboundWebhooks.mockReset().mockResolvedValue({ webhooks: [] });
  mockListStatusPageTokens.mockReset().mockResolvedValue([]);
  mockListIngestStatsForHousehold.mockReset().mockResolvedValue([]);
  mockListHouseholdActivity.mockReset().mockResolvedValue([]);
  mockListRecentWebhookDeliveries.mockReset().mockResolvedValue([]);
  mockConsumeSecretFlash.mockReset().mockReturnValue(null);
});

describe("loadShareDashboardContext", () => {
  it("redirects to sign-in when there is no session", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { loadShareDashboardContext } = await import("./shareDashboardContext");

    const result = await loadShareDashboardContext(cookies, request, urlWith());

    expect(result).toEqual({ redirect: "/signin" });
  });

  it("skips every household-scoped lookup when the user has no household", async () => {
    mockGetOrCreateHouseholdForUser.mockResolvedValue({ householdId: null });
    const { loadShareDashboardContext } = await import("./shareDashboardContext");

    const result = await loadShareDashboardContext(cookies, request, urlWith());

    expect(result.redirect).toBeNull();
    expect(result.links).toEqual([]);
    expect(result.apiKeys).toEqual([]);
    expect(result.inboundWebhooks).toEqual([]);
    expect(result.statusPages).toEqual([]);
    expect(result.ingestStats).toEqual([]);
    expect(result.activity).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockGetUserHouseholdRole).not.toHaveBeenCalled();
    expect(mockListHouseholdApiKeys).not.toHaveBeenCalled();
  });

  it("returns full share links (including token) for a manager", async () => {
    mockCanManageHousehold.mockReturnValue(true);
    mockFrom.mockReturnValue(
      mockQuery({
        data: [
          {
            id: "link-1",
            token: "supersecrettoken",
            scope: "family",
            label: "Family",
            expires_at: null,
            created_at: "2024-01-01T00:00:00.000Z",
          },
        ],
      }),
    );
    const { loadShareDashboardContext } = await import("./shareDashboardContext");

    const result = await loadShareDashboardContext(cookies, request, urlWith());

    expect(result.links).toEqual([
      {
        id: "link-1",
        token: "supersecrettoken",
        scope: "family",
        label: "Family",
        expires_at: null,
        created_at: "2024-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("redacts the token to a preview for a non-manager", async () => {
    mockCanManageHousehold.mockReturnValue(false);
    mockFrom.mockReturnValue(
      mockQuery({
        data: [
          {
            id: "link-1",
            token: "supersecrettoken",
            scope: "family",
            label: "Family",
            expires_at: null,
            created_at: "2024-01-01T00:00:00.000Z",
          },
        ],
      }),
    );
    const { loadShareDashboardContext } = await import("./shareDashboardContext");

    const result = await loadShareDashboardContext(cookies, request, urlWith());

    expect(result.links).toEqual([
      {
        id: "link-1",
        scope: "family",
        label: "Family",
        expires_at: null,
        created_at: "2024-01-01T00:00:00.000Z",
        token_preview: "oken",
        token: null,
      },
    ]);
  });

  it("only consumes the share/status flash tokens for a manager", async () => {
    mockCanManageHousehold.mockReturnValue(false);
    const { loadShareDashboardContext } = await import("./shareDashboardContext");

    await loadShareDashboardContext(cookies, request, urlWith());

    const consumedKeys = mockConsumeSecretFlash.mock.calls.map((call) => call[1]);
    expect(consumedKeys).not.toContain("flash_share_token");
    expect(consumedKeys).not.toContain("flash_status_token");
    expect(consumedKeys).toContain("flash_inbound_token");
    expect(consumedKeys).toContain("flash_inbound_signing");
    expect(consumedKeys).toContain("flash_api_key");
  });

  it("builds newHref from the site URL and a freshly consumed share token", async () => {
    mockCanManageHousehold.mockReturnValue(true);
    mockConsumeSecretFlash.mockImplementation((_cookies: unknown, key: string) =>
      key === "flash_share_token" ? "abc123" : null,
    );
    const { loadShareDashboardContext } = await import("./shareDashboardContext");

    const result = await loadShareDashboardContext(cookies, request, urlWith());

    expect(result.newToken).toBe("abc123");
    expect(result.newHref).toBe("https://example.com/share/abc123");
  });

  it("leaves newHref null when there is no new token", async () => {
    const { loadShareDashboardContext } = await import("./shareDashboardContext");

    const result = await loadShareDashboardContext(cookies, request, urlWith());

    expect(result.newToken).toBeNull();
    expect(result.newHref).toBeNull();
  });

  it.each([
    ["created", "Share link created, copy it below to send to family."],
    ["revoked", "Share link revoked."],
    ["api_key_created", "API key created, copy it now; it will not be shown again."],
    ["api_key_revoked", "API key revoked."],
    ["status_created", "Status page created, copy the link below."],
    ["status_revoked", "Status page revoked."],
  ])("derives the notice for ?%s", async (param, expected) => {
    const { loadShareDashboardContext } = await import("./shareDashboardContext");

    const result = await loadShareDashboardContext(cookies, request, urlWith({ [param]: "1" }));

    expect(result.notice).toBe(expected);
    expect(result.noticeIsError).toBe(false);
  });

  it.each([
    ["family_limit", "You already have a family live link. Revoke it first, or upgrade to Pro for more."],
    ["pro_required", "That option needs Pro. You can still create one family live link on Free."],
    ["something_else", "Could not update share links."],
  ])("derives an error notice for ?error=%s", async (errorValue, expected) => {
    const { loadShareDashboardContext } = await import("./shareDashboardContext");

    const result = await loadShareDashboardContext(cookies, request, urlWith({ error: errorValue }));

    expect(result.notice).toBe(expected);
    expect(result.noticeIsError).toBe(true);
  });

  it("has no notice and is not an error when no relevant params are present", async () => {
    const { loadShareDashboardContext } = await import("./shareDashboardContext");

    const result = await loadShareDashboardContext(cookies, request, urlWith());

    expect(result.notice).toBeNull();
    expect(result.noticeIsError).toBe(false);
  });
});
