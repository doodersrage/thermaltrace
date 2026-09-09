import { beforeEach, describe, expect, it, vi } from "vitest";

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "insert", "update", "delete"]) {
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

vi.mock("./inboundSigning", () => ({
  randomSigningSecret: () => "gts_fixedsigningsecret",
}));

beforeEach(() => {
  mockFrom.mockReset();
});

describe("createInboundWebhook", () => {
  it("generates a gtw_-prefixed token and stores only its hash and prefix", async () => {
    let insertedRow: Record<string, unknown> | undefined;
    const builder = mockQuery({ error: null });
    (builder.insert as ReturnType<typeof vi.fn>).mockImplementation(
      (row: Record<string, unknown>) => {
        insertedRow = row;
        return builder;
      },
    );
    mockFrom.mockReturnValue(builder);
    const { createInboundWebhook } = await import("./inboundWebhooks");

    const result = await createInboundWebhook("house-1", "user-1", "  My hook  ");

    expect(result.error).toBeNull();
    expect(result.token).toMatch(/^gtw_[0-9a-f]{48}$/);
    expect(result.signingSecret).toBe("gts_fixedsigningsecret");
    expect(insertedRow).toMatchObject({
      household_id: "house-1",
      name: "My hook",
      created_by: "user-1",
      signing_secret: "gts_fixedsigningsecret",
      token_prefix: result.token!.slice(0, 12),
    });
    expect(insertedRow!.token_hash).not.toBe(result.token);
    expect(insertedRow!.token_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("defaults an empty name to 'Inbound webhook'", async () => {
    const builder = mockQuery({ error: null });
    mockFrom.mockReturnValue(builder);
    const { createInboundWebhook } = await import("./inboundWebhooks");

    await createInboundWebhook("house-1", "user-1", "   ");

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Inbound webhook" }),
    );
  });

  it("returns null token/secret and the error message when the insert fails", async () => {
    mockFrom.mockReturnValue(mockQuery({ error: { message: "duplicate" } }));
    const { createInboundWebhook } = await import("./inboundWebhooks");

    const result = await createInboundWebhook("house-1", "user-1", "Hook");

    expect(result).toEqual({ token: null, signingSecret: null, error: "duplicate" });
  });
});

describe("listInboundWebhooks", () => {
  it("maps rows and derives has_signing_secret from presence of a secret", async () => {
    mockFrom.mockReturnValue(
      mockQuery({
        data: [
          {
            id: "w1",
            household_id: "house-1",
            name: "Hook A",
            token_prefix: "gtw_abc123",
            created_at: "t1",
            last_used_at: null,
            signing_secret: "gts_secret",
          },
          {
            id: "w2",
            household_id: "house-1",
            name: "Hook B",
            token_prefix: "gtw_def456",
            created_at: "t2",
            last_used_at: "t3",
            signing_secret: null,
          },
        ],
        error: null,
      }),
    );
    const { listInboundWebhooks } = await import("./inboundWebhooks");

    const result = await listInboundWebhooks("house-1");

    expect(result.error).toBeNull();
    expect(result.webhooks).toEqual([
      {
        id: "w1",
        household_id: "house-1",
        name: "Hook A",
        token_prefix: "gtw_abc123",
        created_at: "t1",
        last_used_at: null,
        has_signing_secret: true,
      },
      {
        id: "w2",
        household_id: "house-1",
        name: "Hook B",
        token_prefix: "gtw_def456",
        created_at: "t2",
        last_used_at: "t3",
        has_signing_secret: false,
      },
    ]);
    // The raw signing secret must never leak out of listInboundWebhooks.
    expect(JSON.stringify(result.webhooks)).not.toContain("gts_secret");
  });

  it("falls back to an empty array when there is no data", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: null }));
    const { listInboundWebhooks } = await import("./inboundWebhooks");

    expect(await listInboundWebhooks("house-1")).toEqual({ webhooks: [], error: null });
  });

  it("surfaces an error message", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: "boom" } }));
    const { listInboundWebhooks } = await import("./inboundWebhooks");

    expect((await listInboundWebhooks("house-1")).error).toBe("boom");
  });
});

describe("revokeInboundWebhook", () => {
  it("deletes the webhook scoped to its household", async () => {
    const builder = mockQuery({ error: null });
    mockFrom.mockReturnValue(builder);
    const { revokeInboundWebhook } = await import("./inboundWebhooks");

    const result = await revokeInboundWebhook("w1", "house-1");

    expect(result).toEqual({ error: null });
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "w1");
    expect(builder.eq).toHaveBeenCalledWith("household_id", "house-1");
  });

  it("surfaces a delete error", async () => {
    mockFrom.mockReturnValue(mockQuery({ error: { message: "not allowed" } }));
    const { revokeInboundWebhook } = await import("./inboundWebhooks");

    expect(await revokeInboundWebhook("w1", "house-1")).toEqual({ error: "not allowed" });
  });
});

describe("resolveInboundWebhook", () => {
  it("returns null when no webhook matches the token's hash", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null }));
    const { resolveInboundWebhook } = await import("./inboundWebhooks");

    expect(await resolveInboundWebhook("gtw_unknown")).toBeNull();
  });

  it("resolves a matching token and touches last_used_at", async () => {
    const builder = mockQuery({
      data: { id: "w1", household_id: "house-1", signing_secret: "gts_secret" },
    });
    mockFrom.mockReturnValue(builder);
    const { resolveInboundWebhook } = await import("./inboundWebhooks");

    const result = await resolveInboundWebhook("  gtw_realtoken  ");

    expect(result).toEqual({
      householdId: "house-1",
      webhookId: "w1",
      signingSecret: "gts_secret",
    });
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_used_at: expect.any(String) }),
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "w1");
  });

  it("returns a null signingSecret when the webhook has none", async () => {
    mockFrom.mockReturnValue(
      mockQuery({ data: { id: "w1", household_id: "house-1", signing_secret: null } }),
    );
    const { resolveInboundWebhook } = await import("./inboundWebhooks");

    const result = await resolveInboundWebhook("gtw_realtoken");

    expect(result?.signingSecret).toBeNull();
  });

  it("hashes the same token to the same value regardless of surrounding whitespace", async () => {
    const seenHashes: string[] = [];
    mockFrom.mockImplementation(() => {
      const builder = mockQuery({ data: null });
      const originalEq = builder.eq as ReturnType<typeof vi.fn>;
      builder.eq = vi.fn((column: string, value: string) => {
        if (column === "token_hash") seenHashes.push(value);
        return originalEq(column, value);
      });
      return builder;
    });
    const { resolveInboundWebhook } = await import("./inboundWebhooks");

    await resolveInboundWebhook("gtw_sametoken");
    await resolveInboundWebhook("  gtw_sametoken  ");

    expect(seenHashes).toHaveLength(2);
    expect(seenHashes[0]).toBe(seenHashes[1]);
  });
});
