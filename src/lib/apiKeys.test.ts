import { beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => {
  mockFrom.mockReset();
});

describe("listHouseholdApiKeys", () => {
  it("returns the rows supabase gives back", async () => {
    mockFrom.mockReturnValue(
      mockQuery({ data: [{ id: "key-1", household_id: "house-1", name: "Metrics", key_prefix: "gtm_abc123", created_at: "t", last_used_at: null, revoked_at: null }] }),
    );
    const { listHouseholdApiKeys } = await import("./apiKeys");

    const rows = await listHouseholdApiKeys("house-1");

    expect(rows).toHaveLength(1);
    expect(rows[0].household_id).toBe("house-1");
  });

  it("falls back to an empty array when supabase returns no data", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null }));
    const { listHouseholdApiKeys } = await import("./apiKeys");

    expect(await listHouseholdApiKeys("house-1")).toEqual([]);
  });
});

describe("createHouseholdApiKey", () => {
  it("generates a gtm_-prefixed key and stores only its hash and prefix", async () => {
    let insertedRow: Record<string, unknown> | undefined;
    const builder = mockQuery({ data: { id: "key-2", household_id: "house-1", name: "Metrics key", created_at: "t", last_used_at: null, revoked_at: null } });
    (builder.insert as ReturnType<typeof vi.fn>).mockImplementation((row: Record<string, unknown>) => {
      insertedRow = row;
      return builder;
    });
    mockFrom.mockReturnValue(builder);
    const { createHouseholdApiKey } = await import("./apiKeys");

    const result = await createHouseholdApiKey({
      householdId: "house-1",
      name: "  ",
      createdBy: "user-1",
    });

    expect(result.error).toBeNull();
    expect(result.plaintext).toMatch(/^gtm_[0-9a-f]{64}$/);
    // Blank names fall back to a default rather than storing an empty string.
    expect(insertedRow?.name).toBe("Metrics key");
    expect(insertedRow?.key_prefix).toBe(result.plaintext?.slice(0, 10));
    // The plaintext key itself must never be persisted -- only its hash.
    expect(insertedRow?.key_hash).not.toBe(result.plaintext);
    expect(insertedRow).not.toHaveProperty("plaintext");
  });

  it("reports the supabase error and returns no key on failure", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: "insert failed" } }));
    const { createHouseholdApiKey } = await import("./apiKeys");

    const result = await createHouseholdApiKey({ householdId: "house-1", name: "x", createdBy: "user-1" });

    expect(result).toEqual({ plaintext: null, key: null, error: "insert failed" });
  });
});

describe("revokeHouseholdApiKey", () => {
  it("scopes the revoke to both the key id and household id", async () => {
    const builder = mockQuery({ error: null });
    mockFrom.mockReturnValue(builder);
    const { revokeHouseholdApiKey } = await import("./apiKeys");

    const result = await revokeHouseholdApiKey("house-1", "key-1");

    expect(result).toEqual({ error: null });
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ revoked_at: expect.any(String) }),
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "key-1");
    expect(builder.eq).toHaveBeenCalledWith("household_id", "house-1");
  });
});

describe("resolveApiKey", () => {
  it("rejects bearer tokens without the gtm_ prefix before ever querying supabase", async () => {
    const { resolveApiKey } = await import("./apiKeys");

    expect(await resolveApiKey("Bearer sk_live_something")).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns null when no active key matches the hash", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null }));
    const { resolveApiKey } = await import("./apiKeys");

    expect(await resolveApiKey("gtm_doesnotexist")).toBeNull();
  });

  it("resolves a matching key and stamps last_used_at", async () => {
    const lookupBuilder = mockQuery({ data: { id: "key-1", household_id: "house-1" } });
    const updateBuilder = mockQuery({ error: null });
    mockFrom
      .mockReturnValueOnce(lookupBuilder)
      .mockReturnValueOnce(updateBuilder);
    const { resolveApiKey } = await import("./apiKeys");

    const result = await resolveApiKey("gtm_sometoken");

    expect(result).toEqual({ householdId: "house-1", keyId: "key-1" });
    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_used_at: expect.any(String) }),
    );
  });
});
