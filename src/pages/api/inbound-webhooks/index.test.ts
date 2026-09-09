import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockGetUserHouseholdId = vi.fn();
const mockGetUserHouseholdRole = vi.fn();
const mockCanManageHousehold = vi.fn();
vi.mock("../../../lib/households", () => ({
  getUserHouseholdId: (...a: unknown[]) => mockGetUserHouseholdId(...a),
  getUserHouseholdRole: (...a: unknown[]) => mockGetUserHouseholdRole(...a),
  canManageHousehold: (...a: unknown[]) => mockCanManageHousehold(...a),
}));

const mockCreateInboundWebhook = vi.fn();
const mockListInboundWebhooks = vi.fn();
const mockRevokeInboundWebhook = vi.fn();
vi.mock("../../../lib/inboundWebhooks", () => ({
  createInboundWebhook: (...a: unknown[]) => mockCreateInboundWebhook(...a),
  listInboundWebhooks: (...a: unknown[]) => mockListInboundWebhooks(...a),
  revokeInboundWebhook: (...a: unknown[]) => mockRevokeInboundWebhook(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("../../../lib/entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

const mockSetSecretFlash = vi.fn();
vi.mock("../../../lib/secretFlash", () => ({
  FLASH_INBOUND_SIGNING: "inbound_signing",
  FLASH_INBOUND_TOKEN: "inbound_token",
  setSecretFlash: (...a: unknown[]) => mockSetSecretFlash(...a),
}));

function makeGetContext(): APIContext {
  return { cookies: {} } as unknown as APIContext;
}

function makePostContext(form: Record<string, string>): APIContext {
  const formData = new FormData();
  for (const [k, v] of Object.entries(form)) formData.set(k, v);
  const request = { formData: async () => formData } as unknown as Request;
  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));
  return { request, cookies: {}, redirect } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "at" },
    user: { id: "user-1" },
  });
  mockGetUserHouseholdId.mockReset().mockResolvedValue("house-1");
  mockGetUserHouseholdRole.mockReset().mockResolvedValue("manager");
  mockCanManageHousehold.mockReset().mockReturnValue(true);
  mockCreateInboundWebhook.mockReset().mockResolvedValue({
    token: "webhook-token",
    signingSecret: "webhook-secret",
    error: null,
  });
  mockListInboundWebhooks.mockReset().mockResolvedValue({ webhooks: [{ id: "wh-1" }] });
  mockRevokeInboundWebhook.mockReset().mockResolvedValue(undefined);
  mockGetUserEntitlements.mockReset().mockResolvedValue({ canUseOutboundWebhook: true });
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/share");
  mockSetSecretFlash.mockReset();
});

describe("GET /api/inbound-webhooks", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./index");

    const response = await GET(makeGetContext());

    expect(response.status).toBe(401);
  });

  it("returns an empty list when the user has no household", async () => {
    mockGetUserHouseholdId.mockResolvedValue(null);
    const { GET } = await import("./index");

    const response = await GET(makeGetContext());

    expect(await response.json()).toEqual({ webhooks: [] });
    expect(mockListInboundWebhooks).not.toHaveBeenCalled();
  });

  it("returns the household's webhooks", async () => {
    const { GET } = await import("./index");

    const response = await GET(makeGetContext());

    expect(await response.json()).toEqual({ webhooks: [{ id: "wh-1" }] });
  });
});

describe("POST /api/inbound-webhooks", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./index");
    const context = makePostContext({ action: "create" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
  });

  it("redirects with a pro error when the plan lacks outbound webhooks", async () => {
    mockGetUserEntitlements.mockResolvedValue({ canUseOutboundWebhook: false });
    const { POST } = await import("./index");
    const context = makePostContext({ action: "create" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/share?inbound_error=pro");
  });

  it("redirects with an error when the user has no household", async () => {
    mockGetUserHouseholdId.mockResolvedValue(null);
    const { POST } = await import("./index");
    const context = makePostContext({ action: "create" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/share?inbound_error=1");
  });

  it("redirects when the user isn't a household manager", async () => {
    mockCanManageHousehold.mockReturnValue(false);
    const { POST } = await import("./index");
    const context = makePostContext({ action: "create" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/share?inbound_error=manager_required",
    );
  });

  it("creates a webhook, stashes the flash secrets, and redirects", async () => {
    const { POST } = await import("./index");
    const context = makePostContext({ action: "create", name: "My webhook" });

    await POST(context);

    expect(mockCreateInboundWebhook).toHaveBeenCalledWith("house-1", "user-1", "My webhook");
    expect(mockSetSecretFlash).toHaveBeenCalledWith(
      context.cookies,
      "inbound_token",
      "webhook-token",
    );
    expect(mockSetSecretFlash).toHaveBeenCalledWith(
      context.cookies,
      "inbound_signing",
      "webhook-secret",
    );
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/share?inbound_created=1");
  });

  it("defaults the webhook name when none is given", async () => {
    const { POST } = await import("./index");
    const context = makePostContext({ action: "create" });

    await POST(context);

    expect(mockCreateInboundWebhook).toHaveBeenCalledWith("house-1", "user-1", "Inbound webhook");
  });

  it("redirects with an error when creation fails", async () => {
    mockCreateInboundWebhook.mockResolvedValue({ token: null, signingSecret: null, error: "boom" });
    const { POST } = await import("./index");
    const context = makePostContext({ action: "create" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/share?inbound_error=1");
  });

  it("revokes a webhook and redirects", async () => {
    const { POST } = await import("./index");
    const context = makePostContext({ action: "revoke", webhook_id: "wh-1" });

    await POST(context);

    expect(mockRevokeInboundWebhook).toHaveBeenCalledWith("wh-1", "house-1");
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/share?inbound_revoked=1");
  });

  it("redirects without revoking when webhook_id is missing", async () => {
    const { POST } = await import("./index");
    const context = makePostContext({ action: "revoke" });

    await POST(context);

    expect(mockRevokeInboundWebhook).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/share?inbound_revoked=1");
  });

  it("redirects plainly for an unrecognized action", async () => {
    const { POST } = await import("./index");
    const context = makePostContext({ action: "bogus" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/share");
  });
});
