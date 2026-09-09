import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ALERT_SETTINGS } from "./alerts";

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit", "upsert", "update"]) {
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

beforeEach(() => {
  mockFrom.mockReset();
});

describe("isTwilioConfigured", () => {
  const keys = ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"] as const;
  let prev: Record<string, string | undefined>;

  beforeEach(() => {
    const env = import.meta.env as unknown as Record<string, string | undefined>;
    prev = Object.fromEntries(keys.map((k) => [k, env[k]]));
  });

  afterEach(() => {
    const env = import.meta.env as unknown as Record<string, string | undefined>;
    for (const k of keys) env[k] = prev[k];
  });

  it("is false when any Twilio credential is missing", async () => {
    const env = import.meta.env as unknown as Record<string, string | undefined>;
    env.TWILIO_ACCOUNT_SID = "sid";
    env.TWILIO_AUTH_TOKEN = "";
    env.TWILIO_FROM_NUMBER = "+15551234567";
    const { isTwilioConfigured } = await import("./notify");

    expect(isTwilioConfigured()).toBe(false);
  });

  it("is true once all three credentials are set", async () => {
    const env = import.meta.env as unknown as Record<string, string | undefined>;
    env.TWILIO_ACCOUNT_SID = "sid";
    env.TWILIO_AUTH_TOKEN = "token";
    env.TWILIO_FROM_NUMBER = "+15551234567";
    const { isTwilioConfigured } = await import("./notify");

    expect(isTwilioConfigured()).toBe(true);
  });
});

describe("getAlertSettingsForUser", () => {
  it("returns settings decoded from an existing row without writing anything", async () => {
    const builder = mockQuery({ data: { user_id: "user-1", freeze_threshold_f: 30 } });
    mockFrom.mockReturnValue(builder);
    const { getAlertSettingsForUser } = await import("./notify");

    const settings = await getAlertSettingsForUser("user-1");

    expect(settings.freezeThresholdF).toBe(30);
    expect(builder.upsert).not.toHaveBeenCalled();
  });

  it("falls back to metadata and persists it when no row exists yet", async () => {
    const builder = mockQuery({ data: null });
    mockFrom.mockReturnValue(builder);
    const { getAlertSettingsForUser } = await import("./notify");

    const settings = await getAlertSettingsForUser("user-1", {});

    expect(settings).toEqual(expect.objectContaining({ lastAlertSentAt: null }));
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1" }),
    );
  });
});

describe("saveAlertSettingsForUser", () => {
  it("upserts the settings row keyed on user_id and returns no error on success", async () => {
    const builder = mockQuery({ error: null });
    mockFrom.mockReturnValue(builder);
    const { saveAlertSettingsForUser } = await import("./notify");

    const result = await saveAlertSettingsForUser("user-1", DEFAULT_ALERT_SETTINGS);

    expect(result).toEqual({ error: null });
    expect(builder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1" }),
      { onConflict: "user_id" },
    );
  });

  it("surfaces the supabase error message on failure", async () => {
    mockFrom.mockReturnValue(mockQuery({ error: { message: "db unavailable" } }));
    const { saveAlertSettingsForUser } = await import("./notify");

    const result = await saveAlertSettingsForUser("user-1", DEFAULT_ALERT_SETTINGS);

    expect(result).toEqual({ error: "db unavailable" });
  });
});

describe("markCooldown", () => {
  it("only updates when a settings row already exists", async () => {
    const builder = mockQuery({ data: [{ user_id: "user-1" }], error: null });
    mockFrom.mockReturnValue(builder);
    const { markCooldown } = await import("./notify");

    await markCooldown("user-1", "last_alert_sent_at");

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_alert_sent_at: expect.any(String) }),
    );
    expect(builder.upsert).not.toHaveBeenCalled();
  });

  it("upserts a fresh default-backed row when the update matches nothing", async () => {
    const updateBuilder = mockQuery({ data: [], error: null });
    const upsertBuilder = mockQuery({ error: null });
    mockFrom.mockReturnValueOnce(updateBuilder).mockReturnValueOnce(upsertBuilder);
    const { markCooldown } = await import("./notify");

    await markCooldown("user-1", "last_outage_alert_at");

    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", last_outage_alert_at: expect.any(String) }),
      { onConflict: "user_id" },
    );
  });
});

describe("alertSettingsHaveDeliveryTimestamp", () => {
  it("is false when every delivery timestamp is null", async () => {
    const { alertSettingsHaveDeliveryTimestamp } = await import("./notify");
    expect(alertSettingsHaveDeliveryTimestamp(DEFAULT_ALERT_SETTINGS)).toBe(false);
  });

  it("is true when any single delivery timestamp is set", async () => {
    const { alertSettingsHaveDeliveryTimestamp } = await import("./notify");
    expect(
      alertSettingsHaveDeliveryTimestamp({
        ...DEFAULT_ALERT_SETTINGS,
        lastRssiAlertAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toBe(true);
  });
});

describe("ensureAlertDeliveryEvidence", () => {
  it("short-circuits without querying supabase when a cooldown timestamp already proves delivery", async () => {
    const { ensureAlertDeliveryEvidence } = await import("./notify");
    const settings = { ...DEFAULT_ALERT_SETTINGS, lastAlertSentAt: "2026-01-01T00:00:00.000Z" };

    const result = await ensureAlertDeliveryEvidence("user-1", settings);

    expect(result).toEqual({ hasDelivery: true, settings });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("reports no delivery when alert_events has nothing with sent channels", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [{ channels_sent: [] }], error: null }));
    const { ensureAlertDeliveryEvidence } = await import("./notify");

    const result = await ensureAlertDeliveryEvidence("user-1", DEFAULT_ALERT_SETTINGS);

    expect(result.hasDelivery).toBe(false);
  });

  it("heals the cooldown timestamp when alert_events proves a delivery happened", async () => {
    const eventsBuilder = mockQuery({ data: [{ channels_sent: ["email"] }], error: null });
    const updateBuilder = mockQuery({ data: [{ user_id: "user-1" }], error: null });
    const healedRowBuilder = mockQuery({
      data: { user_id: "user-1", last_alert_sent_at: "2026-02-01T00:00:00.000Z" },
    });
    mockFrom
      .mockReturnValueOnce(eventsBuilder)
      .mockReturnValueOnce(updateBuilder)
      .mockReturnValueOnce(healedRowBuilder);
    const { ensureAlertDeliveryEvidence } = await import("./notify");

    const result = await ensureAlertDeliveryEvidence("user-1", DEFAULT_ALERT_SETTINGS);

    expect(result.hasDelivery).toBe(true);
    expect(result.settings.lastAlertSentAt).toBe("2026-02-01T00:00:00.000Z");
  });
});

describe("markEscalation", () => {
  it("stamps last_escalation_at for the user", async () => {
    const builder = mockQuery({ error: null });
    mockFrom.mockReturnValue(builder);
    const { markEscalation } = await import("./notify");

    await markEscalation("user-1");

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_escalation_at: expect.any(String) }),
    );
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");
  });
});
