import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
}));

const mockGetOrCreateHouseholdForUser = vi.fn();
vi.mock("../../../lib/households", () => ({
  getOrCreateHouseholdForUser: (...a: unknown[]) => mockGetOrCreateHouseholdForUser(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("../../../lib/entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

const mockRequireHouseholdManager = vi.fn();
vi.mock("../../../lib/householdAuth", () => ({
  requireHouseholdManager: (...a: unknown[]) => mockRequireHouseholdManager(...a),
  redirectUnlessManager: (
    manager: { ok: boolean; error?: string },
    redirectTo: string,
    redirect: (url: string) => Response,
  ) => {
    if (manager.ok) return null;
    return redirect(
      `${redirectTo}?error=${manager.error === "manager_required" ? "manager_required" : "1"}`,
    );
  },
}));

const mockRecordHouseholdActivity = vi.fn();
vi.mock("../../../lib/householdActivity", () => ({
  recordHouseholdActivity: (...a: unknown[]) => mockRecordHouseholdActivity(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

const mockSetSecretFlash = vi.fn();
vi.mock("../../../lib/secretFlash", () => ({
  FLASH_SHARE_TOKEN: "tt_flash_share_token",
  setSecretFlash: (...a: unknown[]) => mockSetSecretFlash(...a),
}));

const mockSelectEq = vi.fn();
const mockSelectOrder = vi.fn();
const mockInsert = vi.fn();
const mockDeleteEq2 = vi.fn();
const mockDeleteEq1 = vi.fn();
const mockDelete = vi.fn();
const mockFrom = vi.fn();
const mockCreateServerClient = vi.fn();
vi.mock("../../../lib/supabase", () => ({
  createServerClient: () => mockCreateServerClient(),
}));

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeGetContext(): APIContext {
  return {
    request: new Request("https://example.com/api/share/manage"),
    cookies: {},
  } as unknown as APIContext;
}

function makePostContext(fields: Record<string, string>): APIContext {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const request = { formData: () => Promise.resolve(form) } as unknown as Request;
  return {
    request,
    cookies: {},
    redirect: fakeRedirect,
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({
    user: { id: "user-1", email: "user@example.com" },
  });
  mockGetOrCreateHouseholdForUser.mockReset().mockResolvedValue({
    householdId: "house-1",
  });
  mockGetUserEntitlements.mockReset().mockResolvedValue({
    canCreateShareLinks: true,
    canCreateFamilyShareLink: true,
  });
  mockRequireHouseholdManager.mockReset().mockResolvedValue({ ok: true });
  mockRecordHouseholdActivity.mockReset().mockResolvedValue(undefined);
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/share");
  mockSetSecretFlash.mockReset();
  mockSelectOrder.mockReset().mockResolvedValue({
    data: [
      {
        id: "link-1",
        token: "abcd1234tokensecret",
        scope: "live",
        label: "Live",
        expires_at: null,
        created_at: "2024-01-01",
      },
    ],
    error: null,
  });
  mockSelectEq.mockReset().mockReturnValue({ order: mockSelectOrder });
  mockInsert.mockReset().mockResolvedValue({ error: null });
  mockDeleteEq2.mockReset().mockResolvedValue({ error: null });
  mockDeleteEq1.mockReset().mockReturnValue({ eq: mockDeleteEq2 });
  mockDelete.mockReset().mockReturnValue({ eq: mockDeleteEq1 });
  mockFrom.mockReset().mockImplementation(() => ({
    select: () => ({ eq: mockSelectEq }),
    insert: mockInsert,
    delete: mockDelete,
  }));
  mockCreateServerClient.mockReset().mockReturnValue({ from: mockFrom });
});

describe("GET /api/share/manage", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ user: null });
    const { GET } = await import("./manage");

    const response = await GET(makeGetContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
  });

  it("returns 500 when household resolution fails", async () => {
    mockGetOrCreateHouseholdForUser.mockResolvedValue({
      householdId: null,
      error: "no household",
    });
    const { GET } = await import("./manage");

    const response = await GET(makeGetContext());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "no household" });
  });

  it("returns full tokens for household managers", async () => {
    const { GET } = await import("./manage");

    const response = await GET(makeGetContext());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      links: [
        {
          id: "link-1",
          token: "abcd1234tokensecret",
          scope: "live",
          label: "Live",
          expires_at: null,
          created_at: "2024-01-01",
        },
      ],
    });
  });

  it("masks tokens for non-managers", async () => {
    mockRequireHouseholdManager.mockResolvedValue({ ok: false });
    const { GET } = await import("./manage");

    const response = await GET(makeGetContext());

    expect(await response.json()).toEqual({
      links: [
        {
          id: "link-1",
          scope: "live",
          label: "Live",
          expires_at: null,
          created_at: "2024-01-01",
          token_preview: "cret",
        },
      ],
    });
  });
});

describe("POST /api/share/manage", () => {
  it("redirects to signin when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ user: null });
    const { POST } = await import("./manage");

    const response = await POST(makePostContext({}));

    expect(response.headers.get("Location")).toBe("/signin");
  });

  it("redirects with manager_required when the user is not a manager", async () => {
    mockRequireHouseholdManager.mockResolvedValue({
      ok: false,
      error: "manager_required",
    });
    const { POST } = await import("./manage");

    const response = await POST(makePostContext({}));

    expect(response.headers.get("Location")).toBe(
      "/dashboard/share?error=manager_required",
    );
  });

  it("redirects with pro_required when the plan cannot create share links", async () => {
    mockGetUserEntitlements.mockResolvedValue({
      canCreateShareLinks: false,
      canCreateFamilyShareLink: false,
    });
    const { POST } = await import("./manage");

    const response = await POST(makePostContext({ scope: "live" }));

    expect(response.headers.get("Location")).toBe(
      "/dashboard/share?error=pro_required",
    );
  });

  it("creates a share link, flashes the token, and redirects", async () => {
    const { POST } = await import("./manage");

    const response = await POST(
      makePostContext({ scope: "live", label: "Family", expires_days: "7" }),
    );

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        household_id: "house-1",
        scope: "live",
        label: "Family",
        created_by: "user-1",
      }),
    );
    expect(mockRecordHouseholdActivity).toHaveBeenCalledWith({
      householdId: "house-1",
      userId: "user-1",
      action: "share_link_created",
      detail: "live",
    });
    expect(mockSetSecretFlash).toHaveBeenCalledWith(
      {},
      "tt_flash_share_token",
      expect.any(String),
    );
    expect(response.headers.get("Location")).toBe("/dashboard/share?created=1");
  });

  it("revokes a share link and redirects", async () => {
    const { POST } = await import("./manage");

    const response = await POST(makePostContext({ action: "revoke", id: "link-1" }));

    expect(mockFrom).toHaveBeenCalledWith("share_links");
    expect(mockDeleteEq1).toHaveBeenCalledWith("id", "link-1");
    expect(mockDeleteEq2).toHaveBeenCalledWith("household_id", "house-1");
    expect(response.headers.get("Location")).toBe("/dashboard/share?revoked=1");
  });
});
