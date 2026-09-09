import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockResolveInboundWebhook = vi.fn();
vi.mock("../../../lib/inboundWebhooks", () => ({
  resolveInboundWebhook: (...a: unknown[]) => mockResolveInboundWebhook(...a),
}));

const mockPickInboundSignatureHeader = vi.fn();
const mockVerifyInboundSignature = vi.fn();
vi.mock("../../../lib/inboundSigning", () => ({
  pickInboundSignatureHeader: (...a: unknown[]) => mockPickInboundSignatureHeader(...a),
  verifyInboundSignature: (...a: unknown[]) => mockVerifyInboundSignature(...a),
}));

const mockApplySnoozeForHouseholdMembers = vi.fn();
const mockApplyVacationForHouseholdMembers = vi.fn();
const mockClearSnoozeForHouseholdMembers = vi.fn();
const mockClearVacationForHouseholdMembers = vi.fn();
vi.mock("../../../lib/alertSnoozeTokens", () => ({
  applySnoozeForHouseholdMembers: (...a: unknown[]) => mockApplySnoozeForHouseholdMembers(...a),
  applyVacationForHouseholdMembers: (...a: unknown[]) => mockApplyVacationForHouseholdMembers(...a),
  clearSnoozeForHouseholdMembers: (...a: unknown[]) => mockClearSnoozeForHouseholdMembers(...a),
  clearVacationForHouseholdMembers: (...a: unknown[]) => mockClearVacationForHouseholdMembers(...a),
}));

const mockListHouseholdDevices = vi.fn();
vi.mock("../../../lib/devices", () => ({
  listHouseholdDevices: (...a: unknown[]) => mockListHouseholdDevices(...a),
}));

const mockFetchLatestSensorValues = vi.fn();
vi.mock("../../../lib/sensorReadings", () => ({
  fetchLatestSensorValues: (...a: unknown[]) => mockFetchLatestSensorValues(...a),
}));

const mockRecordHouseholdActivity = vi.fn();
vi.mock("../../../lib/householdActivity", () => ({
  recordHouseholdActivity: (...a: unknown[]) => mockRecordHouseholdActivity(...a),
}));

function makeContext(options: {
  token?: string;
  body?: string;
  search?: string;
} = {}): APIContext {
  const { token = "tok", body = "", search = "" } = options;
  const request = {
    text: async () => body,
    headers: new Headers(),
    url: `https://example.com/api/inbound/${token}${search}`,
  } as unknown as Request;
  return { params: { token }, request } as unknown as APIContext;
}

beforeEach(() => {
  mockResolveInboundWebhook.mockReset().mockResolvedValue({
    householdId: "house-1",
    signingSecret: "secret",
  });
  mockPickInboundSignatureHeader.mockReset().mockReturnValue("sig-header");
  mockVerifyInboundSignature.mockReset().mockResolvedValue(true);
  mockApplySnoozeForHouseholdMembers.mockReset().mockResolvedValue(2);
  mockApplyVacationForHouseholdMembers.mockReset().mockResolvedValue(2);
  mockClearSnoozeForHouseholdMembers.mockReset().mockResolvedValue(2);
  mockClearVacationForHouseholdMembers.mockReset().mockResolvedValue(2);
  mockListHouseholdDevices.mockReset().mockResolvedValue({ devices: [{ id: "d1" }] });
  mockFetchLatestSensorValues.mockReset().mockResolvedValue([]);
  mockRecordHouseholdActivity.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/inbound/[token]", () => {
  it("returns 400 when the token is missing", async () => {
    const { POST } = await import("./[token]");

    const response = await POST(makeContext({ token: "   " }));

    expect(response.status).toBe(400);
  });

  it("returns 401 when the webhook can't be resolved", async () => {
    mockResolveInboundWebhook.mockResolvedValue(null);
    const { POST } = await import("./[token]");

    const response = await POST(makeContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid webhook" });
  });

  it("returns 401 when the signature is invalid", async () => {
    mockVerifyInboundSignature.mockResolvedValue(false);
    const { POST } = await import("./[token]");

    const response = await POST(makeContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid signature" });
  });

  it("applies a snooze and records activity", async () => {
    const { POST } = await import("./[token]");
    const context = makeContext({ body: JSON.stringify({ action: "snooze", hours: 12 }) });

    const response = await POST(context);
    const json = await response.json();

    expect(mockApplySnoozeForHouseholdMembers).toHaveBeenCalledWith("house-1", 12);
    expect(mockRecordHouseholdActivity).toHaveBeenCalledWith({
      householdId: "house-1",
      action: "inbound_snooze",
      detail: "12h",
    });
    expect(json).toEqual({ ok: true, action: "snooze", members: 2 });
  });

  it("defaults snooze hours to 24 when invalid", async () => {
    const { POST } = await import("./[token]");
    const context = makeContext({ body: JSON.stringify({ action: "snooze", hours: "abc" }) });

    await POST(context);

    expect(mockApplySnoozeForHouseholdMembers).toHaveBeenCalledWith("house-1", 24);
  });

  it("applies vacation mode", async () => {
    const { POST } = await import("./[token]");
    const context = makeContext({ body: JSON.stringify({ action: "vacation", days: 5 }) });

    const json = await (await POST(context)).json();

    expect(mockApplyVacationForHouseholdMembers).toHaveBeenCalledWith("house-1", 5);
    expect(json).toEqual({ ok: true, action: "vacation", members: 2 });
  });

  it("clears snooze", async () => {
    const { POST } = await import("./[token]");
    const context = makeContext({ body: JSON.stringify({ action: "clear_snooze" }) });

    const json = await (await POST(context)).json();

    expect(mockClearSnoozeForHouseholdMembers).toHaveBeenCalledWith("house-1");
    expect(json).toEqual({ ok: true, action: "clear_snooze", members: 2 });
  });

  it("clears vacation", async () => {
    const { POST } = await import("./[token]");
    const context = makeContext({ body: JSON.stringify({ action: "clear_vacation" }) });

    const json = await (await POST(context)).json();

    expect(mockClearVacationForHouseholdMembers).toHaveBeenCalledWith("house-1");
    expect(json).toEqual({ ok: true, action: "clear_vacation", members: 2 });
  });

  it("returns a status summary limited to temperature sensors", async () => {
    mockFetchLatestSensorValues.mockResolvedValue([
      { sensor: { kind: "temperature", label: "Garage", unit: "F" }, value_num: 40, recorded_at: "2024-01-01" },
      { sensor: { kind: "humidity", label: "Garage", unit: "%" }, value_num: 55, recorded_at: "2024-01-01" },
    ]);
    const { POST } = await import("./[token]");
    const context = makeContext({ body: JSON.stringify({ action: "status" }) });

    const json = (await (await POST(context)).json()) as Record<string, unknown>;

    expect(json).toMatchObject({ ok: true, action: "status", deviceCount: 1, sensorCount: 2 });
    expect(json.temperatures).toEqual([
      { label: "Garage", value: 40, unit: "F", recorded_at: "2024-01-01" },
    ]);
  });

  it("reads the action from the query string when the JSON body has none", async () => {
    const { POST } = await import("./[token]");
    const context = makeContext({ body: "", search: "?action=clear_snooze" });

    await POST(context);

    expect(mockClearSnoozeForHouseholdMembers).toHaveBeenCalled();
  });

  it("returns a help message for an unrecognized action", async () => {
    const { POST } = await import("./[token]");
    const context = makeContext({ body: JSON.stringify({ action: "bogus" }) });

    const json = (await (await POST(context)).json()) as Record<string, unknown>;

    expect(json.ok).toBe(true);
    expect(json.message).toContain("Use action=");
  });
});
