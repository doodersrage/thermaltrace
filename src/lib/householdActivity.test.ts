import { beforeEach, describe, expect, it, vi } from "vitest";

const mockInsert = vi.fn();
const mockLimit = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
vi.mock("./supabase", () => ({
  createServerClient: () => ({ from: (...a: unknown[]) => mockFrom(...a) }),
}));

beforeEach(() => {
  mockInsert.mockReset().mockResolvedValue({ error: null });
  mockLimit.mockReset().mockResolvedValue({ data: [] });
  mockOrder.mockReset().mockReturnValue({ limit: mockLimit });
  mockEq.mockReset().mockReturnValue({ order: mockOrder });
  mockSelect.mockReset().mockReturnValue({ eq: mockEq });
  mockFrom.mockReset().mockReturnValue({ insert: mockInsert, select: mockSelect });
});

describe("recordHouseholdActivity", () => {
  it("inserts a row with the given fields", async () => {
    const { recordHouseholdActivity } = await import("./householdActivity");

    await recordHouseholdActivity({
      householdId: "house-1",
      userId: "user-1",
      action: "device.created",
      detail: "Garage",
    });

    expect(mockFrom).toHaveBeenCalledWith("household_activity");
    expect(mockInsert).toHaveBeenCalledWith({
      household_id: "house-1",
      user_id: "user-1",
      action: "device.created",
      detail: "Garage",
    });
  });

  it("defaults userId and detail to null when omitted", async () => {
    const { recordHouseholdActivity } = await import("./householdActivity");

    await recordHouseholdActivity({ householdId: "house-1", action: "device.created" });

    expect(mockInsert).toHaveBeenCalledWith({
      household_id: "house-1",
      user_id: null,
      action: "device.created",
      detail: null,
    });
  });
});

describe("listHouseholdActivity", () => {
  it("queries by household id, ordered newest-first, with the default limit", async () => {
    const { listHouseholdActivity } = await import("./householdActivity");

    await listHouseholdActivity("house-1");

    expect(mockEq).toHaveBeenCalledWith("household_id", "house-1");
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(mockLimit).toHaveBeenCalledWith(40);
  });

  it("honors a custom limit", async () => {
    const { listHouseholdActivity } = await import("./householdActivity");

    await listHouseholdActivity("house-1", 10);

    expect(mockLimit).toHaveBeenCalledWith(10);
  });

  it("returns the rows from the query", async () => {
    const rows = [{ id: "a1", household_id: "house-1", user_id: null, action: "x", detail: null, created_at: "t" }];
    mockLimit.mockResolvedValue({ data: rows });
    const { listHouseholdActivity } = await import("./householdActivity");

    expect(await listHouseholdActivity("house-1")).toEqual(rows);
  });

  it("returns an empty array when data is null", async () => {
    mockLimit.mockResolvedValue({ data: null });
    const { listHouseholdActivity } = await import("./householdActivity");

    expect(await listHouseholdActivity("house-1")).toEqual([]);
  });
});
