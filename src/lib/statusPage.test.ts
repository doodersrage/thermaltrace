import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "order", "insert", "update"]) {
    builder[method] = vi.fn(() => builder);
  }
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

const mockListHouseholdDevices = vi.fn();
vi.mock("./devices", () => ({
  listHouseholdDevices: (...a: unknown[]) => mockListHouseholdDevices(...a),
}));

const mockFetchLatestSensorValues = vi.fn();
vi.mock("./sensorReadings", () => ({
  fetchLatestSensorValues: (...a: unknown[]) => mockFetchLatestSensorValues(...a),
}));

const mockFormatRelativeAge = vi.fn();
vi.mock("./relativeTime", () => ({
  formatRelativeAge: (...a: unknown[]) => mockFormatRelativeAge(...a),
  STALE_MS: 2 * 60 * 60 * 1000,
}));

function reading(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    sensor: { label: "Probe 0", kind: "temp" },
    deviceName: "Garage",
    value_num: 42,
    value_bool: null,
    recorded_at: "2024-06-15T10:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  mockFrom.mockReset();
  mockListHouseholdDevices.mockReset().mockResolvedValue({ devices: [], error: null });
  mockFetchLatestSensorValues.mockReset().mockResolvedValue([]);
  mockFormatRelativeAge.mockReset().mockImplementation((iso: string | null) => ({
    label: iso ? `age of ${iso}` : "never",
    lagging: false,
    stale: false,
    absolute: iso,
  }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createStatusPageToken", () => {
  it("stores a random token with the trimmed label", async () => {
    let insertedRow: Record<string, unknown> | undefined;
    const builder = mockQuery({ error: null });
    (builder.insert as ReturnType<typeof vi.fn>).mockImplementation(
      (row: Record<string, unknown>) => {
        insertedRow = row;
        return builder;
      },
    );
    mockFrom.mockReturnValue(builder);
    const { createStatusPageToken } = await import("./statusPage");

    const result = await createStatusPageToken("house-1", "  Family status  ");

    expect(result.error).toBeNull();
    expect(result.token).toMatch(/^[0-9a-f]{36}$/);
    expect(insertedRow).toEqual({
      household_id: "house-1",
      token: result.token,
      label: "Family status",
    });
  });

  it("defaults an empty label to 'Status page'", async () => {
    const builder = mockQuery({ error: null });
    mockFrom.mockReturnValue(builder);
    const { createStatusPageToken } = await import("./statusPage");

    await createStatusPageToken("house-1", "   ");

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ label: "Status page" }));
  });

  it("returns a null token and the error message on failure", async () => {
    mockFrom.mockReturnValue(mockQuery({ error: { message: "insert failed" } }));
    const { createStatusPageToken } = await import("./statusPage");

    expect(await createStatusPageToken("house-1", "Label")).toEqual({
      token: null,
      error: "insert failed",
    });
  });
});

describe("listStatusPageTokens", () => {
  it("returns only unrevoked tokens for the household", async () => {
    const builder = mockQuery({ data: [{ id: "t1" }] });
    mockFrom.mockReturnValue(builder);
    const { listStatusPageTokens } = await import("./statusPage");

    const result = await listStatusPageTokens("house-1");

    expect(result).toEqual([{ id: "t1" }]);
    expect(builder.eq).toHaveBeenCalledWith("household_id", "house-1");
    expect(builder.is).toHaveBeenCalledWith("revoked_at", null);
  });

  it("falls back to an empty array when there is no data", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null }));
    const { listStatusPageTokens } = await import("./statusPage");

    expect(await listStatusPageTokens("house-1")).toEqual([]);
  });
});

describe("revokeStatusPageToken", () => {
  it("updates revoked_at scoped to the household and id", async () => {
    const builder = mockQuery({ error: null });
    mockFrom.mockReturnValue(builder);
    const { revokeStatusPageToken } = await import("./statusPage");

    await revokeStatusPageToken("house-1", "t1");

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ revoked_at: expect.any(String) }),
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "t1");
    expect(builder.eq).toHaveBeenCalledWith("household_id", "house-1");
  });
});

describe("resolveStatusPageToken", () => {
  it("returns null when the token is unknown or revoked", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null }));
    const { resolveStatusPageToken } = await import("./statusPage");

    expect(await resolveStatusPageToken("nope")).toBeNull();
  });

  it("returns the owning household for a valid token", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: { household_id: "house-1" } }));
    const { resolveStatusPageToken } = await import("./statusPage");

    expect(await resolveStatusPageToken("tok")).toEqual({ householdId: "house-1" });
  });
});

describe("buildStatusPageSnapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
  });

  it("reports zeroed-out fields when there are no readings", async () => {
    mockListHouseholdDevices.mockResolvedValue({ devices: [{ id: "d1" }], error: null });
    mockFetchLatestSensorValues.mockResolvedValue([]);
    const { buildStatusPageSnapshot } = await import("./statusPage");

    const snapshot = await buildStatusPageSnapshot("house-1");

    expect(snapshot.updatedAt).toBeNull();
    expect(snapshot.stale).toBe(true);
    expect(snapshot.sensorCount).toBe(0);
    expect(snapshot.deviceCount).toBe(1);
    expect(snapshot.staleSensorCount).toBe(0);
    expect(snapshot.sensors).toEqual([]);
    expect(mockFormatRelativeAge).toHaveBeenCalledWith(null);
  });

  it("picks the newest reading and counts stale sensors past the threshold", async () => {
    mockListHouseholdDevices.mockResolvedValue({ devices: [{ id: "d1" }, { id: "d2" }], error: null });
    mockFetchLatestSensorValues.mockResolvedValue([
      reading({ recorded_at: "2024-06-15T09:00:00.000Z" }), // 3h old: stale
      reading({ recorded_at: "2024-06-15T11:00:00.000Z" }), // 1h old: fresh
      reading({ recorded_at: null }), // missing: counts as stale
      reading({ recorded_at: "2024-06-15T11:30:00.000Z" }), // newest, 30m old
    ]);
    const { buildStatusPageSnapshot } = await import("./statusPage");

    const snapshot = await buildStatusPageSnapshot("house-1");

    expect(snapshot.updatedAt).toBe("2024-06-15T11:30:00.000Z");
    expect(snapshot.lastReadingLabel).toBe("age of 2024-06-15T11:30:00.000Z");
    expect(snapshot.staleSensorCount).toBe(2);
    expect(snapshot.sensorCount).toBe(4);
    expect(snapshot.deviceCount).toBe(2);
  });

  it("is stale when the freshest reading's age is itself flagged stale", async () => {
    mockFormatRelativeAge.mockReturnValue({ label: "3 hours ago", lagging: true, stale: true, absolute: null });
    mockFetchLatestSensorValues.mockResolvedValue([reading()]);
    const { buildStatusPageSnapshot } = await import("./statusPage");

    const snapshot = await buildStatusPageSnapshot("house-1");

    expect(snapshot.stale).toBe(true);
  });

  it("is not stale when there is a recent reading and the age helper agrees", async () => {
    mockFetchLatestSensorValues.mockResolvedValue([reading()]);
    const { buildStatusPageSnapshot } = await import("./statusPage");

    const snapshot = await buildStatusPageSnapshot("house-1");

    expect(snapshot.stale).toBe(false);
  });

  it("maps only the fields sensors need and truncates to the first 24", async () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      reading({
        sensor: { label: `Probe ${i}`, kind: "temp" },
        deviceName: `Device ${i}`,
        value_num: i,
        recorded_at: `2024-06-15T${String(10 + (i % 2)).padStart(2, "0")}:00:00.000Z`,
      }),
    );
    mockFetchLatestSensorValues.mockResolvedValue(rows);
    const { buildStatusPageSnapshot } = await import("./statusPage");

    const snapshot = await buildStatusPageSnapshot("house-1");

    expect(snapshot.sensors).toHaveLength(24);
    expect(snapshot.sensors[0]).toEqual({
      label: "Probe 0",
      kind: "temp",
      device: "Device 0",
      value_num: 0,
      value_bool: null,
      recorded_at: "2024-06-15T10:00:00.000Z",
    });
  });
});
