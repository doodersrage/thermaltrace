import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockGetOrCreateHouseholdForUser = vi.fn();
vi.mock("../../../lib/households", () => ({
  getOrCreateHouseholdForUser: (...a: unknown[]) => mockGetOrCreateHouseholdForUser(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("../../../lib/entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

const mockCreateHouseholdApiKey = vi.fn();
const mockRevokeHouseholdApiKey = vi.fn();
vi.mock("../../../lib/apiKeys", () => ({
  createHouseholdApiKey: (...a: unknown[]) => mockCreateHouseholdApiKey(...a),
  revokeHouseholdApiKey: (...a: unknown[]) => mockRevokeHouseholdApiKey(...a),
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
  FLASH_API_KEY: "tt_flash_api_key",
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
  mockGetAuthFromCookies.mockReset().mockResolvedValue({ user: { id: "user-1", email: "a@b.com" } });
  mockRequireHouseholdManager.mockReset().mockResolvedValue({ ok: true, ctx: { householdId: "house-1" } });
  mockGetUserEntitlements.mockReset().mockResolvedValue({ canCreateShareLinks: true });
  mockGetOrCreateHouseholdForUser.mockReset().mockResolvedValue({ householdId: "house-1", error: null });
  mockCreateHouseholdApiKey.mockReset().mockResolvedValue({ plaintext: "gtm_secret", error: null });
  mockRevokeHouseholdApiKey.mockReset().mockResolvedValue(undefined);
  mockRecordHouseholdActivity.mockReset().mockResolvedValue(undefined);
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/share");
  mockSetSecretFlash.mockReset();
});

describe("POST /api/api-keys", () => {
  it("redirects to signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ user: null });
    const { POST } = await import("./index");

    const response = await POST(makeContext({}));

    expect(response.headers.get("Location")).toBe("/signin");
  });

  it("redirects with manager_required when not a household manager", async () => {
    mockRequireHouseholdManager.mockResolvedValue({ ok: false, error: "manager_required" });
    const { POST } = await import("./index");

    const response = await POST(makeContext({}));

    expect(response.headers.get("Location")).toBe("/dashboard/share?error=manager_required");
    expect(mockGetUserEntitlements).not.toHaveBeenCalled();
  });

  it("redirects with pro_required when the plan disallows share links", async () => {
    mockGetUserEntitlements.mockResolvedValue({ canCreateShareLinks: false });
    const { POST } = await import("./index");

    const response = await POST(makeContext({}));

    expect(response.headers.get("Location")).toBe("/dashboard/share?error=pro_required");
  });

  it("redirects with an error when the household can't be resolved", async () => {
    mockGetOrCreateHouseholdForUser.mockResolvedValue({ householdId: null, error: "no household" });
    const { POST } = await import("./index");

    const response = await POST(makeContext({}));

    expect(response.headers.get("Location")).toBe("/dashboard/share?error=1");
  });

  it("creates a key, logs activity, flashes the plaintext, and redirects", async () => {
    const { POST } = await import("./index");

    const response = await POST(makeContext({ name: "CI key" }));

    expect(mockCreateHouseholdApiKey).toHaveBeenCalledWith({
      householdId: "house-1",
      name: "CI key",
      createdBy: "user-1",
    });
    expect(mockRecordHouseholdActivity).toHaveBeenCalledWith({
      householdId: "house-1",
      userId: "user-1",
      action: "api_key_created",
      detail: "CI key",
    });
    expect(mockSetSecretFlash).toHaveBeenCalledWith({}, "tt_flash_api_key", "gtm_secret");
    expect(response.headers.get("Location")).toBe("/dashboard/share?api_key_created=1");
  });

  it("defaults the key name to 'Metrics key'", async () => {
    const { POST } = await import("./index");

    await POST(makeContext({}));

    expect(mockCreateHouseholdApiKey).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Metrics key" }),
    );
  });

  it("redirects with an error when key creation fails", async () => {
    mockCreateHouseholdApiKey.mockResolvedValue({ plaintext: null, error: "db error" });
    const { POST } = await import("./index");

    const response = await POST(makeContext({}));

    expect(response.headers.get("Location")).toBe("/dashboard/share?error=1");
    expect(mockRecordHouseholdActivity).not.toHaveBeenCalled();
  });

  it("revokes a key by id and redirects", async () => {
    const { POST } = await import("./index");

    const response = await POST(makeContext({ action: "revoke", id: "key-1" }));

    expect(mockRevokeHouseholdApiKey).toHaveBeenCalledWith("house-1", "key-1");
    expect(response.headers.get("Location")).toBe("/dashboard/share?api_key_revoked=1");
  });

  it("skips revocation when no id is given", async () => {
    const { POST } = await import("./index");

    const response = await POST(makeContext({ action: "revoke" }));

    expect(mockRevokeHouseholdApiKey).not.toHaveBeenCalled();
    expect(response.headers.get("Location")).toBe("/dashboard/share?api_key_revoked=1");
  });
});
