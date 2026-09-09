import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertEventRow } from "./alertEvents";

function mockQuery(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const builder: Record<string, unknown> = {};
  for (const method of [
    "select",
    "eq",
    "order",
    "insert",
    "update",
    "is",
    "not",
    "gte",
    "lte",
    "limit",
  ]) {
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

function row(overrides: Partial<AlertEventRow> = {}): AlertEventRow {
  return {
    id: 1,
    user_id: "user-1",
    kind: "freeze",
    title: "Freeze warning",
    body: "Garage is freezing",
    channels_sent: ["email"],
    channels_skipped: [],
    created_at: "2024-01-01T00:00:00.000Z",
    acknowledged_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockFrom.mockReset();
});

describe("recordAlertEvent", () => {
  it("inserts the event and returns the new id", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: { id: 42 }, error: null }));
    const { recordAlertEvent } = await import("./alertEvents");

    const id = await recordAlertEvent({
      userId: "user-1",
      kind: "freeze",
      title: "t",
      body: "b",
      channelsSent: ["email"],
      channelsSkipped: ["sms"],
    });

    expect(id).toBe(42);
    expect(mockFrom).toHaveBeenCalledWith("alert_events");
  });

  it("returns null and logs when the insert errors", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: "boom" } }));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { recordAlertEvent } = await import("./alertEvents");

    const id = await recordAlertEvent({
      userId: "user-1",
      kind: "freeze",
      title: "t",
      body: "b",
      channelsSent: [],
      channelsSkipped: [],
    });

    expect(id).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns null when there is no error but also no id", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: null }));
    const { recordAlertEvent } = await import("./alertEvents");

    const id = await recordAlertEvent({
      userId: "user-1",
      kind: "freeze",
      title: "t",
      body: "b",
      channelsSent: [],
      channelsSkipped: [],
    });

    expect(id).toBeNull();
  });
});

describe("acknowledgeAlertEvent", () => {
  it("returns ok on a successful update", async () => {
    mockFrom.mockReturnValue(mockQuery({ error: null }));
    const { acknowledgeAlertEvent } = await import("./alertEvents");

    const result = await acknowledgeAlertEvent("user-1", 5);

    expect(result).toEqual({ ok: true });
  });

  it("surfaces the error message on failure", async () => {
    mockFrom.mockReturnValue(mockQuery({ error: { message: "not found" } }));
    const { acknowledgeAlertEvent } = await import("./alertEvents");

    const result = await acknowledgeAlertEvent("user-1", 5);

    expect(result).toEqual({ ok: false, error: "not found" });
  });
});

describe("acknowledgeLatestUnackedAlert", () => {
  it("returns an error when the fetch itself fails", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: "db down" } }));
    const { acknowledgeLatestUnackedAlert } = await import("./alertEvents");

    const result = await acknowledgeLatestUnackedAlert("user-1");

    expect(result).toEqual({ ok: false, error: "db down" });
  });

  it("reports no unhandled alerts when none are found", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: null }));
    const { acknowledgeLatestUnackedAlert } = await import("./alertEvents");

    const result = await acknowledgeLatestUnackedAlert("user-1");

    expect(result).toEqual({ ok: false, error: "No unhandled alerts." });
  });

  it("acknowledges the found event and returns its id", async () => {
    const fetchResult = mockQuery({ data: { id: 7 }, error: null });
    const updateResult = mockQuery({ error: null });
    mockFrom.mockReturnValueOnce(fetchResult).mockReturnValueOnce(updateResult);
    const { acknowledgeLatestUnackedAlert } = await import("./alertEvents");

    const result = await acknowledgeLatestUnackedAlert("user-1");

    expect(result).toEqual({ ok: true, eventId: 7 });
  });

  it("propagates a failure from the acknowledge step", async () => {
    const fetchResult = mockQuery({ data: { id: 7 }, error: null });
    const updateResult = mockQuery({ error: { message: "conflict" } });
    mockFrom.mockReturnValueOnce(fetchResult).mockReturnValueOnce(updateResult);
    const { acknowledgeLatestUnackedAlert } = await import("./alertEvents");

    const result = await acknowledgeLatestUnackedAlert("user-1");

    expect(result).toEqual({ ok: false, error: "conflict" });
  });
});

describe("getAlertEventForUser", () => {
  it("returns the row when found", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: row(), error: null }));
    const { getAlertEventForUser } = await import("./alertEvents");

    const result = await getAlertEventForUser("user-1", 1);

    expect(result).toEqual(row());
  });

  it("returns null on error or missing data", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: null }));
    const { getAlertEventForUser } = await import("./alertEvents");

    expect(await getAlertEventForUser("user-1", 1)).toBeNull();
  });
});

describe("listRecentAlertEvents", () => {
  it("returns the rows on success", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [row(), row({ id: 2 })], error: null }));
    const { listRecentAlertEvents } = await import("./alertEvents");

    const result = await listRecentAlertEvents("user-1");

    expect(result).toHaveLength(2);
  });

  it("returns an empty array on error", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: "boom" } }));
    const { listRecentAlertEvents } = await import("./alertEvents");

    expect(await listRecentAlertEvents("user-1")).toEqual([]);
  });
});

describe("listAlertEventsInRange", () => {
  it("returns the matching rows on success", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [row()], error: null }));
    const { listAlertEventsInRange } = await import("./alertEvents");

    const result = await listAlertEventsInRange(
      "user-1",
      "2024-01-01T00:00:00.000Z",
      "2024-01-31T23:59:59.000Z",
    );

    expect(result).toEqual([row()]);
  });

  it("returns an empty array when the query errors", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: "boom" } }));
    const { listAlertEventsInRange } = await import("./alertEvents");

    expect(
      await listAlertEventsInRange("user-1", "2024-01-01", "2024-01-31"),
    ).toEqual([]);
  });
});

describe("countUnacknowledgedAlerts", () => {
  it("returns the count on success", async () => {
    mockFrom.mockReturnValue(mockQuery({ count: 3 }));
    const { countUnacknowledgedAlerts } = await import("./alertEvents");

    expect(await countUnacknowledgedAlerts("user-1")).toBe(3);
  });

  it("defaults to 0 when count is null", async () => {
    mockFrom.mockReturnValue(mockQuery({ count: null }));
    const { countUnacknowledgedAlerts } = await import("./alertEvents");

    expect(await countUnacknowledgedAlerts("user-1")).toBe(0);
  });
});

describe("buildAlertEventsCsv", () => {
  it("builds a header row plus one row per event", async () => {
    const { buildAlertEventsCsv } = await import("./alertEvents");

    const csv = buildAlertEventsCsv([row()]);
    const lines = csv.split("\n");

    expect(lines[0]).toBe(
      "created_at,kind,title,body,channels_sent,channels_skipped,acknowledged_at",
    );
    expect(lines[1]).toBe(
      "2024-01-01T00:00:00.000Z,freeze,Freeze warning,Garage is freezing,email,,",
    );
  });

  it("joins multiple channels with a pipe and escapes commas in text fields", async () => {
    const { buildAlertEventsCsv } = await import("./alertEvents");

    const csv = buildAlertEventsCsv([
      row({
        title: "Freeze, flood risk",
        channels_sent: ["email", "sms"],
        channels_skipped: ["push"],
        acknowledged_at: "2024-01-02T00:00:00.000Z",
      }),
    ]);
    const lines = csv.split("\n");

    expect(lines[1]).toBe(
      '2024-01-01T00:00:00.000Z,freeze,"Freeze, flood risk",Garage is freezing,email|sms,push,2024-01-02T00:00:00.000Z',
    );
  });

  it("produces just the header row for an empty list", async () => {
    const { buildAlertEventsCsv } = await import("./alertEvents");

    expect(buildAlertEventsCsv([])).toBe(
      "created_at,kind,title,body,channels_sent,channels_skipped,acknowledged_at",
    );
  });
});
