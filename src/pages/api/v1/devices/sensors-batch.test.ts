import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockResolveApiKey = vi.fn();
vi.mock("../../../../lib/apiKeys", () => ({
  resolveApiKey: (...a: unknown[]) => mockResolveApiKey(...a),
}));

const mockListHouseholdDevices = vi.fn();
const mockUpdateDeviceSensor = vi.fn();
vi.mock("../../../../lib/devices", () => ({
  listHouseholdDevices: (...a: unknown[]) => mockListHouseholdDevices(...a),
  updateDeviceSensor: (...a: unknown[]) => mockUpdateDeviceSensor(...a),
}));

function makeContext(body: unknown, auth: string | null = "Bearer good-key"): APIContext {
  const headers = new Headers();
  if (auth) headers.set("Authorization", auth);
  return {
    request: new Request("https://example.com/api/v1/devices/sensors-batch", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
  } as unknown as APIContext;
}

const sensor = {
  id: "s1",
  key: "temp",
  label: "Old",
  kind: "temperature",
  unit: "F",
  offset_num: 0,
  visible: true,
};

beforeEach(() => {
  mockResolveApiKey.mockReset().mockResolvedValue({ householdId: "house-1" });
  mockListHouseholdDevices.mockReset().mockResolvedValue({
    devices: [{ id: "d1", sensors: [sensor] }],
  });
  mockUpdateDeviceSensor.mockReset().mockResolvedValue({ error: null });
});

describe("POST /api/v1/devices/sensors-batch", () => {
  it("returns 401 without an Authorization header", async () => {
    const { POST } = await import("./sensors-batch");

    const response = await POST(makeContext({ sensors: [{ id: "s1", label: "New" }] }, null));

    expect(response.status).toBe(401);
  });

  it("returns 401 for an invalid API key", async () => {
    mockResolveApiKey.mockResolvedValue(null);
    const { POST } = await import("./sensors-batch");

    const response = await POST(makeContext({ sensors: [{ id: "s1", label: "New" }] }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, error: "Invalid API key" });
  });

  it("returns 400 when no sensors are provided", async () => {
    const { POST } = await import("./sensors-batch");

    const response = await POST(makeContext({ sensors: [] }));

    expect(response.status).toBe(400);
  });

  it("updates matching sensors including visibility", async () => {
    const { POST } = await import("./sensors-batch");

    const response = await POST(
      makeContext({ sensors: [{ id: "s1", label: "New label", visible: false }] }),
    );

    expect(mockUpdateDeviceSensor).toHaveBeenCalledWith("s1", "d1", {
      key: "temp",
      label: "New label",
      kind: "temperature",
      unit: "F",
      offsetNum: 0,
      visible: false,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("keeps the existing label when only visibility is sent", async () => {
    const { POST } = await import("./sensors-batch");

    await POST(makeContext({ sensors: [{ id: "s1", visible: false }] }));

    expect(mockUpdateDeviceSensor).toHaveBeenCalledWith(
      "s1",
      "d1",
      expect.objectContaining({ label: "Old", visible: false }),
    );
  });

  it("returns 500 when an update fails", async () => {
    mockUpdateDeviceSensor.mockResolvedValue({ error: "db error" });
    const { POST } = await import("./sensors-batch");

    const response = await POST(makeContext({ sensors: [{ id: "s1", label: "New" }] }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "db error" });
  });
});
