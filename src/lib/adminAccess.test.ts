import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUserEntitlements = vi.fn();
vi.mock("./entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  return builder;
}

const mockFrom = vi.fn();
vi.mock("./supabase", () => ({
  createServerClient: () => ({ from: (...a: unknown[]) => mockFrom(...a) }),
}));

beforeEach(() => {
  mockGetUserEntitlements.mockReset().mockResolvedValue({ canDownloadCsv: false });
  mockFrom.mockReset();
});

describe("canDownloadHistoryCsv", () => {
  it("delegates to the user's entitlements", async () => {
    mockGetUserEntitlements.mockResolvedValue({ canDownloadCsv: true });
    const { canDownloadHistoryCsv } = await import("./adminAccess");

    expect(await canDownloadHistoryCsv("user-1")).toBe(true);
    expect(mockGetUserEntitlements).toHaveBeenCalledWith("user-1");
  });

  it("returns false when entitlements deny it", async () => {
    mockGetUserEntitlements.mockResolvedValue({ canDownloadCsv: false });
    const { canDownloadHistoryCsv } = await import("./adminAccess");

    expect(await canDownloadHistoryCsv("user-1")).toBe(false);
  });
});

describe("isUserInGroup", () => {
  it("returns false when the group doesn't exist", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: null }));
    const { isUserInGroup } = await import("./adminAccess");

    expect(await isUserInGroup("user-1", "admin")).toBe(false);
  });

  it("returns false when the group lookup errors", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: "db down" } }));
    const { isUserInGroup } = await import("./adminAccess");

    expect(await isUserInGroup("user-1", "admin")).toBe(false);
  });

  it("returns false when the group exists but the user isn't a member", async () => {
    const groupBuilder = mockQuery({ data: { id: "group-1" }, error: null });
    const memberBuilder = mockQuery({ data: null, error: null });
    mockFrom.mockReturnValueOnce(groupBuilder).mockReturnValueOnce(memberBuilder);
    const { isUserInGroup } = await import("./adminAccess");

    expect(await isUserInGroup("user-1", "admin")).toBe(false);
  });

  it("returns false when the membership lookup errors", async () => {
    const groupBuilder = mockQuery({ data: { id: "group-1" }, error: null });
    const memberBuilder = mockQuery({ data: null, error: { message: "db down" } });
    mockFrom.mockReturnValueOnce(groupBuilder).mockReturnValueOnce(memberBuilder);
    const { isUserInGroup } = await import("./adminAccess");

    expect(await isUserInGroup("user-1", "admin")).toBe(false);
  });

  it("returns true when the group exists and the user is a member", async () => {
    const groupBuilder = mockQuery({ data: { id: "group-1" }, error: null });
    const memberBuilder = mockQuery({ data: { id: "member-1" }, error: null });
    mockFrom.mockReturnValueOnce(groupBuilder).mockReturnValueOnce(memberBuilder);
    const { isUserInGroup } = await import("./adminAccess");

    expect(await isUserInGroup("user-1", "admin")).toBe(true);
  });

  it("filters the group lookup by the given group name", async () => {
    const groupBuilder = mockQuery({ data: { id: "group-1" }, error: null });
    const memberBuilder = mockQuery({ data: { id: "member-1" }, error: null });
    mockFrom.mockReturnValueOnce(groupBuilder).mockReturnValueOnce(memberBuilder);
    const { isUserInGroup } = await import("./adminAccess");

    await isUserInGroup("user-1", "portfolio");

    expect(groupBuilder.eq).toHaveBeenCalledWith("name", "portfolio");
    expect(memberBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(memberBuilder.eq).toHaveBeenCalledWith("group_id", "group-1");
  });
});

describe("isUserAdmin", () => {
  it("checks membership in the admin group", async () => {
    const groupBuilder = mockQuery({ data: { id: "group-1" }, error: null });
    const memberBuilder = mockQuery({ data: { id: "member-1" }, error: null });
    mockFrom.mockReturnValueOnce(groupBuilder).mockReturnValueOnce(memberBuilder);
    const { isUserAdmin } = await import("./adminAccess");

    expect(await isUserAdmin("user-1")).toBe(true);
    expect(groupBuilder.eq).toHaveBeenCalledWith("name", "admin");
  });
});
