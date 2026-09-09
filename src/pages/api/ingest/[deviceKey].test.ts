import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockCheckIngestRateLimit = vi.fn();
const mockReadJsonBodyWithLimit = vi.fn();
vi.mock("../../../lib/ingestLimits", () => ({
  checkIngestRateLimit: (...a: unknown[]) => mockCheckIngestRateLimit(...a),
  readJsonBodyWithLimit: (...a: unknown[]) => mockReadJsonBodyWithLimit(...a),
}));

const mockFindDeviceByIngestKeyHash = vi.fn();
const mockTouchDeviceLastSeen = vi.fn();
const mockUpdateDeviceMeta = vi.fn();
const mockUpsertDeviceSensor = vi.fn();
const mockListHouseholdDevices = vi.fn();
vi.mock("../../../lib/devices", () => ({
  findDeviceByIngestKeyHash: (...a: unknown[]) => mockFindDeviceByIngestKeyHash(...a),
  touchDeviceLastSeen: (...a: unknown[]) => mockTouchDeviceLastSeen(...a),
  updateDeviceMeta: (...a: unknown[]) => mockUpdateDeviceMeta(...a),
  upsertDeviceSensor: (...a: unknown[]) => mockUpsertDeviceSensor(...a),
  listHouseholdDevices: (...a: unknown[]) => mockListHouseholdDevices(...a),
}));

const mockInsertSensorReadings = vi.fn();
const mockFetchLatestSensorValues = vi.fn();
vi.mock("../../../lib/sensorReadings", () => ({
  insertSensorReadings: (...a: unknown[]) => mockInsertSensorReadings(...a),
  fetchLatestSensorValues: (...a: unknown[]) => mockFetchLatestSensorValues(...a),
}));

const mockParseIngestPayload = vi.fn();
const mockInferSensorKind = vi.fn();
vi.mock("../../../lib/ingestPayload", () => ({
  parseIngestPayload: (...a: unknown[]) => mockParseIngestPayload(...a),
  inferSensorKind: (...a: unknown[]) => mockInferSensorKind(...a),
}));

const mockParseTempFeedPayload = vi.fn();
vi.mock("../../../lib/tempFeedConfig", () => ({
  parseTempFeedPayload: (...a: unknown[]) => mockParseTempFeedPayload(...a),
}));

const mockDiscoverIngestPayload = vi.fn();
vi.mock("../../../lib/feedDiscovery", () => ({
  discoverIngestPayload: (...a: unknown[]) => mockDiscoverIngestPayload(...a),
}));

const mockEnsureDiscoveredPushSensors = vi.fn();
const mockLabelForPushSensorKey = vi.fn();
vi.mock("../../../lib/pushSensorDiscovery", () => ({
  ensureDiscoveredPushSensors: (...a: unknown[]) => mockEnsureDiscoveredPushSensors(...a),
  labelForPushSensorKey: (...a: unknown[]) => mockLabelForPushSensorKey(...a),
}));

const mockRecordIngestStat = vi.fn();
vi.mock("../../../lib/ingestStats", () => ({
  recordIngestStat: (...a: unknown[]) => mockRecordIngestStat(...a),
}));

const mockEnrichDeviceMetaHistories = vi.fn();
vi.mock("../../../lib/rssiHistory", () => ({
  enrichDeviceMetaHistories: (...a: unknown[]) => mockEnrichDeviceMetaHistories(...a),
}));

const mockListHouseholdMembers = vi.fn();
vi.mock("../../../lib/households", () => ({
  listHouseholdMembers: (...a: unknown[]) => mockListHouseholdMembers(...a),
}));

const mockGetAlertSettingsForUser = vi.fn();
vi.mock("../../../lib/notify", () => ({
  getAlertSettingsForUser: (...a: unknown[]) => mockGetAlertSettingsForUser(...a),
}));

const mockSendReadingWebhook = vi.fn();
vi.mock("../../../lib/readingWebhook", () => ({
  sendReadingWebhook: (...a: unknown[]) => mockSendReadingWebhook(...a),
}));

const mockCreateAdminClient = vi.fn();
vi.mock("../../../lib/supabase", () => ({
  createAdminClient: () => mockCreateAdminClient(),
}));

vi.mock("../../../lib/alertNotifications", () => ({
  sendThresholdAlertsIfNeeded: vi.fn().mockResolvedValue(undefined),
  sendFloodAlertsIfNeeded: vi.fn().mockResolvedValue(undefined),
  maybeSendRuleAlerts: vi.fn().mockResolvedValue(undefined),
  buildAlertReadingsFromLatestSensors: vi.fn().mockReturnValue([]),
  buildFloodReadingsFromLatestSensors: vi.fn().mockReturnValue([]),
}));

function makeContext(options: {
  deviceKey?: string;
  headerKey?: string | null;
  body?: unknown;
} = {}): APIContext {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (options.headerKey !== null && options.headerKey !== undefined) {
    headers.set("X-Ingest-Key", options.headerKey);
  } else if (options.headerKey === undefined && !options.deviceKey) {
    headers.set("X-Ingest-Key", "good-key");
  }
  return {
    params: { deviceKey: options.deviceKey ?? "_" },
    request: new Request("https://example.com/api/ingest/_", {
      method: "POST",
      headers,
      body: JSON.stringify(options.body ?? { temp: { "0": { c: 5, f: 41, h: 40 } } }),
    }),
  } as unknown as APIContext;
}

const device = {
  id: "device-1",
  name: "Garage Pi",
  household_id: "house-1",
  sensors: [],
  meta: {},
};

beforeEach(() => {
  mockCheckIngestRateLimit.mockReset().mockReturnValue({ ok: true });
  mockReadJsonBodyWithLimit.mockReset().mockResolvedValue({
    ok: true,
    payload: { temp: { "0": { c: 5, f: 41, h: 40 } } },
  });
  mockFindDeviceByIngestKeyHash.mockReset().mockResolvedValue(device);
  mockDiscoverIngestPayload.mockReset().mockReturnValue({});
  mockEnsureDiscoveredPushSensors.mockReset().mockResolvedValue({
    created: 0,
    error: null,
  });
  mockParseIngestPayload.mockReset().mockReturnValue({
    tempProbes: { "0": { c: 5, f: 41, h: 40 } },
    typed: [],
  });
  mockParseTempFeedPayload.mockReset().mockReturnValue({});
  mockLabelForPushSensorKey.mockReset().mockReturnValue(null);
  mockUpsertDeviceSensor.mockReset().mockImplementation(
    async (_deviceId: string, key: string, _label: string, kind: string) => ({
      sensor: { id: `${kind}-${key}` },
      error: null,
    }),
  );
  mockInsertSensorReadings.mockReset().mockResolvedValue({ error: null });
  mockTouchDeviceLastSeen.mockReset().mockResolvedValue(undefined);
  mockUpdateDeviceMeta.mockReset().mockResolvedValue(undefined);
  mockRecordIngestStat.mockReset().mockResolvedValue(undefined);
  mockEnrichDeviceMetaHistories.mockReset().mockImplementation(
    (_meta: unknown, patch: Record<string, unknown>) => patch,
  );  mockListHouseholdMembers.mockReset().mockResolvedValue({ members: [] });
  mockListHouseholdDevices.mockReset().mockResolvedValue({ devices: [] });
  mockFetchLatestSensorValues.mockReset().mockResolvedValue([]);
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue({});
  mockSendReadingWebhook.mockReset().mockResolvedValue(undefined);
  mockCreateAdminClient.mockReset().mockReturnValue({
    auth: { admin: { getUserById: vi.fn().mockResolvedValue({ data: { user: null } }) } },
  });
});

describe("POST /api/ingest/[deviceKey]", () => {
  it("returns 400 when the device key is missing", async () => {
    const { POST } = await import("./[deviceKey]");

    const response = await POST(
      makeContext({ deviceKey: "_", headerKey: null }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing device key" });
  });

  it("returns 401 for an invalid device key", async () => {
    mockFindDeviceByIngestKeyHash.mockResolvedValue(null);
    const { POST } = await import("./[deviceKey]");

    const response = await POST(makeContext({ headerKey: "bad-key" }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid device key" });
  });

  it("returns 429 when rate limited", async () => {
    mockCheckIngestRateLimit.mockReturnValue({
      ok: false,
      error: "Too many requests",
      retryAfterSec: 5,
    });
    const { POST } = await import("./[deviceKey]");

    const response = await POST(makeContext());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("5");
  });

  it("ingests classic temp readings and returns a success summary", async () => {
    const { POST } = await import("./[deviceKey]");

    const response = await POST(makeContext({ headerKey: "good-key" }));
    const body = await response.json();

    expect(mockFindDeviceByIngestKeyHash).toHaveBeenCalled();
    expect(mockUpsertDeviceSensor).toHaveBeenCalled();
    expect(mockInsertSensorReadings).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          sensor_id: "temperature-0",
          household_id: "house-1",
          value_num: 41,
        }),
        expect.objectContaining({
          sensor_id: "humidity-0",
          value_num: 40,
        }),
      ]),
    );
    expect(mockTouchDeviceLastSeen).toHaveBeenCalledWith("device-1");
    expect(mockRecordIngestStat).toHaveBeenCalledWith("device-1", true);
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, readings: 2, sensors_created: 0 });
  });

  it("accepts the device key from the path when the header is absent", async () => {
    const { POST } = await import("./[deviceKey]");

    const response = await POST(
      makeContext({ deviceKey: "path-key", headerKey: null }),
    );

    expect(response.status).toBe(200);
    expect(mockFindDeviceByIngestKeyHash).toHaveBeenCalled();
  });
});
