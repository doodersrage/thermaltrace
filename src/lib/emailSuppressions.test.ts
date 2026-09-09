import { describe, expect, it, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
vi.mock("./supabase", () => ({
  createServerClient: () => ({ from: (...a: unknown[]) => mockFrom(...a) }),
}));

import {
  isMailDeliveryBounceError,
  isPlausibleEmailAddress,
  isEmailSuppressed,
  normalizeEmailAddress,
  suppressEmail,
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
});
