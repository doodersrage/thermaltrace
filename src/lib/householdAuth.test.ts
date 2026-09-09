import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HouseholdRole } from "./households";

const mockGetUserHouseholdId = vi.fn();
const mockGetUserHouseholdRole = vi.fn();

vi.mock("./households", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./households")>();
  return {
    ...actual,
    getUserHouseholdId: (...args: unknown[]) => mockGetUserHouseholdId(...args),
    getUserHouseholdRole: (...args: unknown[]) => mockGetUserHouseholdRole(...args),
  };
});

beforeEach(() => {
  mockGetUserHouseholdId.mockReset();
  mockGetUserHouseholdRole.mockReset();
});

function setup(householdId: string | null, role: HouseholdRole | null) {
  mockGetUserHouseholdId.mockResolvedValue(householdId);
  mockGetUserHouseholdRole.mockResolvedValue(role);
}

describe("getHouseholdEditorContext", () => {
  it("returns null when the user belongs to no household", async () => {
    setup(null, null);
    const { getHouseholdEditorContext } = await import("./householdAuth");
    expect(await getHouseholdEditorContext("user-1")).toBeNull();
    expect(mockGetUserHouseholdRole).not.toHaveBeenCalled();
  });

  it("returns null when the household lookup yields no role", async () => {
    setup("house-1", null);
    const { getHouseholdEditorContext } = await import("./householdAuth");
    expect(await getHouseholdEditorContext("user-1")).toBeNull();
  });

  it("returns the household id and role together", async () => {
    setup("house-1", "owner");
    const { getHouseholdEditorContext } = await import("./householdAuth");
    expect(await getHouseholdEditorContext("user-1")).toEqual({
      householdId: "house-1",
      role: "owner",
    });
  });
});

describe("requireHouseholdEditor", () => {
  it("fails with 'No household' when the user has none", async () => {
    setup(null, null);
    const { requireHouseholdEditor } = await import("./householdAuth");
    expect(await requireHouseholdEditor("user-1")).toEqual({ ok: false, error: "No household" });
  });

  it.each<[HouseholdRole, string]>([
    ["viewer", "viewer"],
    ["alert_only", "alert_only"],
  ])("blocks a %s role with error '%s'", async (role, expectedError) => {
    setup("house-1", role);
    const { requireHouseholdEditor } = await import("./householdAuth");
    expect(await requireHouseholdEditor("user-1")).toEqual({ ok: false, error: expectedError });
  });

  it.each<HouseholdRole>(["owner", "member", "property_manager"])(
    "allows a %s role",
    async (role) => {
      setup("house-1", role);
      const { requireHouseholdEditor } = await import("./householdAuth");
      expect(await requireHouseholdEditor("user-1")).toEqual({
        ok: true,
        ctx: { householdId: "house-1", role },
      });
    },
  );
});

describe("requireHouseholdManager", () => {
  it("fails with 'No household' when the user has none", async () => {
    setup(null, null);
    const { requireHouseholdManager } = await import("./householdAuth");
    expect(await requireHouseholdManager("user-1")).toEqual({ ok: false, error: "No household" });
  });

  it.each<HouseholdRole>(["viewer", "alert_only", "property_manager"])(
    "blocks a %s role with 'manager_required' -- billing/invites/keys are owner+member only",
    async (role) => {
      setup("house-1", role);
      const { requireHouseholdManager } = await import("./householdAuth");
      expect(await requireHouseholdManager("user-1")).toEqual({
        ok: false,
        error: "manager_required",
      });
    },
  );

  it.each<HouseholdRole>(["owner", "member"])("allows a %s role", async (role) => {
    setup("house-1", role);
    const { requireHouseholdManager } = await import("./householdAuth");
    expect(await requireHouseholdManager("user-1")).toEqual({
      ok: true,
      ctx: { householdId: "house-1", role },
    });
  });
});

function makeRedirect() {
  return vi.fn((url: string) => new Response(null, { status: 302, headers: { Location: url } }));
}

describe("redirectUnlessManager", () => {
  it("returns null (no redirect) when the check passed", async () => {
    const { redirectUnlessManager } = await import("./householdAuth");
    const redirect = makeRedirect();
    const result = redirectUnlessManager(
      { ok: true, ctx: { householdId: "house-1", role: "owner" } },
      "/dashboard/household",
      redirect,
    );
    expect(result).toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("redirects with manager_required for that specific failure", async () => {
    const { redirectUnlessManager } = await import("./householdAuth");
    const redirect = makeRedirect();
    redirectUnlessManager({ ok: false, error: "manager_required" }, "/dashboard/household", redirect);
    expect(redirect).toHaveBeenCalledWith("/dashboard/household?error=manager_required");
  });

  it("redirects with a generic error for 'No household'", async () => {
    const { redirectUnlessManager } = await import("./householdAuth");
    const redirect = makeRedirect();
    redirectUnlessManager({ ok: false, error: "No household" }, "/dashboard/household", redirect);
    expect(redirect).toHaveBeenCalledWith("/dashboard/household?error=1");
  });

  it("falls back to /dashboard when redirectTo is an open-redirect attempt", async () => {
    const { redirectUnlessManager } = await import("./householdAuth");
    const redirect = makeRedirect();
    redirectUnlessManager({ ok: false, error: "No household" }, "https://evil.example/phish", redirect);
    expect(redirect).toHaveBeenCalledWith("/dashboard?error=1");
  });
});

describe("redirectUnlessEditor", () => {
  it.each(["viewer", "alert_only"] as const)("redirects with ?error=viewer for %s", async (error) => {
    const { redirectUnlessEditor } = await import("./householdAuth");
    const redirect = makeRedirect();
    redirectUnlessEditor({ ok: false, error }, "/dashboard/temperature", redirect);
    expect(redirect).toHaveBeenCalledWith("/dashboard/temperature?error=viewer");
  });

  it("redirects with ?error=manager_required for that failure", async () => {
    const { redirectUnlessEditor } = await import("./householdAuth");
    const redirect = makeRedirect();
    redirectUnlessEditor({ ok: false, error: "manager_required" }, "/dashboard/temperature", redirect);
    expect(redirect).toHaveBeenCalledWith("/dashboard/temperature?error=manager_required");
  });

  it("returns null when the check passed", async () => {
    const { redirectUnlessEditor } = await import("./householdAuth");
    const redirect = makeRedirect();
    const result = redirectUnlessEditor(
      { ok: true, ctx: { householdId: "house-1", role: "member" } },
      "/dashboard/temperature",
      redirect,
    );
    expect(result).toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("householdManagerCtx / householdEditorCtx", () => {
  it("householdManagerCtx returns the context when ok", async () => {
    const { householdManagerCtx } = await import("./householdAuth");
    const ctx = { householdId: "house-1", role: "owner" as const };
    expect(householdManagerCtx({ ok: true, ctx })).toBe(ctx);
  });

  it("householdManagerCtx throws when not ok", async () => {
    const { householdManagerCtx } = await import("./householdAuth");
    expect(() => householdManagerCtx({ ok: false, error: "manager_required" })).toThrow(
      "manager_required",
    );
  });

  it("householdEditorCtx returns the context when ok", async () => {
    const { householdEditorCtx } = await import("./householdAuth");
    const ctx = { householdId: "house-1", role: "member" as const };
    expect(householdEditorCtx({ ok: true, ctx })).toBe(ctx);
  });

  it("householdEditorCtx throws when not ok", async () => {
    const { householdEditorCtx } = await import("./householdAuth");
    expect(() => householdEditorCtx({ ok: false, error: "viewer" })).toThrow("viewer");
  });
});
