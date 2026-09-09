import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSetSession = vi.fn();
const mockUpdateUser = vi.fn();
vi.mock("./supabase", () => ({
  createAuthClient: () => ({
    auth: {
      setSession: (...a: unknown[]) => mockSetSession(...a),
      updateUser: (...a: unknown[]) => mockUpdateUser(...a),
    },
  }),
}));

beforeEach(() => {
  mockSetSession.mockReset().mockResolvedValue({ data: { session: { access_token: "x" } }, error: null });
  mockUpdateUser.mockReset().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
});

describe("getDashboardOverviewMode", () => {
  it("returns 'insights' when the metadata says so", async () => {
    const { getDashboardOverviewMode } = await import("./dashboardOverviewMode");

    const user = { user_metadata: { dashboard_overview_mode: "insights" } } as never;
    expect(getDashboardOverviewMode(user)).toBe("insights");
  });

  it("defaults to 'simple' for any other value, missing metadata, or no user", async () => {
    const { getDashboardOverviewMode } = await import("./dashboardOverviewMode");

    expect(getDashboardOverviewMode({ user_metadata: { dashboard_overview_mode: "bogus" } } as never)).toBe(
      "simple",
    );
    expect(getDashboardOverviewMode({ user_metadata: {} } as never)).toBe("simple");
    expect(getDashboardOverviewMode(null)).toBe("simple");
    expect(getDashboardOverviewMode(undefined)).toBe("simple");
  });
});

describe("updateDashboardOverviewMode", () => {
  it("sets the session before updating the user", async () => {
    const { updateDashboardOverviewMode } = await import("./dashboardOverviewMode");

    await updateDashboardOverviewMode("access-token", "refresh-token", "insights");

    expect(mockSetSession).toHaveBeenCalledWith({
      access_token: "access-token",
      refresh_token: "refresh-token",
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({
      data: { dashboard_overview_mode: "insights" },
    });
  });

  it("returns an error and skips updateUser when setSession errors", async () => {
    mockSetSession.mockResolvedValue({ data: { session: null }, error: new Error("bad token") });
    const { updateDashboardOverviewMode } = await import("./dashboardOverviewMode");

    const result = await updateDashboardOverviewMode("access-token", "refresh-token", "insights");

    expect(result.user).toBeNull();
    expect(result.error?.message).toBe("bad token");
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("returns a generic 'Invalid session' error when there is no session but also no explicit error", async () => {
    mockSetSession.mockResolvedValue({ data: { session: null }, error: null });
    const { updateDashboardOverviewMode } = await import("./dashboardOverviewMode");

    const result = await updateDashboardOverviewMode("access-token", "refresh-token", "insights");

    expect(result.error?.message).toBe("Invalid session");
  });

  it("returns the error from updateUser when it fails", async () => {
    mockUpdateUser.mockResolvedValue({ data: { user: null }, error: new Error("update failed") });
    const { updateDashboardOverviewMode } = await import("./dashboardOverviewMode");

    const result = await updateDashboardOverviewMode("access-token", "refresh-token", "simple");

    expect(result.user).toBeNull();
    expect(result.error?.message).toBe("update failed");
  });

  it("returns the updated user on success", async () => {
    mockUpdateUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const { updateDashboardOverviewMode } = await import("./dashboardOverviewMode");

    const result = await updateDashboardOverviewMode("access-token", "refresh-token", "simple");

    expect(result).toEqual({ user: { id: "user-1" }, error: null });
  });
});
