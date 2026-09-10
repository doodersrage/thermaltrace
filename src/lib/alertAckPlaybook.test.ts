import { beforeEach, describe, expect, it, vi } from "vitest";

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  return builder;
}

const mockFrom = vi.fn();
vi.mock("./supabase", () => ({
  createServerClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}));

const mockGetAlertEventForUser = vi.fn();
const mockAcknowledgeAlertEvent = vi.fn();
const mockUpdateAlertEventMeta = vi.fn();
vi.mock("./alertEvents", () => ({
  getAlertEventForUser: (...a: unknown[]) => mockGetAlertEventForUser(...a),
  acknowledgeAlertEvent: (...a: unknown[]) => mockAcknowledgeAlertEvent(...a),
  updateAlertEventMeta: (...a: unknown[]) => mockUpdateAlertEventMeta(...a),
}));

const mockGetUserHouseholdId = vi.fn();
vi.mock("./households", () => ({
  getUserHouseholdId: (...a: unknown[]) => mockGetUserHouseholdId(...a),
}));

const mockSnoozeAlertsForUser = vi.fn();
vi.mock("./alertSnooze", () => ({
  snoozeAlertsForUser: (...a: unknown[]) => mockSnoozeAlertsForUser(...a),
}));

const mockSendTenantFreezeRelay = vi.fn();
vi.mock("./tenantRelay", () => ({
  sendTenantFreezeRelay: (...a: unknown[]) => mockSendTenantFreezeRelay(...a),
}));

const mockDeliverWebhookPost = vi.fn();
vi.mock("./webhookDeliveries", () => ({
  deliverWebhookPost: (...a: unknown[]) => mockDeliverWebhookPost(...a),
}));

const mockGetAlertSettingsForUser = vi.fn();
vi.mock("./notify", () => ({
  getAlertSettingsForUser: (...a: unknown[]) => mockGetAlertSettingsForUser(...a),
}));

vi.mock("./schemaMarkup", () => ({
  resolveSiteUrl: () => "https://example.com",
}));

const baseEvent = {
  id: 42,
  user_id: "user-1",
  kind: "freeze",
  title: "Garage freezing",
  body: "Temp dropped below 32F",
  channels_sent: ["email"],
  channels_skipped: [],
  created_at: "2024-01-01T00:00:00.000Z",
  acknowledged_at: null,
};

beforeEach(() => {
  mockFrom.mockReset();
  mockGetAlertEventForUser.mockReset().mockResolvedValue(baseEvent);
  mockAcknowledgeAlertEvent.mockReset().mockResolvedValue({ ok: true });
  mockUpdateAlertEventMeta.mockReset().mockResolvedValue({ ok: true });
  mockGetUserHouseholdId.mockReset().mockResolvedValue("house-1");
  mockSnoozeAlertsForUser.mockReset().mockResolvedValue(undefined);
  mockSendTenantFreezeRelay.mockReset().mockResolvedValue({ ok: true });
  mockDeliverWebhookPost.mockReset().mockResolvedValue(null);
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue({});
});

describe("executeAlertAckPlaybook", () => {
  it("fails fast when the event does not belong to the user", async () => {
    mockGetAlertEventForUser.mockResolvedValue(null);
    const { executeAlertAckPlaybook } = await import("./alertAckPlaybook");

    const result = await executeAlertAckPlaybook({
      userId: "user-1",
      userEmail: null,
      eventId: 42,
      action: "ack",
    });

    expect(result).toEqual({ ok: false, message: "Alert event not found." });
    expect(mockAcknowledgeAlertEvent).not.toHaveBeenCalled();
  });

  it("acks a plain 'ack' without snoozing", async () => {
    const { executeAlertAckPlaybook } = await import("./alertAckPlaybook");

    const result = await executeAlertAckPlaybook({
      userId: "user-1",
      userEmail: null,
      eventId: 42,
      action: "ack",
    });

    expect(mockSnoozeAlertsForUser).not.toHaveBeenCalled();
    expect(mockAcknowledgeAlertEvent).toHaveBeenCalledWith("user-1", 42);
    expect(result).toEqual({ ok: true, message: "Alert marked as handled." });
  });

  it.each([
    ["snooze_1h", 1, "Alert handled: freeze alerts snoozed for 1 hour."],
    ["snooze_4h", 4, "Alert handled: freeze alerts snoozed for 4 hours."],
    ["snooze_24h", 24, "Alert handled: freeze alerts snoozed for 24 hours."],
    [
      "false_alarm",
      24,
      "Marked as false alarm: alerts snoozed 24h. Suggested fix: Raise the threshold a degree or two. Open /dashboard/alerts?tab=settings#alert-section-essentials",
    ],
  ] as const)("snoozes %s for %i hour(s)", async (action, hours, message) => {
    const { executeAlertAckPlaybook } = await import("./alertAckPlaybook");

    const result = await executeAlertAckPlaybook({
      userId: "user-1",
      userEmail: null,
      eventId: 42,
      action,
    });

    expect(mockSnoozeAlertsForUser).toHaveBeenCalledWith("user-1", hours);
    expect(result).toEqual({ ok: true, message });
  });

  describe("notify_tenant", () => {
    it("fails when the user has no household", async () => {
      mockGetUserHouseholdId.mockResolvedValue(null);
      const { executeAlertAckPlaybook } = await import("./alertAckPlaybook");

      const result = await executeAlertAckPlaybook({
        userId: "user-1",
        userEmail: null,
        eventId: 42,
        action: "notify_tenant",
      });

      expect(result).toEqual({ ok: false, message: "No household for tenant relay." });
      expect(mockSendTenantFreezeRelay).not.toHaveBeenCalled();
      expect(mockAcknowledgeAlertEvent).not.toHaveBeenCalled();
    });

    it("relays using the household name and acks on success", async () => {
      mockFrom.mockReturnValue(mockQuery({ data: { name: "The Smiths" } }));
      const { executeAlertAckPlaybook } = await import("./alertAckPlaybook");

      const result = await executeAlertAckPlaybook({
        userId: "user-1",
        userEmail: null,
        eventId: 42,
        action: "notify_tenant",
        siteUrl: "https://custom.example",
      });

      expect(mockSendTenantFreezeRelay).toHaveBeenCalledWith({
        householdId: "house-1",
        managerUserId: "user-1",
        householdName: "The Smiths",
        alertTitle: "Garage freezing",
        alertBody: "Temp dropped below 32F",
        siteUrl: "https://custom.example",
      });
      expect(mockAcknowledgeAlertEvent).toHaveBeenCalledWith("user-1", 42);
      expect(result).toEqual({ ok: true, message: "Alert handled: tenant contact emailed." });
    });

    it("falls back to 'Property' when the household has no usable name", async () => {
      mockFrom.mockReturnValue(mockQuery({ data: { name: "   " } }));
      const { executeAlertAckPlaybook } = await import("./alertAckPlaybook");

      await executeAlertAckPlaybook({
        userId: "user-1",
        userEmail: null,
        eventId: 42,
        action: "notify_tenant",
      });

      expect(mockSendTenantFreezeRelay).toHaveBeenCalledWith(
        expect.objectContaining({ householdName: "Property" }),
      );
    });

    it("surfaces a relay failure and does not ack", async () => {
      mockFrom.mockReturnValue(mockQuery({ data: { name: "The Smiths" } }));
      mockSendTenantFreezeRelay.mockResolvedValue({ ok: false, error: "Not authorized to notify tenant." });
      const { executeAlertAckPlaybook } = await import("./alertAckPlaybook");

      const result = await executeAlertAckPlaybook({
        userId: "user-1",
        userEmail: null,
        eventId: 42,
        action: "notify_tenant",
      });

      expect(result).toEqual({ ok: false, message: "Not authorized to notify tenant." });
      expect(mockAcknowledgeAlertEvent).not.toHaveBeenCalled();
    });

    it("falls back to a generic relay error message", async () => {
      mockFrom.mockReturnValue(mockQuery({ data: { name: "The Smiths" } }));
      mockSendTenantFreezeRelay.mockResolvedValue({ ok: false });
      const { executeAlertAckPlaybook } = await import("./alertAckPlaybook");

      const result = await executeAlertAckPlaybook({
        userId: "user-1",
        userEmail: null,
        eventId: 42,
        action: "notify_tenant",
      });

      expect(result.message).toBe("Tenant relay failed.");
    });
  });

  describe("webhook_ping", () => {
    it("fails when no outbound webhook is configured", async () => {
      mockGetAlertSettingsForUser.mockResolvedValue({ outboundWebhookUrl: "  " });
      const { executeAlertAckPlaybook } = await import("./alertAckPlaybook");

      const result = await executeAlertAckPlaybook({
        userId: "user-1",
        userEmail: null,
        eventId: 42,
        action: "webhook_ping",
      });

      expect(result).toEqual({ ok: false, message: "No outbound webhook configured." });
      expect(mockDeliverWebhookPost).not.toHaveBeenCalled();
      expect(mockAcknowledgeAlertEvent).not.toHaveBeenCalled();
    });

    it("posts without a signature header when there is no secret", async () => {
      mockGetAlertSettingsForUser.mockResolvedValue({
        outboundWebhookUrl: "https://hooks.example/incoming",
      });
      const { executeAlertAckPlaybook } = await import("./alertAckPlaybook");

      const result = await executeAlertAckPlaybook({
        userId: "user-1",
        userEmail: null,
        eventId: 42,
        action: "webhook_ping",
      });

      expect(mockDeliverWebhookPost).toHaveBeenCalledTimes(1);
      const [userId, type, url, headers, body] = mockDeliverWebhookPost.mock.calls[0]!;
      expect(userId).toBe("user-1");
      expect(type).toBe("outbound_alert");
      expect(url).toBe("https://hooks.example/incoming");
      expect(headers).toEqual({ "Content-Type": "application/json" });
      expect(JSON.parse(body)).toMatchObject({
        title: "ThermalTrace alert acknowledged",
        body: "Temp dropped below 32F",
        event_id: 42,
      });
      expect(mockAcknowledgeAlertEvent).toHaveBeenCalledWith("user-1", 42);
      expect(result).toEqual({ ok: true, message: "Alert handled: outbound webhook notified." });
    });

    it("signs the payload with HMAC-SHA256 when a secret is configured", async () => {
      mockGetAlertSettingsForUser.mockResolvedValue({
        outboundWebhookUrl: "https://hooks.example/incoming",
        outboundWebhookSecret: "shh-secret",
      });
      const { executeAlertAckPlaybook } = await import("./alertAckPlaybook");

      await executeAlertAckPlaybook({
        userId: "user-1",
        userEmail: null,
        eventId: 42,
        action: "webhook_ping",
      });

      const [, , , headers, body] = mockDeliverWebhookPost.mock.calls[0]!;
      expect(headers["X-Signature"]).toMatch(/^[0-9a-f]{64}$/);

      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode("shh-secret"),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const expectedSig = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(body),
      );
      const expectedHex = [...new Uint8Array(expectedSig)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      expect(headers["X-Signature"]).toBe(expectedHex);
    });
  });

  it("returns the acknowledge error instead of success when it fails", async () => {
    mockAcknowledgeAlertEvent.mockResolvedValue({ ok: false, error: "row locked" });
    const { executeAlertAckPlaybook } = await import("./alertAckPlaybook");

    const result = await executeAlertAckPlaybook({
      userId: "user-1",
      userEmail: null,
      eventId: 42,
      action: "ack",
    });

    expect(result).toEqual({ ok: false, message: "row locked" });
  });

  it("falls back to a generic ack-error message", async () => {
    mockAcknowledgeAlertEvent.mockResolvedValue({ ok: false });
    const { executeAlertAckPlaybook } = await import("./alertAckPlaybook");

    const result = await executeAlertAckPlaybook({
      userId: "user-1",
      userEmail: null,
      eventId: 42,
      action: "ack",
    });

    expect(result.message).toBe("Could not acknowledge alert.");
  });
});
