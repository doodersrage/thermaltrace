import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
}));

const mockGetOrCreateHouseholdForUser = vi.fn();
const mockIsUserInHousehold = vi.fn();
vi.mock("../../../lib/households", () => ({
  getOrCreateHouseholdForUser: (...a: unknown[]) => mockGetOrCreateHouseholdForUser(...a),
  isUserInHousehold: (...a: unknown[]) => mockIsUserInHousehold(...a),
}));

const mockCreatePushDevice = vi.fn();
const mockDeleteDeviceSensor = vi.fn();
const mockDefaultUnitForKind = vi.fn();
const mockIsSensorKind = vi.fn();
const mockListHouseholdDevices = vi.fn();
const mockRenamePushDevice = vi.fn();
const mockRotatePushDeviceKey = vi.fn();
const mockTransferDeviceToHousehold = vi.fn();
const mockUpdateDeviceSensor = vi.fn();
const mockUpdateDeviceSpace = vi.fn();
vi.mock("../../../lib/devices", () => ({
  createPushDevice: (...a: unknown[]) => mockCreatePushDevice(...a),
  deleteDeviceSensor: (...a: unknown[]) => mockDeleteDeviceSensor(...a),
  defaultUnitForKind: (...a: unknown[]) => mockDefaultUnitForKind(...a),
  isSensorKind: (...a: unknown[]) => mockIsSensorKind(...a),
  listHouseholdDevices: (...a: unknown[]) => mockListHouseholdDevices(...a),
  renamePushDevice: (...a: unknown[]) => mockRenamePushDevice(...a),
  rotatePushDeviceKey: (...a: unknown[]) => mockRotatePushDeviceKey(...a),
  transferDeviceToHousehold: (...a: unknown[]) => mockTransferDeviceToHousehold(...a),
  updateDeviceSensor: (...a: unknown[]) => mockUpdateDeviceSensor(...a),
  updateDeviceSpace: (...a: unknown[]) => mockUpdateDeviceSpace(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("../../../lib/entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

function mockQuery(result: { data?: unknown; error?: unknown } = { data: null, error: null }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["delete", "eq", "insert", "select"]) {
    builder[method] = vi.fn(() => builder);
  }
  (builder as { then: unknown }).then = (resolve: (v: unknown) => unknown, reject: (v: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

const mockFrom = vi.fn();
const mockCreateServerClient = vi.fn(() => ({ from: mockFrom }));
vi.mock("../../../lib/supabase", () => ({
  createServerClient: () => mockCreateServerClient(),
}));

const mockRequireHouseholdEditor = vi.fn();
const mockRedirectUnlessEditor = vi.fn();
const mockHouseholdEditorCtx = vi.fn();
vi.mock("../../../lib/householdAuth", () => ({
  requireHouseholdEditor: (...a: unknown[]) => mockRequireHouseholdEditor(...a),
  redirectUnlessEditor: (...a: unknown[]) => mockRedirectUnlessEditor(...a),
  householdEditorCtx: (...a: unknown[]) => mockHouseholdEditorCtx(...a),
}));

const mockRecordHouseholdActivity = vi.fn();
vi.mock("../../../lib/householdActivity", () => ({
  recordHouseholdActivity: (...a: unknown[]) => mockRecordHouseholdActivity(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

const mockSetSecretFlash = vi.fn();
vi.mock("../../../lib/secretFlash", () => ({
  FLASH_INGEST_KEY: "ingest_key",
  setSecretFlash: (...a: unknown[]) => mockSetSecretFlash(...a),
}));

const mockPersistEncryptedIngestKey = vi.fn();
vi.mock("../../../lib/persistIngestKey", () => ({
  persistEncryptedIngestKey: (...a: unknown[]) => mockPersistEncryptedIngestKey(...a),
}));

function makeContext(form: Record<string, string>): APIContext {
  const formData = new FormData();
  for (const [k, v] of Object.entries(form)) formData.set(k, v);
  const request = { formData: async () => formData } as unknown as Request;
  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));
  return { request, cookies: {}, redirect } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({
    user: { id: "user-1", email: "user@example.com" },
  });
  mockGetOrCreateHouseholdForUser.mockReset().mockResolvedValue({ householdId: "house-1" });
  mockIsUserInHousehold.mockReset().mockResolvedValue(true);
  mockCreatePushDevice.mockReset().mockResolvedValue({
    device: { id: "new-device" },
    error: null,
  });
  mockDeleteDeviceSensor.mockReset().mockResolvedValue(undefined);
  mockDefaultUnitForKind.mockReset().mockReturnValue("F");
  mockIsSensorKind.mockReset().mockReturnValue(true);
  mockListHouseholdDevices.mockReset().mockResolvedValue({
    devices: [{ id: "d1", source: "push" }],
  });
  mockRenamePushDevice.mockReset().mockResolvedValue({ error: null });
  mockRotatePushDeviceKey.mockReset().mockResolvedValue({ error: null });
  mockTransferDeviceToHousehold.mockReset().mockResolvedValue({ error: null });
  mockUpdateDeviceSensor.mockReset().mockResolvedValue({ error: null });
  mockUpdateDeviceSpace.mockReset().mockResolvedValue({ error: null });
  mockGetUserEntitlements.mockReset().mockResolvedValue({ maxDevices: 5 });
  mockFrom.mockReset().mockImplementation(() => mockQuery());
  mockCreateServerClient.mockClear();
  mockRequireHouseholdEditor.mockReset().mockResolvedValue({ ok: true });
  mockRedirectUnlessEditor.mockReset().mockReturnValue(null);
  mockHouseholdEditorCtx.mockReset().mockReturnValue({ householdId: "house-1" });
  mockRecordHouseholdActivity.mockReset().mockResolvedValue(undefined);
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/temperature");
  mockSetSecretFlash.mockReset();
  mockPersistEncryptedIngestKey.mockReset().mockResolvedValue(undefined);
});

describe("POST /api/devices", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ user: null });
    const { POST } = await import("./index");
    const context = makeContext({ action: "create_push" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
  });

  it("returns the editor block response for a view-only user", async () => {
    const blockedResponse = new Response(null, { status: 302, headers: { Location: "/blocked" } });
    mockRedirectUnlessEditor.mockReturnValue(blockedResponse);
    const { POST } = await import("./index");
    const context = makeContext({ action: "create_push" });

    const response = await POST(context);

    expect(response).toBe(blockedResponse);
  });

  it("redirects with an error when the household can't be resolved", async () => {
    mockGetOrCreateHouseholdForUser.mockResolvedValue({ householdId: null });
    const { POST } = await import("./index");
    const context = makeContext({ action: "create_push" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?error=1");
  });

  it("transfers a device between households", async () => {
    const { POST } = await import("./index");
    const context = makeContext({
      action: "transfer",
      device_id: "d1",
      target_household_id: "house-2",
    });

    await POST(context);

    expect(mockTransferDeviceToHousehold).toHaveBeenCalledWith("d1", "house-1", "house-2");
    expect(mockRecordHouseholdActivity).toHaveBeenCalledWith({
      householdId: "house-1",
      userId: "user-1",
      action: "device_transfer",
      detail: "d1 → house-2",
    });
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?device_transferred=1");
  });

  it("rejects a transfer when required fields are missing", async () => {
    const { POST } = await import("./index");
    const context = makeContext({ action: "transfer", device_id: "d1" });

    await POST(context);

    expect(mockTransferDeviceToHousehold).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?error=1");
  });

  it("redirects with an error when transfer fails", async () => {
    mockTransferDeviceToHousehold.mockResolvedValue({ error: "boom" });
    const { POST } = await import("./index");
    const context = makeContext({
      action: "transfer",
      device_id: "d1",
      target_household_id: "house-2",
    });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?error=1");
  });

  it("blocks a transfer to a household the user doesn't belong to", async () => {
    mockIsUserInHousehold.mockResolvedValue(false);
    const { POST } = await import("./index");
    const context = makeContext({
      action: "transfer",
      device_id: "d1",
      target_household_id: "house-2",
    });

    await POST(context);

    expect(mockTransferDeviceToHousehold).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?error=1");
  });

  it("deletes a device", async () => {
    const { POST } = await import("./index");
    const context = makeContext({ action: "delete", device_id: "d1" });

    await POST(context);

    expect(mockFrom).toHaveBeenCalledWith("devices");
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?device_deleted=1");
  });

  it("renames a device", async () => {
    const { POST } = await import("./index");
    const context = makeContext({ action: "rename", device_id: "d1", name: "New name" });

    await POST(context);

    expect(mockRenamePushDevice).toHaveBeenCalledWith("house-1", "d1", "New name");
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?device_renamed=1");
  });

  it("redirects with an error when rename fails", async () => {
    mockRenamePushDevice.mockResolvedValue({ error: "boom" });
    const { POST } = await import("./index");
    const context = makeContext({ action: "rename", device_id: "d1", name: "New name" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?error=1");
  });

  it("sets a device's space", async () => {
    const { POST } = await import("./index");
    const context = makeContext({ action: "set_space", device_id: "d1", space: "Garage" });

    await POST(context);

    expect(mockUpdateDeviceSpace).toHaveBeenCalledWith("house-1", "d1", "Garage");
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?device_renamed=1");
  });

  it("rotates a device's ingest key and stashes the flash secret", async () => {
    const { POST } = await import("./index");
    const context = makeContext({ action: "rotate_key", device_id: "d1" });

    await POST(context);

    expect(mockRotatePushDeviceKey).toHaveBeenCalledWith(
      "house-1",
      "d1",
      expect.any(String),
      expect.any(String),
    );
    expect(mockSetSecretFlash).toHaveBeenCalledWith(context.cookies, "ingest_key", expect.any(String));
    expect(mockPersistEncryptedIngestKey).toHaveBeenCalledWith("d1", expect.any(String));
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?key_rotated=1");
  });

  it("redirects with an error when key rotation fails", async () => {
    mockRotatePushDeviceKey.mockResolvedValue({ error: "boom" });
    const { POST } = await import("./index");
    const context = makeContext({ action: "rotate_key", device_id: "d1" });

    await POST(context);

    expect(mockSetSecretFlash).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?error=1");
  });

  it("rejects adding a sensor without required fields", async () => {
    const { POST } = await import("./index");
    const context = makeContext({ action: "add_sensor", device_id: "d1", key: "temp" });

    await POST(context);

    expect(mockFrom).not.toHaveBeenCalledWith("device_sensors");
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?error=1");
  });

  it("adds a sensor to an owned device", async () => {
    const { POST } = await import("./index");
    const context = makeContext({
      action: "add_sensor",
      device_id: "d1",
      key: "temp",
      label: "Garage",
      kind: "temperature",
    });

    await POST(context);

    expect(mockFrom).toHaveBeenCalledWith("device_sensors");
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?sensor_added=1");
  });

  it("rejects adding a sensor to a device the household doesn't own", async () => {
    mockListHouseholdDevices.mockResolvedValue({ devices: [{ id: "other-device", source: "push" }] });
    const { POST } = await import("./index");
    const context = makeContext({
      action: "add_sensor",
      device_id: "d1",
      key: "temp",
      label: "Garage",
    });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?error=1");
  });

  it("adds a temperature/humidity sensor pair", async () => {
    const { POST } = await import("./index");
    const context = makeContext({ action: "add_sensor_pair", device_id: "d1", key: "temp" });

    await POST(context);

    expect(mockFrom).toHaveBeenCalledWith("device_sensors");
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?sensor_added=1");
  });

  it("returns an error when adding a sensor pair fails", async () => {
    mockFrom.mockImplementation(() => mockQuery({ error: "db error" }));
    const { POST } = await import("./index");
    const context = makeContext({ action: "add_sensor_pair", device_id: "d1", key: "temp" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?error=1");
  });

  it("updates a sensor", async () => {
    const { POST } = await import("./index");
    const context = makeContext({
      action: "update_sensor",
      sensor_id: "s1",
      device_id: "d1",
      key: "temp",
      label: "Garage",
      offset_num: "1.5",
      visible: "on",
    });

    await POST(context);

    expect(mockUpdateDeviceSensor).toHaveBeenCalledWith("s1", "d1", {
      key: "temp",
      label: "Garage",
      kind: "generic",
      unit: "F",
      offsetNum: 1.5,
      visible: true,
    });
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?sensor_updated=1");
  });

  it("redirects with an error when sensor update fails", async () => {
    mockUpdateDeviceSensor.mockResolvedValue({ error: "boom" });
    const { POST } = await import("./index");
    const context = makeContext({
      action: "update_sensor",
      sensor_id: "s1",
      device_id: "d1",
      key: "temp",
      label: "Garage",
    });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?error=1");
  });

  it("rejects deleting a sensor from a device the household doesn't own", async () => {
    mockListHouseholdDevices.mockResolvedValue({ devices: [{ id: "other", source: "push" }] });
    const { POST } = await import("./index");
    const context = makeContext({ action: "delete_sensor", sensor_id: "s1", device_id: "d1" });

    await POST(context);

    expect(mockDeleteDeviceSensor).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?error=1");
  });

  it("deletes a sensor from an owned device", async () => {
    const { POST } = await import("./index");
    const context = makeContext({ action: "delete_sensor", sensor_id: "s1", device_id: "d1" });

    await POST(context);

    expect(mockDeleteDeviceSensor).toHaveBeenCalledWith("s1", "d1");
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?sensor_deleted=1");
  });

  it("blocks device creation past the plan's device limit", async () => {
    mockGetUserEntitlements.mockResolvedValue({ maxDevices: 1 });
    const { POST } = await import("./index");
    const context = makeContext({ action: "create_push", name: "New probe" });

    await POST(context);

    expect(mockCreatePushDevice).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?error=device_limit");
  });

  it("creates a push device and stashes the flash secret", async () => {
    const { POST } = await import("./index");
    const context = makeContext({ action: "create_push", name: "New probe" });

    await POST(context);

    expect(mockCreatePushDevice).toHaveBeenCalledWith(
      "house-1",
      "New probe",
      expect.any(String),
      expect.any(String),
    );
    expect(mockSetSecretFlash).toHaveBeenCalledWith(context.cookies, "ingest_key", expect.any(String));
    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/temperature?device_created=1&focus_device=new-device",
    );
  });

  it("redirects with an error when device creation fails", async () => {
    mockCreatePushDevice.mockResolvedValue({ device: null, error: "boom" });
    const { POST } = await import("./index");
    const context = makeContext({ action: "create_push", name: "New probe" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/temperature?error=1");
  });
});
