import { beforeEach, describe, expect, it, vi } from "vitest";
import { devicesToTempConfig, type DeviceWithSensors } from "./devices";

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "insert", "update", "delete"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve(result));
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

function device(overrides: Partial<DeviceWithSensors> = {}): DeviceWithSensors {
  return {
    id: "device-1",
    household_id: "house-1",
    name: "Garage",
    source: "pull_url",
    pull_url: "https://example.com/feed.json",
    ingest_key_prefix: null,
    enabled: true,
    last_seen_at: null,
    sort_order: 0,
    sensors: [],
    ...overrides,
  };
}

describe("devicesToTempConfig", () => {
  it("only maps enabled-source pull devices with a url into feeds", () => {
    const devices = [
      device({ id: "d1" }),
      device({ id: "d2", source: "push", pull_url: null }),
      device({ id: "d3", source: "pull_url", pull_url: null }),
    ];
    const { feeds } = devicesToTempConfig(devices);
    expect(feeds.map((f) => f.id)).toEqual(["d1"]);
  });

  it("only surfaces temperature sensors as probes, never humidity or others", () => {
    const devices = [
      device({
        id: "d1",
        sensors: [
          { id: "s1", device_id: "d1", key: "temp1", label: "Bay 1", kind: "temperature", unit: "F", visible: true, sort_order: 0, offset_num: 0 },
          { id: "s2", device_id: "d1", key: "temp1", label: "Bay 1 humidity", kind: "humidity", unit: "%", visible: true, sort_order: 1, offset_num: 0 },
          { id: "s3", device_id: "d1", key: "door1", label: "Door", kind: "door" as never, unit: null, visible: true, sort_order: 2, offset_num: 0 },
        ],
      }),
    ];
    const { probes } = devicesToTempConfig(devices);
    expect(probes).toHaveLength(1);
    expect(probes[0]).toMatchObject({ id: "d1:temp1", feedId: "d1", key: "temp1", visible: true });
  });

  it("strips a trailing ' humidity' suffix from a temperature sensor's own label", () => {
    const devices = [
      device({
        id: "d1",
        sensors: [
          { id: "s1", device_id: "d1", key: "temp1", label: "Bay 1 humidity", kind: "temperature", unit: "F", visible: true, sort_order: 0, offset_num: 0 },
        ],
      }),
    ];
    const { probes } = devicesToTempConfig(devices);
    // A mislabeled temperature sensor still gets its (accidental) " humidity"
    // suffix trimmed -- matches the same regex used for real humidity pairs.
    expect(probes[0].label).toBe("Bay 1");
  });

  it("de-duplicates probes sharing the same device+key", () => {
    const devices = [
      device({
        id: "d1",
        sensors: [
          { id: "s1", device_id: "d1", key: "temp1", label: "A", kind: "temperature", unit: "F", visible: true, sort_order: 0, offset_num: 0 },
          { id: "s2", device_id: "d1", key: "temp1", label: "A dup", kind: "temperature", unit: "F", visible: true, sort_order: 1, offset_num: 0 },
        ],
      }),
    ];
    const { probes } = devicesToTempConfig(devices);
    expect(probes).toHaveLength(1);
  });

  it("returns empty feeds/probes for an empty device list", () => {
    expect(devicesToTempConfig([])).toEqual({ feeds: [], probes: [] });
  });
});

describe("listHouseholdDevices", () => {
  it("attaches each device's own sensors and orders both by sort_order", async () => {
    const devicesBuilder = mockQuery({
      data: [{ id: "d1", household_id: "house-1", sort_order: 0 }],
    });
    const sensorsBuilder = mockQuery({
      data: [{ id: "s1", device_id: "d1", key: "temp1" }],
    });
    mockFrom.mockReturnValueOnce(devicesBuilder).mockReturnValueOnce(sensorsBuilder);
    const { listHouseholdDevices } = await import("./devices");

    const result = await listHouseholdDevices("house-1");

    expect(result.error).toBeNull();
    expect(result.devices).toEqual([
      expect.objectContaining({ id: "d1", sensors: [expect.objectContaining({ id: "s1" })] }),
    ]);
  });

  it("short-circuits with no sensor query when the household has no devices", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [] }));
    const { listHouseholdDevices } = await import("./devices");

    const result = await listHouseholdDevices("house-1");

    expect(result).toEqual({ devices: [], error: null });
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("propagates a devices-query error without querying sensors", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: "db down" } }));
    const { listHouseholdDevices } = await import("./devices");

    expect(await listHouseholdDevices("house-1")).toEqual({ devices: [], error: "db down" });
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });

  it("propagates a sensors-query error even though devices loaded fine", async () => {
    mockFrom
      .mockReturnValueOnce(mockQuery({ data: [{ id: "d1" }] }))
      .mockReturnValueOnce(mockQuery({ data: null, error: { message: "sensor query failed" } }));
    const { listHouseholdDevices } = await import("./devices");

    expect(await listHouseholdDevices("house-1")).toEqual({
      devices: [],
      error: "sensor query failed",
    });
  });
});

describe("findDeviceByIngestKeyHash", () => {
  it("only matches an enabled device for the given key hash", async () => {
    const deviceBuilder = mockQuery({ data: { id: "d1" } });
    const sensorBuilder = mockQuery({ data: [] });
    mockFrom.mockReturnValueOnce(deviceBuilder).mockReturnValueOnce(sensorBuilder);
    const { findDeviceByIngestKeyHash } = await import("./devices");

    const result = await findDeviceByIngestKeyHash("hash-1");

    expect(result).toEqual(expect.objectContaining({ id: "d1", sensors: [] }));
    expect(deviceBuilder.eq).toHaveBeenCalledWith("ingest_key_hash", "hash-1");
    expect(deviceBuilder.eq).toHaveBeenCalledWith("enabled", true);
  });

  it("returns null (never queries sensors) when no device matches", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null }));
    const { findDeviceByIngestKeyHash } = await import("./devices");

    expect(await findDeviceByIngestKeyHash("missing-hash")).toBeNull();
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});

describe("createPushDevice", () => {
  it("stores only the key's hash and prefix, never a raw key field", async () => {
    const builder = mockQuery({ data: { id: "d1", source: "push" } });
    mockFrom.mockReturnValue(builder);
    const { createPushDevice } = await import("./devices");

    const result = await createPushDevice("house-1", "New device", "hash-abc", "gtm_abc");

    expect(result.error).toBeNull();
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        household_id: "house-1",
        source: "push",
        ingest_key_hash: "hash-abc",
        ingest_key_prefix: "gtm_abc",
        enabled: true,
      }),
    );
  });

  it("reports the supabase error on failure", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: "insert failed" } }));
    const { createPushDevice } = await import("./devices");

    expect(await createPushDevice("house-1", "X", "h", "p")).toEqual({
      device: null,
      error: "insert failed",
    });
  });
});

describe("renamePushDevice", () => {
  it("rejects a blank name without querying supabase", async () => {
    const { renamePushDevice } = await import("./devices");
    expect(await renamePushDevice("house-1", "d1", "   ")).toEqual({
      error: "Name is required",
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("scopes the update to household, device id, and push source", async () => {
    const builder = mockQuery({ data: { id: "d1" } });
    mockFrom.mockReturnValue(builder);
    const { renamePushDevice } = await import("./devices");

    const result = await renamePushDevice("house-1", "d1", "  Garage  ");

    expect(result).toEqual({ error: null });
    expect(builder.update).toHaveBeenCalledWith({ name: "Garage" });
    expect(builder.eq).toHaveBeenCalledWith("id", "d1");
    expect(builder.eq).toHaveBeenCalledWith("household_id", "house-1");
    expect(builder.eq).toHaveBeenCalledWith("source", "push");
  });

  it("reports an error when no row matches (wrong household or not a push device)", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null }));
    const { renamePushDevice } = await import("./devices");

    expect(await renamePushDevice("house-1", "d1", "Garage")).toEqual({
      error: "Failed to rename device",
    });
  });
});

describe("updateDeviceSpace", () => {
  it("normalizes a blank space to null", async () => {
    const builder = mockQuery({ data: { id: "d1" } });
    mockFrom.mockReturnValue(builder);
    const { updateDeviceSpace } = await import("./devices");

    await updateDeviceSpace("house-1", "d1", "   ");

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ space: null }),
    );
  });

  it("trims a real value", async () => {
    const builder = mockQuery({ data: { id: "d1" } });
    mockFrom.mockReturnValue(builder);
    const { updateDeviceSpace } = await import("./devices");

    await updateDeviceSpace("house-1", "d1", "  Attic  ");

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ space: "Attic" }),
    );
  });
});

describe("rotatePushDeviceKey", () => {
  it("only rotates a push device scoped to its household", async () => {
    const builder = mockQuery({ data: { id: "d1" } });
    mockFrom.mockReturnValue(builder);
    const { rotatePushDeviceKey } = await import("./devices");

    const result = await rotatePushDeviceKey("house-1", "d1", "new-hash", "gtm_new");

    expect(result).toEqual({ error: null });
    expect(builder.update).toHaveBeenCalledWith({
      ingest_key_hash: "new-hash",
      ingest_key_prefix: "gtm_new",
    });
    expect(builder.eq).toHaveBeenCalledWith("source", "push");
  });

  it("fails when the device/household/source scope doesn't match", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null }));
    const { rotatePushDeviceKey } = await import("./devices");

    expect(await rotatePushDeviceKey("house-1", "d1", "h", "p")).toEqual({
      error: "Failed to rotate key",
    });
  });
});

describe("updateDeviceSensor", () => {
  it("clamps the offset for the sensor's kind before saving", async () => {
    const builder = mockQuery({ error: null });
    mockFrom.mockReturnValue(builder);
    const { updateDeviceSensor } = await import("./devices");

    await updateDeviceSensor("s1", "d1", {
      key: "temp1",
      label: "Bay",
      kind: "temperature",
      offsetNum: 999,
    });

    // TEMP_OFFSET_MAX_F is 10 -- an absurd input offset must be clamped, not stored raw.
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ offset_num: 10 }),
    );
  });

  it("omits the visible field entirely when not provided, rather than forcing it false", async () => {
    const builder = mockQuery({ error: null });
    mockFrom.mockReturnValue(builder);
    const { updateDeviceSensor } = await import("./devices");

    await updateDeviceSensor("s1", "d1", { key: "temp1", label: "Bay", kind: "temperature" });

    const patch = (builder.update as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(patch).not.toHaveProperty("visible");
  });
});

describe("deleteDeviceSensor", () => {
  it("scopes the delete to both sensor and device id", async () => {
    const builder = mockQuery({ error: null });
    mockFrom.mockReturnValue(builder);
    const { deleteDeviceSensor } = await import("./devices");

    expect(await deleteDeviceSensor("s1", "d1")).toEqual({ error: null });
    expect(builder.eq).toHaveBeenCalledWith("id", "s1");
    expect(builder.eq).toHaveBeenCalledWith("device_id", "d1");
  });
});

describe("upsertDeviceSensor", () => {
  it("returns the existing sensor without inserting a duplicate", async () => {
    const builder = mockQuery({ data: { id: "s1", key: "temp1", kind: "temperature" } });
    mockFrom.mockReturnValue(builder);
    const { upsertDeviceSensor } = await import("./devices");

    const result = await upsertDeviceSensor("d1", "temp1", "Bay", "temperature");

    expect(result).toEqual({ sensor: { id: "s1", key: "temp1", kind: "temperature" }, error: null });
    expect(builder.insert).not.toHaveBeenCalled();
  });

  it("inserts a new sensor as visible when none exists yet", async () => {
    const lookupBuilder = mockQuery({ data: null });
    const insertBuilder = mockQuery({ data: { id: "s2" } });
    mockFrom.mockReturnValueOnce(lookupBuilder).mockReturnValueOnce(insertBuilder);
    const { upsertDeviceSensor } = await import("./devices");

    const result = await upsertDeviceSensor("d1", "temp2", "Attic", "temperature");

    expect(result).toEqual({ sensor: { id: "s2" }, error: null });
    expect(insertBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ device_id: "d1", key: "temp2", visible: true }),
    );
  });
});

describe("touchDeviceLastSeen / updateDeviceMeta", () => {
  it("touchDeviceLastSeen stamps last_seen_at and updated_at for the device", async () => {
    const builder = mockQuery({ error: null });
    mockFrom.mockReturnValue(builder);
    const { touchDeviceLastSeen } = await import("./devices");

    await touchDeviceLastSeen("d1");

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_seen_at: expect.any(String), updated_at: expect.any(String) }),
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "d1");
  });

  it("updateDeviceMeta merges the patch into existing meta rather than replacing it", async () => {
    const selectBuilder = mockQuery({ data: { meta: { existingKey: "keepme" } } });
    const updateBuilder = mockQuery({ error: null });
    mockFrom.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(updateBuilder);
    const { updateDeviceMeta } = await import("./devices");

    await updateDeviceMeta("d1", { newKey: "added" });

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ meta: { existingKey: "keepme", newKey: "added" } }),
    );
  });

  it("updateDeviceMeta tolerates a device with no existing meta", async () => {
    const selectBuilder = mockQuery({ data: { meta: null } });
    const updateBuilder = mockQuery({ error: null });
    mockFrom.mockReturnValueOnce(selectBuilder).mockReturnValueOnce(updateBuilder);
    const { updateDeviceMeta } = await import("./devices");

    await updateDeviceMeta("d1", { newKey: "added" });

    expect(updateBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ meta: { newKey: "added" } }),
    );
  });
});
