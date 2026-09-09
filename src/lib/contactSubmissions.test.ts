import { beforeEach, describe, expect, it, vi } from "vitest";

function mockQuery(result: { data?: unknown; error?: unknown; count?: number | null }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "or", "order", "range"]) {
    builder[method] = vi.fn(() => builder);
  }
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

beforeEach(() => {
  mockFrom.mockReset();
});

describe("getContactMessageText", () => {
  it("returns a plain message untouched", async () => {
    const { getContactMessageText } = await import("./contactSubmissions");
    expect(getContactMessageText("Hello there")).toBe("Hello there");
  });

  it("unwraps a JSON-encoded string message", async () => {
    const { getContactMessageText } = await import("./contactSubmissions");
    expect(getContactMessageText('"Hello there"')).toBe("Hello there");
  });

  it("falls back to the raw message when JSON parses to a non-string", async () => {
    const { getContactMessageText } = await import("./contactSubmissions");
    expect(getContactMessageText('{"a":1}')).toBe('{"a":1}');
  });

  it("falls back to the raw message when JSON.parse throws", async () => {
    const { getContactMessageText } = await import("./contactSubmissions");
    expect(getContactMessageText('{not valid json')).toBe('{not valid json');
  });

  it("leaves a message that merely contains quotes mid-string alone", async () => {
    const { getContactMessageText } = await import("./contactSubmissions");
    expect(getContactMessageText('Say "hi" to them')).toBe('Say "hi" to them');
  });
});

describe("buildContactsCsv", () => {
  it("builds a header row plus one row per submission", async () => {
    const { buildContactsCsv } = await import("./contactSubmissions");
    const csv = buildContactsCsv([
      {
        id: 1,
        name: "Ann",
        email: "ann@example.com",
        message: "Hi",
        created_at: "2024-01-01T00:00:00.000Z",
        status: "open",
        admin_notes: null,
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe("submitted_at,name,email,status,admin_notes,message");
    expect(lines[1]).toBe("2024-01-01T00:00:00.000Z,Ann,ann@example.com,open,,Hi");
  });

  it("unwraps JSON-encoded messages and escapes commas", async () => {
    const { buildContactsCsv } = await import("./contactSubmissions");
    const csv = buildContactsCsv([
      {
        id: 2,
        name: "Bo, Jr.",
        email: "bo@example.com",
        message: '"Hello, world"',
        created_at: "2024-01-02T00:00:00.000Z",
        status: "closed",
        admin_notes: "handled",
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[1]).toBe(
      '2024-01-02T00:00:00.000Z,"Bo, Jr.",bo@example.com,closed,handled,"Hello, world"',
    );
  });

  it("returns just the header row for an empty list", async () => {
    const { buildContactsCsv } = await import("./contactSubmissions");
    expect(buildContactsCsv([])).toBe("submitted_at,name,email,status,admin_notes,message");
  });
});

describe("fetchContactSubmissions", () => {
  it("paginates using page/pageSize to compute range", async () => {
    const builder = mockQuery({ data: [{ id: 1 }], error: null, count: 45 });
    mockFrom.mockReturnValue(builder);
    const { fetchContactSubmissions } = await import("./contactSubmissions");

    const result = await fetchContactSubmissions(2, 20);

    expect(builder.range).toHaveBeenCalledWith(20, 39);
    expect(result).toEqual({
      submissions: [{ id: 1 }],
      page: 2,
      pageSize: 20,
      totalCount: 45,
      totalPages: 3,
      error: null,
    });
  });

  it("clamps an invalid page to 1", async () => {
    const builder = mockQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(builder);
    const { fetchContactSubmissions } = await import("./contactSubmissions");

    const result = await fetchContactSubmissions(-5, 20);

    expect(result.page).toBe(1);
    expect(builder.range).toHaveBeenCalledWith(0, 19);
  });

  it("applies a status filter", async () => {
    const builder = mockQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(builder);
    const { fetchContactSubmissions } = await import("./contactSubmissions");

    await fetchContactSubmissions(1, 20, { status: "open" });

    expect(builder.eq).toHaveBeenCalledWith("status", "open");
  });

  it("applies a search filter across name/email/message", async () => {
    const builder = mockQuery({ data: [], error: null, count: 0 });
    mockFrom.mockReturnValue(builder);
    const { fetchContactSubmissions } = await import("./contactSubmissions");

    await fetchContactSubmissions(1, 20, { search: "smith" });

    expect(builder.or).toHaveBeenCalledWith(
      "name.ilike.%smith%,email.ilike.%smith%,message.ilike.%smith%",
    );
  });

  it("returns zeroed-out results and the message on error", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: "db down" }, count: null }));
    const { fetchContactSubmissions } = await import("./contactSubmissions");

    expect(await fetchContactSubmissions(1, 20)).toEqual({
      submissions: [],
      page: 1,
      pageSize: 20,
      totalCount: 0,
      totalPages: 0,
      error: "db down",
    });
  });

  it("reports 0 total pages when there are no rows", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [], error: null, count: 0 }));
    const { fetchContactSubmissions } = await import("./contactSubmissions");

    const result = await fetchContactSubmissions(1, 20);

    expect(result.totalPages).toBe(0);
  });
});

describe("fetchAllContactSubmissions", () => {
  it("stops after one batch smaller than the batch size", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [{ id: 1 }, { id: 2 }], error: null }));
    const { fetchAllContactSubmissions } = await import("./contactSubmissions");

    const result = await fetchAllContactSubmissions();

    expect(result).toEqual({ submissions: [{ id: 1 }, { id: 2 }], error: null });
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("stops when a batch comes back empty", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [], error: null }));
    const { fetchAllContactSubmissions } = await import("./contactSubmissions");

    expect(await fetchAllContactSubmissions()).toEqual({ submissions: [], error: null });
  });

  it("pages through multiple full batches", async () => {
    const fullBatch = Array.from({ length: 1000 }, (_, i) => ({ id: i }));
    const secondBatch = [{ id: 1000 }];
    mockFrom
      .mockReturnValueOnce(mockQuery({ data: fullBatch, error: null }))
      .mockReturnValueOnce(mockQuery({ data: secondBatch, error: null }));
    const { fetchAllContactSubmissions } = await import("./contactSubmissions");

    const result = await fetchAllContactSubmissions();

    expect(result.submissions).toHaveLength(1001);
    expect(result.error).toBeNull();
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });

  it("returns the error and stops paging when a batch fails", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: "timeout" } }));
    const { fetchAllContactSubmissions } = await import("./contactSubmissions");

    expect(await fetchAllContactSubmissions()).toEqual({ submissions: [], error: "timeout" });
  });
});
