import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
vi.mock("./supabase", () => ({
  createServerClient: () => ({ from: (...a: unknown[]) => mockFrom(...a) }),
}));

import {
  addEmailSuppression,
  isMailDeliveryBounceError,
  isPlausibleEmailAddress,
  isEmailSuppressed,
  listEmailSuppressions,
  normalizeEmailAddress,
  suppressEmail,
  unsuppressEmail,
} from "./emailSuppressions";

function chain(result: { data?: unknown; error?: { message: string } | null }) {
  const api = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    upsert: vi.fn().mockResolvedValue(result),
  };
  return api;
}

describe("emailSuppressions", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("normalizes and validates addresses", () => {
    expect(normalizeEmailAddress("  A@B.Com ")).toBe("a@b.com");
    expect(isPlausibleEmailAddress("user@example.com")).toBe(true);
    expect(isPlausibleEmailAddress("not-an-email")).toBe(false);
    expect(isPlausibleEmailAddress("a@b")).toBe(false);
    expect(isPlausibleEmailAddress("1234567+user@users.noreply.github.com")).toBe(
      false,
    );
    expect(isPlausibleEmailAddress("noreply@example.com")).toBe(false);
  });

  it("detects bounce-like mailer errors", () => {
    expect(
      isMailDeliveryBounceError(
        new Error("failed to enqueue email: enqueue failed and delivery had 1 temporary bounces (cannot retry)"),
      ),
    ).toBe(true);
    expect(isMailDeliveryBounceError(new Error("E_RECIPIENT_SUPPRESSED"))).toBe(true);
    expect(isMailDeliveryBounceError(new Error("SMTP timeout"))).toBe(false);
  });

  it("reports suppressed addresses", async () => {
    mockFrom.mockReturnValue(chain({ data: { email: "bad@example.com" }, error: null }));
    expect(await isEmailSuppressed("Bad@Example.com")).toBe(true);
  });

  it("fails open when the lookup errors", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "missing table" } }));
    expect(await isEmailSuppressed("user@example.com")).toBe(false);
  });

  it("upserts suppressions", async () => {
    const api = chain({ data: null, error: null });
    mockFrom.mockReturnValue(api);
    await suppressEmail("Bad@Example.com", "bounce", "hard bounce");
    expect(api.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "bad@example.com",
        reason: "bounce",
        last_error: "hard bounce",
      }),
      { onConflict: "email" },
    );
  });

  it("adds a manual suppression with a result", async () => {
    const api = chain({ data: null, error: null });
    mockFrom.mockReturnValue(api);
    expect(
      await addEmailSuppression("Bad@Example.com", "manual", "ops note"),
    ).toEqual({ ok: true, error: null });
    expect(api.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "bad@example.com",
        reason: "manual",
        last_error: "ops note",
      }),
      { onConflict: "email" },
    );
  });

  it("rejects blank emails on manual add", async () => {
    expect(await addEmailSuppression("not-an-email")).toEqual({
      ok: false,
      error: "Enter a valid email address",
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("lists suppressions newest first", async () => {
    const api = {
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            email: "a@example.com",
            reason: "bounce",
            last_error: null,
            created_at: "2026-01-01T00:00:00Z",
            updated_at: "2026-01-02T00:00:00Z",
          },
        ],
        error: null,
      }),
    };
    mockFrom.mockReturnValue(api);
    const result = await listEmailSuppressions(50);
    expect(result.error).toBeNull();
    expect(result.rows).toHaveLength(1);
    expect(api.order).toHaveBeenCalledWith("updated_at", { ascending: false });
  });

  it("deletes a suppression", async () => {
    const api = {
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ error: null }),
    };
    mockFrom.mockReturnValue(api);
    expect(await unsuppressEmail("Bad@Example.com")).toEqual({
      ok: true,
      error: null,
    });
    expect(api.eq).toHaveBeenCalledWith("email", "bad@example.com");
  });
});
