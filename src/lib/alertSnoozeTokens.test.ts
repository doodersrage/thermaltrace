import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertSettings } from "./alerts";

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order", "insert", "update", "upsert"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  (builder as { then: unknown }).then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

const mockFrom = vi.fn();
vi.mock("./supabase", () => ({
  createServerClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}));

const mockSnoozeUntilFromHours = vi.fn();
const mockVacationUntilFromDays = vi.fn();
vi.mock("./alertSnooze", () => ({
  snoozeUntilFromHours: (...a: unknown[]) => mockSnoozeUntilFromHours(...a),
  vacationUntilFromDays: (...a: unknown[]) => mockVacationUntilFromDays(...a),
}));

const mockGetAlertSettingsForUser = vi.fn();
const mockSaveAlertSettingsForUser = vi.fn();
vi.mock("./notify", () => ({
  getAlertSettingsForUser: (...a: unknown[]) => mockGetAlertSettingsForUser(...a),
  saveAlertSettingsForUser: (...a: unknown[]) => mockSaveAlertSettingsForUser(...a),
}));

const baseSettings: AlertSettings = {} as AlertSettings;

beforeEach(() => {
  mockFrom.mockReset();
  mockSnoozeUntilFromHours.mockReset().mockReturnValue("2099-01-01T00:00:00.000Z");
  mockVacationUntilFromDays.mockReset().mockReturnValue("2099-06-01T00:00:00.000Z");
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue({ ...baseSettings });
  mockSaveAlertSettingsForUser.mockReset().mockResolvedValue({ error: null });
});

describe("sha256Hex", () => {
  it("produces the known SHA-256 hex digest for a string", async () => {
    const { sha256Hex } = await import("./alertSnoozeTokens");
    expect(await sha256Hex("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("produces different digests for different input", async () => {
    const { sha256Hex } = await import("./alertSnoozeTokens");
    expect(await sha256Hex("a")).not.toBe(await sha256Hex("b"));
  });
});

describe("createSnoozeToken", () => {
  it("inserts a random token row and returns the token", async () => {
    const builder = mockQuery({ data: null, error: null });
    mockFrom.mockReturnValue(builder);
    const { createSnoozeToken } = await import("./alertSnoozeTokens");

    const token = await createSnoozeToken("user-1", 12);

    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(mockFrom).toHaveBeenCalledWith("alert_snooze_tokens");
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ token, user_id: "user-1", hours: 12 }),
    );
  });

  it("defaults hours to 24", async () => {
    const builder = mockQuery({ data: null, error: null });
    mockFrom.mockReturnValue(builder);
    const { createSnoozeToken } = await import("./alertSnoozeTokens");

    await createSnoozeToken("user-1");

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ hours: 24 }));
  });
});

describe("applySnoozeToken", () => {
  it("rejects an unknown token", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null }));
    const { applySnoozeToken } = await import("./alertSnoozeTokens");

    const result = await applySnoozeToken("nope");

    expect(result).toEqual({ ok: false, message: "Invalid or already used snooze link." });
    expect(mockGetAlertSettingsForUser).not.toHaveBeenCalled();
  });

  it("rejects an already-used token", async () => {
    mockFrom.mockReturnValue(
      mockQuery({
        data: {
          user_id: "user-1",
          hours: 12,
          expires_at: "2099-01-01T00:00:00.000Z",
          used_at: "2020-01-01T00:00:00.000Z",
        },
      }),
    );
    const { applySnoozeToken } = await import("./alertSnoozeTokens");

    const result = await applySnoozeToken("used-token");

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Invalid or already used snooze link.");
  });

  it("rejects an expired token", async () => {
    mockFrom.mockReturnValue(
      mockQuery({
        data: {
          user_id: "user-1",
          hours: 12,
          expires_at: "2000-01-01T00:00:00.000Z",
          used_at: null,
        },
      }),
    );
    const { applySnoozeToken } = await import("./alertSnoozeTokens");

    const result = await applySnoozeToken("stale-token");

    expect(result).toEqual({ ok: false, message: "Snooze link expired." });
    expect(mockGetAlertSettingsForUser).not.toHaveBeenCalled();
  });

  it("applies the snooze, marks the token used, and reports the hours", async () => {
    const builder = mockQuery({
      data: {
        user_id: "user-1",
        hours: 12,
        expires_at: "2099-01-01T00:00:00.000Z",
        used_at: null,
      },
    });
    mockFrom.mockReturnValue(builder);
    mockGetAlertSettingsForUser.mockResolvedValue({ someFlag: true });
    const { applySnoozeToken } = await import("./alertSnoozeTokens");

    const result = await applySnoozeToken("good-token");

    expect(mockGetAlertSettingsForUser).toHaveBeenCalledWith("user-1");
    expect(mockSnoozeUntilFromHours).toHaveBeenCalledWith(12);
    expect(mockSaveAlertSettingsForUser).toHaveBeenCalledWith("user-1", {
      someFlag: true,
      snoozeUntil: "2099-01-01T00:00:00.000Z",
    });
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ used_at: expect.any(String) }),
    );
    expect(result).toEqual({ ok: true, message: "Alerts snoozed for 12 hours." });
  });
});

describe("buildSnoozeUrl", () => {
  it("builds a snooze URL from a freshly created token, stripping a trailing slash", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: null }));
    const { buildSnoozeUrl } = await import("./alertSnoozeTokens");

    const url = await buildSnoozeUrl("https://example.com/", "user-1", 6);

    expect(url).toMatch(/^https:\/\/example\.com\/api\/alerts\/snooze\?token=[0-9a-f]{32}$/);
  });
});

describe("applySnoozeForHouseholdMembers", () => {
  it("snoozes every member and returns the count", async () => {
    mockFrom.mockReturnValue(
      mockQuery({ data: [{ user_id: "u1" }, { user_id: "u2" }] }),
    );
    const { applySnoozeForHouseholdMembers } = await import("./alertSnoozeTokens");

    const count = await applySnoozeForHouseholdMembers("house-1", 8);

    expect(count).toBe(2);
    expect(mockSnoozeUntilFromHours).toHaveBeenCalledWith(8);
    expect(mockSaveAlertSettingsForUser).toHaveBeenCalledTimes(2);
    expect(mockSaveAlertSettingsForUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ snoozeUntil: "2099-01-01T00:00:00.000Z" }),
    );
  });

  it("returns 0 when the household has no members", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null }));
    const { applySnoozeForHouseholdMembers } = await import("./alertSnoozeTokens");

    expect(await applySnoozeForHouseholdMembers("house-1", 8)).toBe(0);
    expect(mockSaveAlertSettingsForUser).not.toHaveBeenCalled();
  });
});

describe("applyVacationForHouseholdMembers", () => {
  it("sets vacation mode for every member and returns the count", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [{ user_id: "u1" }] }));
    const { applyVacationForHouseholdMembers } = await import("./alertSnoozeTokens");

    const count = await applyVacationForHouseholdMembers("house-1", 14);

    expect(count).toBe(1);
    expect(mockVacationUntilFromDays).toHaveBeenCalledWith(14);
    expect(mockSaveAlertSettingsForUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ vacationUntil: "2099-06-01T00:00:00.000Z" }),
    );
  });
});

describe("clearSnoozeForUser / clearVacationForUser", () => {
  it("clearSnoozeForUser nulls out snoozeUntil only", async () => {
    mockGetAlertSettingsForUser.mockResolvedValue({ snoozeUntil: "later", vacationUntil: "vac" });
    const { clearSnoozeForUser } = await import("./alertSnoozeTokens");

    await clearSnoozeForUser("user-1");

    expect(mockSaveAlertSettingsForUser).toHaveBeenCalledWith("user-1", {
      snoozeUntil: null,
      vacationUntil: "vac",
    });
  });

  it("clearVacationForUser nulls out vacationUntil only", async () => {
    mockGetAlertSettingsForUser.mockResolvedValue({ snoozeUntil: "later", vacationUntil: "vac" });
    const { clearVacationForUser } = await import("./alertSnoozeTokens");

    await clearVacationForUser("user-1");

    expect(mockSaveAlertSettingsForUser).toHaveBeenCalledWith("user-1", {
      snoozeUntil: "later",
      vacationUntil: null,
    });
  });
});

describe("clearSnoozeForHouseholdMembers / clearVacationForHouseholdMembers", () => {
  it("clears snooze for every household member", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [{ user_id: "u1" }, { user_id: "u2" }] }));
    const { clearSnoozeForHouseholdMembers } = await import("./alertSnoozeTokens");

    const count = await clearSnoozeForHouseholdMembers("house-1");

    expect(count).toBe(2);
    expect(mockSaveAlertSettingsForUser).toHaveBeenCalledTimes(2);
    expect(mockSaveAlertSettingsForUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ snoozeUntil: null }),
    );
  });

  it("clears vacation for every household member", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [{ user_id: "u1" }] }));
    const { clearVacationForHouseholdMembers } = await import("./alertSnoozeTokens");

    const count = await clearVacationForHouseholdMembers("house-1");

    expect(count).toBe(1);
    expect(mockSaveAlertSettingsForUser).toHaveBeenCalledWith(
      "u1",
      expect.objectContaining({ vacationUntil: null }),
    );
  });

  it("returns 0 for an empty household member list", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [] }));
    const { clearSnoozeForHouseholdMembers, clearVacationForHouseholdMembers } = await import(
      "./alertSnoozeTokens"
    );

    expect(await clearSnoozeForHouseholdMembers("house-1")).toBe(0);
    expect(await clearVacationForHouseholdMembers("house-1")).toBe(0);
  });
});
