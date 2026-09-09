import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockRequireHouseholdManager = vi.fn();
vi.mock("../../../../lib/householdAuth", () => ({
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
  householdManagerCtx: (manager: { ok: boolean; ctx?: { householdId: string } }) => {
    if (!manager.ok) throw new Error("not a manager");
    return manager.ctx;
  },
}));

const mockDeleteConnection = vi.fn();
vi.mock("../../../../lib/thermostatConnections", () => ({
  deleteConnection: (...a: unknown[]) => mockDeleteConnection(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

function fakeRedirect(path: string): Response {
  return new Response(null, { status: 302, headers: { Location: path } });
}

function makeContext(options: {
  provider?: string;
  fields?: Record<string, string>;
} = {}): APIContext {
  const form = new FormData();
  for (const [key, value] of Object.entries(options.fields ?? {})) form.set(key, value);
  const request = { formData: () => Promise.resolve(form) } as unknown as Request;
  return {
    params: { provider: options.provider ?? "nest" },
    request,
    cookies: {},
    redirect: fakeRedirect,
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "at" },
    user: { id: "user-1" },
  });
  mockRequireHouseholdManager.mockReset().mockResolvedValue({
    ok: true,
    ctx: { householdId: "house-1", role: "owner" },
  });
  mockDeleteConnection.mockReset().mockResolvedValue(undefined);
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/temperature");
});

describe("POST /api/integrations/[provider]/disconnect", () => {
  it("redirects to signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./disconnect");

    const response = await POST(makeContext());

    expect(response.headers.get("Location")).toBe("/signin");
  });

  it("redirects with thermostat_error when the provider is invalid", async () => {
    const { POST } = await import("./disconnect");

    const response = await POST(makeContext({ provider: "honeywell" }));

    expect(response.headers.get("Location")).toBe("/dashboard/temperature?thermostat_error=1");
    expect(mockDeleteConnection).not.toHaveBeenCalled();
  });

  it("redirects with manager_required when the user is not a household manager", async () => {
    mockRequireHouseholdManager.mockResolvedValue({ ok: false, error: "manager_required" });
    const { POST } = await import("./disconnect");

    const response = await POST(makeContext());

    expect(response.headers.get("Location")).toBe(
      "/dashboard/temperature?error=manager_required",
    );
    expect(mockDeleteConnection).not.toHaveBeenCalled();
  });

  it("deletes the connection and redirects with thermostat_disconnected", async () => {
    const { POST } = await import("./disconnect");

    const response = await POST(makeContext({ provider: "ecobee" }));

    expect(mockDeleteConnection).toHaveBeenCalledWith("house-1", "ecobee");
    expect(response.headers.get("Location")).toBe(
      "/dashboard/temperature?thermostat_disconnected=ecobee",
    );
  });

  it("appends thermostat_disconnected when the redirect path already has a query", async () => {
    mockFormRedirectPath.mockReturnValue("/dashboard/temperature?tab=integrations");
    const { POST } = await import("./disconnect");

    const response = await POST(makeContext({ provider: "nest" }));

    expect(response.headers.get("Location")).toBe(
      "/dashboard/temperature?tab=integrations&thermostat_disconnected=nest",
    );
  });
});
