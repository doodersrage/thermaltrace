import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
}));

const mockCountOwnedHouseholds = vi.fn();
const mockGetOwnedHouseholdId = vi.fn();
const mockGetOrCreateHouseholdForUser = vi.fn();
const mockLeaveHousehold = vi.fn();
const mockListHouseholdMembers = vi.fn();
const mockListUserHouseholds = vi.fn();
const mockRemoveHouseholdMember = vi.fn();
const mockSetActiveHouseholdForUser = vi.fn();
const mockUpdateHouseholdName = vi.fn();
const mockCreateAdditionalHouseholdForUser = vi.fn();
vi.mock("../../../lib/households", () => ({
  countOwnedHouseholds: (...a: unknown[]) => mockCountOwnedHouseholds(...a),
  getOwnedHouseholdId: (...a: unknown[]) => mockGetOwnedHouseholdId(...a),
  getOrCreateHouseholdForUser: (...a: unknown[]) => mockGetOrCreateHouseholdForUser(...a),
  leaveHousehold: (...a: unknown[]) => mockLeaveHousehold(...a),
  listHouseholdMembers: (...a: unknown[]) => mockListHouseholdMembers(...a),
  listUserHouseholds: (...a: unknown[]) => mockListUserHouseholds(...a),
  removeHouseholdMember: (...a: unknown[]) => mockRemoveHouseholdMember(...a),
  setActiveHouseholdForUser: (...a: unknown[]) => mockSetActiveHouseholdForUser(...a),
  updateHouseholdName: (...a: unknown[]) => mockUpdateHouseholdName(...a),
  createAdditionalHouseholdForUser: (...a: unknown[]) =>
    mockCreateAdditionalHouseholdForUser(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("../../../lib/entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

const mockCreateHouseholdInvite = vi.fn();
const mockListPendingInvites = vi.fn();
const mockParseHouseholdInviteRole = vi.fn();
const mockRevokeHouseholdInvite = vi.fn();
const mockSendInviteEmail = vi.fn();
vi.mock("../../../lib/householdInvites", () => ({
  createHouseholdInvite: (...a: unknown[]) => mockCreateHouseholdInvite(...a),
  listPendingInvites: (...a: unknown[]) => mockListPendingInvites(...a),
  parseHouseholdInviteRole: (...a: unknown[]) => mockParseHouseholdInviteRole(...a),
  revokeHouseholdInvite: (...a: unknown[]) => mockRevokeHouseholdInvite(...a),
  sendInviteEmail: (...a: unknown[]) => mockSendInviteEmail(...a),
}));

const mockBuildSiteUrl = vi.fn();
vi.mock("../../../lib/stripe", () => ({
  buildSiteUrl: (...a: unknown[]) => mockBuildSiteUrl(...a),
}));

const mockUpdateHouseholdFreezeMapSettings = vi.fn();
const mockGetHouseholdFreezeMapSettings = vi.fn();
vi.mock("../../../lib/freezeMap", () => ({
  updateHouseholdFreezeMapSettings: (...a: unknown[]) =>
    mockUpdateHouseholdFreezeMapSettings(...a),
  getHouseholdFreezeMapSettings: (...a: unknown[]) => mockGetHouseholdFreezeMapSettings(...a),
}));

const mockGetIndoorReferenceSensorId = vi.fn();
vi.mock("../../../lib/indoorReference", () => ({
  getIndoorReferenceSensorId: (...a: unknown[]) => mockGetIndoorReferenceSensorId(...a),
}));

const mockRequireHouseholdManager = vi.fn();
const mockRedirectUnlessManager = vi.fn();
vi.mock("../../../lib/householdAuth", () => ({
  requireHouseholdManager: (...a: unknown[]) => mockRequireHouseholdManager(...a),
  redirectUnlessManager: (...a: unknown[]) => mockRedirectUnlessManager(...a),
}));

const mockRecordHouseholdActivity = vi.fn();
vi.mock("../../../lib/householdActivity", () => ({
  recordHouseholdActivity: (...a: unknown[]) => mockRecordHouseholdActivity(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

function mockQuery(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["eq", "maybeSingle", "select"]) {
    builder[method] = vi.fn(() => builder);
  }
  (builder as { then: unknown }).then = (
    resolve: (v: unknown) => unknown,
    reject: (v: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

const mockFrom = vi.fn();
const mockCreateServerClient = vi.fn(() => ({ from: mockFrom }));
vi.mock("../../../lib/supabase", () => ({
  createServerClient: () => mockCreateServerClient(),
}));

function makeGetContext(): APIContext {
  return {
    request: { url: "https://example.com/api/household" } as unknown as Request,
    cookies: {},
  } as unknown as APIContext;
}

function makePostContext(fields: Record<string, string> = {}): APIContext {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const request = {
    url: "https://example.com/api/household",
    formData: () => Promise.resolve(form),
  } as unknown as Request;
  const redirect = vi.fn(
    (path: string) => new Response(null, { status: 302, headers: { Location: path } }),
  );
  return { request, cookies: {}, redirect } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({
    user: { id: "user-1", email: "user@example.com" },
  });
  mockGetOrCreateHouseholdForUser.mockReset().mockResolvedValue({
    householdId: "house-1",
    error: null,
  });
  mockListHouseholdMembers.mockReset().mockResolvedValue({
    members: [{ user_id: "user-1", role: "owner" }],
  });
  mockListUserHouseholds.mockReset().mockResolvedValue({
    households: [{ id: "house-1", name: "Home" }],
  });
  mockListPendingInvites.mockReset().mockResolvedValue({
    invites: [{ id: "inv-1", email: "a@b.com", token: "secrettoken" }],
  });
  mockGetHouseholdFreezeMapSettings.mockReset().mockResolvedValue({
    optIn: false,
    cityId: null,
    label: null,
    lat: null,
    lon: null,
  });
  mockGetIndoorReferenceSensorId.mockReset().mockResolvedValue(null);
  mockRequireHouseholdManager.mockReset().mockResolvedValue({
    ok: true,
    ctx: { householdId: "house-1", role: "owner" },
  });
  mockRedirectUnlessManager.mockReset().mockReturnValue(null);
  mockGetOwnedHouseholdId.mockReset().mockResolvedValue("house-1");
  mockSetActiveHouseholdForUser.mockReset().mockResolvedValue({ error: null });
  mockLeaveHousehold.mockReset().mockResolvedValue({ error: null });
  mockGetUserEntitlements.mockReset().mockResolvedValue({
    maxOwnedHouseholds: 3,
    tier: "pro",
  });
  mockCountOwnedHouseholds.mockReset().mockResolvedValue(1);
  mockCreateAdditionalHouseholdForUser.mockReset().mockResolvedValue({
    householdId: "house-2",
    error: null,
  });
  mockRecordHouseholdActivity.mockReset().mockResolvedValue(undefined);
  mockUpdateHouseholdName.mockReset().mockResolvedValue(undefined);
  mockUpdateHouseholdFreezeMapSettings.mockReset().mockResolvedValue({ error: null });
  mockRemoveHouseholdMember.mockReset().mockResolvedValue({ error: null });
  mockRevokeHouseholdInvite.mockReset().mockResolvedValue({ error: null });
  mockParseHouseholdInviteRole.mockReset().mockReturnValue("member");
  mockCreateHouseholdInvite.mockReset().mockResolvedValue({
    invite: { token: "new-invite-tok" },
    error: null,
  });
  mockSendInviteEmail.mockReset().mockResolvedValue(undefined);
  mockBuildSiteUrl.mockReset().mockReturnValue("https://example.com/invite/new-invite-tok");
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/household");
  mockFrom.mockReset().mockImplementation(() =>
    mockQuery({ data: { name: "Home" }, error: null }),
  );
  mockCreateServerClient.mockClear();
});

describe("GET /api/household", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ user: null });
    const { GET } = await import("./index");

    const response = await GET(makeGetContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 500 when household resolution fails", async () => {
    mockGetOrCreateHouseholdForUser.mockResolvedValue({
      householdId: null,
      error: "db down",
    });
    const { GET } = await import("./index");

    const response = await GET(makeGetContext());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "db down" });
  });

  it("returns household payload and full invite tokens for managers", async () => {
    const { GET } = await import("./index");

    const response = await GET(makeGetContext());
    const json = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(json.householdId).toBe("house-1");
    expect(json.members).toEqual([{ user_id: "user-1", role: "owner" }]);
    expect(json.invites).toEqual([{ id: "inv-1", email: "a@b.com", token: "secrettoken" }]);
    expect(json.indoor_reference_sensor_id).toBeNull();
    expect(json.freeze_map).toEqual({
      opt_in: false,
      city_id: null,
      label: null,
      lat: null,
      lon: null,
    });
  });

  it("redacts invite tokens for non-managers", async () => {
    mockRequireHouseholdManager.mockResolvedValue({ ok: false, error: "manager_required" });
    const { GET } = await import("./index");

    const json = (await (await GET(makeGetContext())).json()) as {
      invites: Array<{ token: string | null; token_preview: string }>;
    };

    expect(json.invites).toEqual([
      { id: "inv-1", email: "a@b.com", token: null, token_preview: "oken" },
    ]);
  });
});

describe("POST /api/household", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ user: null });
    const { POST } = await import("./index");
    const context = makePostContext({ action: "switch", household_id: "house-1" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
  });

  it("switches the active household", async () => {
    const { POST } = await import("./index");
    const context = makePostContext({ action: "switch", household_id: "house-2" });

    await POST(context);

    expect(mockSetActiveHouseholdForUser).toHaveBeenCalledWith("user-1", "house-2");
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/household?switched=1");
  });

  it("redirects with error when switch is missing household_id", async () => {
    const { POST } = await import("./index");
    const context = makePostContext({ action: "switch" });

    await POST(context);

    expect(mockSetActiveHouseholdForUser).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/household?error=1");
  });

  it("redirects with encoded error when switch fails", async () => {
    mockSetActiveHouseholdForUser.mockResolvedValue({ error: "not allowed" });
    const { POST } = await import("./index");
    const context = makePostContext({ action: "switch", household_id: "house-2" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/household?error=not%20allowed",
    );
  });

  it("leaves a household", async () => {
    const { POST } = await import("./index");
    const context = makePostContext({ action: "leave", household_id: "house-2" });

    await POST(context);

    expect(mockLeaveHousehold).toHaveBeenCalledWith("user-1", "house-2");
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/household?left=1");
  });

  it("maps cannot-leave-owner errors", async () => {
    mockLeaveHousehold.mockResolvedValue({ error: "Cannot remove the household owner" });
    const { POST } = await import("./index");
    const context = makePostContext({ action: "leave", household_id: "house-1" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/household?error=cannot_leave_owner",
    );
  });

  it("creates an additional property when under the limit", async () => {
    const { POST } = await import("./index");
    const context = makePostContext({ action: "create_property", name: "Cabin" });

    await POST(context);

    expect(mockCreateAdditionalHouseholdForUser).toHaveBeenCalledWith("user-1", "Cabin");
    expect(mockRecordHouseholdActivity).toHaveBeenCalledWith({
      householdId: "house-2",
      userId: "user-1",
      action: "household_created",
      detail: "Cabin",
    });
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/household?property_created=1");
  });

  it("redirects with property_limit when owned count is at the entitlement max", async () => {
    mockCountOwnedHouseholds.mockResolvedValue(3);
    const { POST } = await import("./index");
    const context = makePostContext({ action: "create_property", name: "Cabin" });

    await POST(context);

    expect(mockCreateAdditionalHouseholdForUser).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/household?error=property_limit");
  });

  it("returns the manager block response for non-managers on manage actions", async () => {
    const blocked = new Response(null, {
      status: 302,
      headers: { Location: "/dashboard/household?error=manager_required" },
    });
    mockRedirectUnlessManager.mockReturnValue(blocked);
    const { POST } = await import("./index");
    const context = makePostContext({ action: "rename", name: "New name" });

    const response = await POST(context);

    expect(response).toBe(blocked);
    expect(mockUpdateHouseholdName).not.toHaveBeenCalled();
  });

  it("renames the household", async () => {
    const { POST } = await import("./index");
    const context = makePostContext({ action: "rename", name: "Renamed" });

    await POST(context);

    expect(mockUpdateHouseholdName).toHaveBeenCalledWith("house-1", "Renamed");
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/household?saved=1");
  });

  it("updates freeze map settings for an owned household", async () => {
    const { POST } = await import("./index");
    const context = makePostContext({
      action: "freeze_map",
      freeze_map_opt_in: "on",
      freeze_map_city_id: "city-1",
      freeze_map_label: "Town",
      freeze_map_lat: "42.1",
      freeze_map_lon: "-71.2",
    });

    await POST(context);

    expect(mockUpdateHouseholdFreezeMapSettings).toHaveBeenCalledWith("house-1", {
      optIn: true,
      cityId: "city-1",
      lat: 42.1,
      lon: -71.2,
      label: "Town",
    });
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/household?saved=1");
  });

  it("removes a household member", async () => {
    const { POST } = await import("./index");
    const context = makePostContext({ action: "remove", user_id: "user-2" });

    await POST(context);

    expect(mockRemoveHouseholdMember).toHaveBeenCalledWith("house-1", "user-2");
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/household?removed=1");
  });

  it("revokes an invite", async () => {
    const { POST } = await import("./index");
    const context = makePostContext({ action: "revoke_invite", invite_id: "inv-1" });

    await POST(context);

    expect(mockRevokeHouseholdInvite).toHaveBeenCalledWith("house-1", "inv-1");
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/household?invite_revoked=1");
  });

  it("redirects with missing_email when invite email is blank", async () => {
    const { POST } = await import("./index");
    const context = makePostContext({ action: "invite", email: "  " });

    await POST(context);

    expect(mockCreateHouseholdInvite).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/household?error=missing_email");
  });

  it("requires portfolio tier for property_manager invites", async () => {
    mockParseHouseholdInviteRole.mockReturnValue("property_manager");
    mockGetUserEntitlements.mockResolvedValue({ maxOwnedHouseholds: 3, tier: "pro" });
    const { POST } = await import("./index");
    const context = makePostContext({
      action: "invite",
      email: "pm@example.com",
      role: "property_manager",
    });

    await POST(context);

    expect(mockCreateHouseholdInvite).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/household?error=portfolio_required",
    );
  });

  it("creates an invite, sends email, and redirects with invited=1", async () => {
    const { POST } = await import("./index");
    const context = makePostContext({
      action: "invite",
      email: "New@Example.com",
      role: "member",
    });

    await POST(context);

    expect(mockCreateHouseholdInvite).toHaveBeenCalledWith(
      "house-1",
      "new@example.com",
      "user-1",
      7,
      "member",
    );
    expect(mockSendInviteEmail).toHaveBeenCalledWith(
      "new@example.com",
      "https://example.com/invite/new-invite-tok",
      "Home",
      "user@example.com",
    );
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/household?invited=1");
  });

  it("redirects with error when invite creation fails", async () => {
    mockCreateHouseholdInvite.mockResolvedValue({ invite: null, error: "dup" });
    const { POST } = await import("./index");
    const context = makePostContext({ action: "invite", email: "a@b.com" });

    await POST(context);

    expect(mockSendInviteEmail).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/household?error=1");
  });
});
