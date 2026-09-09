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

const mockRequireHouseholdManager = vi.fn();
vi.mock("../../../lib/householdAuth", () => ({
  requireHouseholdManager: (...a: unknown[]) => mockRequireHouseholdManager(...a),
  redirectUnlessManager: (
    manager: { ok: boolean; error?: string },
    redirectTo: string,
    redirect: (url: string) => Response,
  ) => {
    if (manager.ok) return null;
    return redirect(`${redirectTo}?error=${manager.error === "manager_required" ? "manager_required" : "1"}`);
  },
  householdManagerCtx: (manager: { ok: boolean; ctx?: { householdId: string } }) => {
    if (!manager.ok) throw new Error("not a manager");
    return manager.ctx;
  },
}));

const mockRecordHouseholdActivity = vi.fn();
vi.mock("../../../lib/householdActivity", () => ({
  recordHouseholdActivity: (...a: unknown[]) => mockRecordHouseholdActivity(...a),
}));

const mockCreateStatusPageToken = vi.fn();
const mockRevokeStatusPageToken = vi.fn();
vi.mock("../../../lib/statusPage", () => ({
  createStatusPageToken: (...a: unknown[]) => mockCreateStatusPageToken(...a),
  revokeStatusPageToken: (...a: unknown[]) => mockRevokeStatusPageToken(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

const mockSetSecretFlash = vi.fn();
vi.mock("../../../lib/secretFlash", () => ({
  FLASH_STATUS_TOKEN: "tt_flash_status_token",
  setSecretFlash: (...a: unknown[]) => mockSetSecretFlash(...a),
}));

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeContext(fields: Record<string, string>): APIContext {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const request = { formData: () => Promise.resolve(form) } as unknown as Request;
  return { request, cookies: {}, redirect: fakeRedirect } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({ user: { id: "user-1" } });
  mockGetUserEntitlements.mockReset().mockResolvedValue({ canCreateShareLinks: true });
  mockRequireHouseholdManager.mockReset().mockResolvedValue({
    ok: true,
    ctx: { householdId: "house-1", role: "owner" },
  });
  mockRecordHouseholdActivity.mockReset().mockResolvedValue(undefined);
  mockCreateStatusPageToken.mockReset().mockResolvedValue({ token: "tok-1", error: null });
  mockRevokeStatusPageToken.mockReset().mockResolvedValue(undefined);
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/share");
  mockSetSecretFlash.mockReset();
});

describe("POST /api/status/manage", () => {
  it("redirects to signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ user: null });
    const { POST } = await import("./manage");

    const response = await POST(makeContext({}));

    expect(response.headers.get("Location")).toBe("/signin");
  });

  it("redirects with manager_required when the user isn't a household manager", async () => {
    mockRequireHouseholdManager.mockResolvedValue({ ok: false, error: "manager_required" });
    const { POST } = await import("./manage");

    const response = await POST(makeContext({}));

    expect(response.headers.get("Location")).toBe("/dashboard/share?error=manager_required");
    expect(mockGetUserEntitlements).not.toHaveBeenCalled();
  });

  it("redirects with a pro upsell when the plan doesn't allow share links", async () => {
    mockGetUserEntitlements.mockResolvedValue({ canCreateShareLinks: false });
    const { POST } = await import("./manage");

    const response = await POST(makeContext({}));

    expect(response.headers.get("Location")).toBe("/dashboard/share?status_error=pro");
  });

  it("creates a status page token, logs activity, flashes it, and redirects", async () => {
    const { POST } = await import("./manage");

    const response = await POST(makeContext({ label: "My Garage" }));

    expect(mockCreateStatusPageToken).toHaveBeenCalledWith("house-1", "My Garage");
    expect(mockRecordHouseholdActivity).toHaveBeenCalledWith({
      householdId: "house-1",
      userId: "user-1",
      action: "status_page_created",
      detail: "My Garage",
    });
    expect(mockSetSecretFlash).toHaveBeenCalledWith({}, "tt_flash_status_token", "tok-1");
    expect(response.headers.get("Location")).toBe("/dashboard/share?status_created=1");
  });

  it("defaults the label to 'Status page' when none is given", async () => {
    const { POST } = await import("./manage");

    await POST(makeContext({}));

    expect(mockCreateStatusPageToken).toHaveBeenCalledWith("house-1", "Status page");
  });

  it("redirects with an error when token creation fails", async () => {
    mockCreateStatusPageToken.mockResolvedValue({ token: null, error: "db error" });
    const { POST } = await import("./manage");

    const response = await POST(makeContext({}));

    expect(response.headers.get("Location")).toBe("/dashboard/share?status_error=1");
    expect(mockRecordHouseholdActivity).not.toHaveBeenCalled();
  });

  it("revokes a token by id, logs activity, and redirects", async () => {
    const { POST } = await import("./manage");

    const response = await POST(makeContext({ action: "revoke", id: "tok-1" }));

    expect(mockRevokeStatusPageToken).toHaveBeenCalledWith("house-1", "tok-1");
    expect(mockRecordHouseholdActivity).toHaveBeenCalledWith({
      householdId: "house-1",
      userId: "user-1",
      action: "status_page_revoked",
      detail: "tok-1",
    });
    expect(response.headers.get("Location")).toBe("/dashboard/share?status_revoked=1");
  });

  it("skips revocation entirely when no id is given", async () => {
    const { POST } = await import("./manage");

    const response = await POST(makeContext({ action: "revoke" }));

    expect(mockRevokeStatusPageToken).not.toHaveBeenCalled();
    expect(response.headers.get("Location")).toBe("/dashboard/share?status_revoked=1");
  });
});
