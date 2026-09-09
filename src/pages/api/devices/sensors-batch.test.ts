import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockListHouseholdDevices = vi.fn();
const mockUpdateDeviceSensor = vi.fn();
vi.mock("../../../lib/devices", () => ({
  listHouseholdDevices: (...a: unknown[]) => mockListHouseholdDevices(...a),
  updateDeviceSensor: (...a: unknown[]) => mockUpdateDeviceSensor(...a),
}));

const mockRequireHouseholdEditor = vi.fn();
const mockHouseholdEditorCtx = vi.fn();
vi.mock("../../../lib/householdAuth", () => ({
  requireHouseholdEditor: (...a: unknown[]) => mockRequireHouseholdEditor(...a),
  householdEditorCtx: (...a: unknown[]) => mockHouseholdEditorCtx(...a),
}));

function makeContext(body: unknown): APIContext {
  const request = { json: async () => body } as unknown as Request;
  return { request, cookies: {} } as unknown as APIContext;
}

const sensor = { id: "s1", key: "temp", kind: "temperature", unit: "F", offset_num: 0 };

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({ user: { id: "user-1" } });
  mockRequireHouseholdEditor.mockReset().mockResolvedValue({ ok: true });
  mockHouseholdEditorCtx.mockReset().mockReturnValue({ householdId: "house-1" });
  mockListHouseholdDevices.mockReset().mockResolvedValue({
    devices: [{ id: "d1", sensors: [sensor] }],
  });
  mockUpdateDeviceSensor.mockReset().mockResolvedValue({ error: null });
});

describe("POST /api/devices/sensors-batch", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ user: null });
    const { POST } = await import("./sensors-batch");

    const response = await POST(makeContext({ sensors: [{ id: "s1", label: "New" }] }));

    expect(response.status).toBe(401);
  });

  it("returns 403 for a view-only user", async () => {
    mockRequireHouseholdEditor.mockResolvedValue({ ok: false });
    const { POST } = await import("./sensors-batch");

    const response = await POST(makeContext({ sensors: [{ id: "s1", label: "New" }] }));

    expect(response.status).toBe(403);
  });

  it("returns 400 when no sensors are provided", async () => {
    const { POST } = await import("./sensors-batch");

    const response = await POST(makeContext({ sensors: [] }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "No sensors provided." });
  });

  it("skips entries missing an id or label", async () => {
    const { POST } = await import("./sensors-batch");

    const response = await POST(
      makeContext({ sensors: [{ id: "", label: "New" }, { id: "s1", label: "" }] }),
    );

    expect(mockUpdateDeviceSensor).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("skips sensors that don't belong to the household", async () => {
    const { POST } = await import("./sensors-batch");

    await POST(makeContext({ sensors: [{ id: "unknown", label: "New" }] }));

    expect(mockUpdateDeviceSensor).not.toHaveBeenCalled();
  });

  it("updates matching sensors and returns ok", async () => {
    const { POST } = await import("./sensors-batch");

    const response = await POST(makeContext({ sensors: [{ id: "s1", label: "New label" }] }));

    expect(mockUpdateDeviceSensor).toHaveBeenCalledWith("s1", "d1", {
      key: "temp",
      label: "New label",
      kind: "temperature",
      unit: "F",
      offsetNum: 0,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("returns 500 when an update fails", async () => {
    mockUpdateDeviceSensor.mockResolvedValue({ error: "db error" });
    const { POST } = await import("./sensors-batch");

    const response = await POST(makeContext({ sensors: [{ id: "s1", label: "New label" }] }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ ok: false, error: "db error" });
  });
});
