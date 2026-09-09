import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("../../../lib/entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

const mockGetOrCreateHouseholdForUser = vi.fn();
const mockGetUserHouseholdRole = vi.fn();
const mockCanEditHousehold = vi.fn();
vi.mock("../../../lib/households", () => ({
  getOrCreateHouseholdForUser: (...a: unknown[]) => mockGetOrCreateHouseholdForUser(...a),
  getUserHouseholdRole: (...a: unknown[]) => mockGetUserHouseholdRole(...a),
  canEditHousehold: (...a: unknown[]) => mockCanEditHousehold(...a),
}));

const mockBuildSiteUrl = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  buildSiteUrl: (...a: unknown[]) => mockBuildSiteUrl(...a),
}));

const mockListConnectionsForHousehold = vi.fn();
vi.mock("../../../lib/thermostatConnections", () => ({
  listConnectionsForHousehold: (...a: unknown[]) => mockListConnectionsForHousehold(...a),
}));

const mockFetchThermostatContext = vi.fn();
vi.mock("../../../lib/thermostatCorrelation", () => ({
  fetchThermostatContext: (...a: unknown[]) => mockFetchThermostatContext(...a),
}));

const mockIsNestOAuthConfigured = vi.fn();
const mockIsEcobeeOAuthConfigured = vi.fn();
vi.mock("../../../lib/thermostatOAuth", () => ({
  isNestOAuthConfigured: () => mockIsNestOAuthConfigured(),
  isEcobeeOAuthConfigured: () => mockIsEcobeeOAuthConfigured(),
}));

function makeContext(): APIContext {
  const url = new URL("https://example.com/api/integrations/thermostat");
  return {
    cookies: {},
    request: new Request(url),
    site: new URL("https://example.com"),
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "at" },
    user: { id: "user-1", email: "user@example.com" },
  });
  mockGetUserEntitlements.mockReset().mockResolvedValue({ canUseThermostatIntegration: true });
  mockGetOrCreateHouseholdForUser.mockReset().mockResolvedValue({ householdId: "house-1" });
  mockGetUserHouseholdRole.mockReset().mockResolvedValue("owner");
  mockCanEditHousehold.mockReset().mockReturnValue(true);
  mockBuildSiteUrl.mockReset().mockReturnValue("https://example.com");
  mockIsNestOAuthConfigured.mockReset().mockReturnValue(true);
  mockIsEcobeeOAuthConfigured.mockReset().mockReturnValue(true);
  mockListConnectionsForHousehold.mockReset().mockResolvedValue([
    { provider: "nest", createdAt: "2024-01-01T00:00:00.000Z" },
  ]);
  mockFetchThermostatContext.mockReset().mockResolvedValue({
    ambientTempF: 70,
    heatSetpointF: 68,
    hvacMode: "HEAT",
  });
});

describe("GET /api/integrations/thermostat", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./thermostat");

    const response = await GET(makeContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns empty connections when the user has no household", async () => {
    mockGetOrCreateHouseholdForUser.mockResolvedValue({ householdId: null });
    const { GET } = await import("./thermostat");

    const response = await GET(makeContext());
    const json = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(json.can_use).toBe(true);
    expect(json.connections).toEqual([]);
    expect(json.connect_urls).toEqual({
      nest: "https://example.com/api/integrations/nest/connect",
      ecobee: "https://example.com/api/integrations/ecobee/connect",
    });
    expect(mockListConnectionsForHousehold).not.toHaveBeenCalled();
  });

  it("omits connect urls for providers that are not configured", async () => {
    mockGetOrCreateHouseholdForUser.mockResolvedValue({ householdId: null });
    mockIsNestOAuthConfigured.mockReturnValue(false);
    mockIsEcobeeOAuthConfigured.mockReturnValue(true);
    const { GET } = await import("./thermostat");

    const response = await GET(makeContext());
    const json = (await response.json()) as Record<string, unknown>;

    expect(json.configured).toEqual({ nest: false, ecobee: true });
    expect(json.connect_urls).toEqual({
      ecobee: "https://example.com/api/integrations/ecobee/connect",
    });
  });

  it("returns connection snapshots and mobile connect urls for editors", async () => {
    const { GET } = await import("./thermostat");

    const response = await GET(makeContext());
    const json = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(json.can_use).toBe(true);
    expect(json.can_connect).toBe(true);
    expect(json.connections).toEqual([
      {
        provider: "nest",
        connected_at: "2024-01-01T00:00:00.000Z",
        ambient_temp_f: 70,
        heat_setpoint_f: 68,
        hvac_mode: "HEAT",
      },
    ]);
    expect(json.connect_urls).toEqual({
      nest: "https://example.com/api/integrations/nest/connect?mobile=1",
      ecobee: "https://example.com/api/integrations/ecobee/connect?mobile=1",
    });
    expect(json.disconnect_urls).toEqual({
      nest: "https://example.com/api/integrations/nest/disconnect",
      ecobee: "https://example.com/api/integrations/ecobee/disconnect",
    });
  });

  it("hides connect and disconnect urls when the user cannot connect", async () => {
    mockCanEditHousehold.mockReturnValue(false);
    mockGetUserEntitlements.mockResolvedValue({ canUseThermostatIntegration: true });
    const { GET } = await import("./thermostat");

    const response = await GET(makeContext());
    const json = (await response.json()) as Record<string, unknown>;

    expect(json.can_connect).toBe(false);
    expect(json.connect_urls).toBeNull();
    expect(json.disconnect_urls).toBeNull();
  });

  it("sets can_use false when the plan lacks thermostat integration", async () => {
    mockGetUserEntitlements.mockResolvedValue({ canUseThermostatIntegration: false });
    mockCanEditHousehold.mockReturnValue(true);
    const { GET } = await import("./thermostat");

    const response = await GET(makeContext());
    const json = (await response.json()) as Record<string, unknown>;

    expect(json.can_use).toBe(false);
    expect(json.can_connect).toBe(false);
    expect(json.connect_urls).toBeNull();
  });
});
