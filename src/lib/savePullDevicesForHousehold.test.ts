import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TempFeedConfig, TempProbeConfig } from "./tempFeedConfig";

/**
 * A small stateful in-memory fake of the subset of supabase-js's
 * query-builder surface that devices.ts actually uses (select/insert/
 * update/delete with eq/in filters and optional ordering, resolved either
 * via .single()/.maybeSingle() or by awaiting the builder itself).
 *
 * savePullDevicesForHousehold() calls listHouseholdDevices() internally
 * (a real, unmocked function in the same module), so this fake has to
 * behave enough like real Postgres for that read-after-write round trip
 * to work, not just for the writes savePullDevicesForHousehold makes
 * directly.
 */
type FakeRow = Record<string, unknown>;

function makeFakeSupabase() {
  let nextId = 1;
  const tables: Record<string, FakeRow[]> = { devices: [], device_sensors: [] };
  // Test hook: { table: { message } } arms a one-shot insert failure on
  // that table (consumed by the next insert()), used to simulate the
  // duplicate-key race savePullDevicesForHousehold is written to tolerate.
  const armedInsertFailures: Record<string, string | undefined> = {};

  function applyFilters(
    rows: FakeRow[],
    filters: { col: string; op: "eq" | "in"; val: unknown }[],
  ) {
    return rows.filter((row) =>
      filters.every((f) =>
        f.op === "eq" ? row[f.col] === f.val : (f.val as unknown[]).includes(row[f.col]),
      ),
    );
  }

  function from(table: string) {
    const rows = tables[table];
    if (!rows) throw new Error(`fake supabase: unknown table "${table}"`);

    let mode: "select" | "insert" | "update" | "delete" = "select";
    let payload: FakeRow | null = null;
    const filters: { col: string; op: "eq" | "in"; val: unknown }[] = [];
    let orderCol: string | null = null;

    function execute(single: boolean): { data: unknown; error: unknown } {
      if (mode === "insert") {
        const failure = armedInsertFailures[table];
        if (failure) {
          armedInsertFailures[table] = undefined;
          return { data: null, error: { message: failure } };
        }
        const row: FakeRow = { id: `gen-${nextId++}`, ...(payload as FakeRow) };
        rows.push(row);
        return { data: single ? row : [row], error: null };
      }
      if (mode === "select") {
        let matched = applyFilters(rows, filters);
        if (orderCol) {
          const col = orderCol;
          matched = [...matched].sort(
            (a, b) => Number(a[col] ?? 0) - Number(b[col] ?? 0),
          );
        }
        return { data: single ? matched[0] ?? null : matched, error: null };
      }
      if (mode === "update") {
        const matched = applyFilters(rows, filters);
        for (const row of matched) Object.assign(row, payload);
        return { data: single ? matched[0] ?? null : matched, error: null };
      }
      // delete
      const matched = applyFilters(rows, filters);
      for (const row of matched) {
        const idx = rows.indexOf(row);
        if (idx >= 0) rows.splice(idx, 1);
      }
      return { data: matched, error: null };
    }

    const builder = {
      select(_cols?: string) {
        if (mode !== "insert" && mode !== "update" && mode !== "delete") mode = "select";
        return builder;
      },
      insert(obj: FakeRow) {
        mode = "insert";
        payload = obj;
        return builder;
      },
      update(obj: FakeRow) {
        mode = "update";
        payload = obj;
        return builder;
      },
      delete() {
        mode = "delete";
        return builder;
      },
      eq(col: string, val: unknown) {
        filters.push({ col, op: "eq", val });
        return builder;
      },
      in(col: string, val: unknown[]) {
        filters.push({ col, op: "in", val });
        return builder;
      },
      order(col: string) {
        orderCol = col;
        return builder;
      },
      single: () => Promise.resolve(execute(true)),
      maybeSingle: () => Promise.resolve(execute(true)),
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        return Promise.resolve(execute(false)).then(resolve, reject);
      },
    };
    return builder;
  }

  function failNextInsert(table: string, message: string) {
    armedInsertFailures[table] = message;
  }

  return { from, tables, failNextInsert };
}

let fakeSupabase: ReturnType<typeof makeFakeSupabase>;
vi.mock("./supabase", () => ({
  createServerClient: () => fakeSupabase,
}));

beforeEach(() => {
  fakeSupabase = makeFakeSupabase();
});

function feed(overrides: Partial<TempFeedConfig> = {}): TempFeedConfig {
  return {
    id: "feed-1",
    name: "Garage",
    url: "https://example.com/feed.json",
    enabled: true,
    ...overrides,
  };
}

function probe(overrides: Partial<TempProbeConfig> = {}): TempProbeConfig {
  return { id: "feed-1:0", feedId: "feed-1", key: "0", label: "Bay 0", visible: true, ...overrides };
}

describe("savePullDevicesForHousehold", () => {
  it("creates a new device plus temp+humidity sensor pairs for a brand-new feed", async () => {
    const { savePullDevicesForHousehold, listHouseholdDevices } = await import("./devices");

    const result = await savePullDevicesForHousehold("house-1", [feed()], [probe()]);

    expect(result).toEqual({ error: null });
    const { devices } = await listHouseholdDevices("house-1");
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({
      source: "pull_url",
      pull_url: "https://example.com/feed.json",
    });
    expect(devices[0].sensors).toHaveLength(2);
    expect(devices[0].sensors.map((s) => s.kind).sort()).toEqual(["humidity", "temperature"]);
    const tempSensor = devices[0].sensors.find((s) => s.kind === "temperature")!;
    expect(tempSensor.label).toBe("Bay 0");
    const humiditySensor = devices[0].sensors.find((s) => s.kind === "humidity")!;
    expect(humiditySensor.label).toBe("Bay 0 humidity");
  });

  it("matches an existing device by normalized URL instead of creating a duplicate", async () => {
    const { savePullDevicesForHousehold, listHouseholdDevices } = await import("./devices");

    await savePullDevicesForHousehold(
      "house-1",
      [feed({ url: "https://example.com/feed.json" })],
      [probe()],
    );
    // Same feed, trailing slash added -- normalizePullFeedUrl should still match it.
    await savePullDevicesForHousehold(
      "house-1",
      [feed({ url: "https://example.com/feed.json/", name: "Garage Renamed" })],
      [probe()],
    );

    const { devices } = await listHouseholdDevices("house-1");
    expect(devices).toHaveLength(1);
    expect(devices[0].name).toBe("Garage Renamed");
  });

  it("updates an existing sensor's label/visibility instead of duplicating it on a second save", async () => {
    const { savePullDevicesForHousehold, listHouseholdDevices } = await import("./devices");

    await savePullDevicesForHousehold("house-1", [feed()], [probe({ label: "Bay 0", visible: true })]);
    await savePullDevicesForHousehold("house-1", [feed()], [probe({ label: "Bay Zero", visible: false })]);

    const { devices } = await listHouseholdDevices("house-1");
    expect(devices[0].sensors).toHaveLength(2);
    const tempSensor = devices[0].sensors.find((s) => s.kind === "temperature")!;
    expect(tempSensor.label).toBe("Bay Zero");
    expect(tempSensor.visible).toBe(false);
  });

  it("deletes a sensor that is no longer present in the saved probe list", async () => {
    const { savePullDevicesForHousehold, listHouseholdDevices } = await import("./devices");

    await savePullDevicesForHousehold(
      "house-1",
      [feed()],
      [probe({ key: "0" }), probe({ id: "feed-1:1", key: "1", label: "Bay 1" })],
    );
    // Second save drops probe "1" entirely.
    await savePullDevicesForHousehold("house-1", [feed()], [probe({ key: "0" })]);

    const { devices } = await listHouseholdDevices("house-1");
    // Only probe "0"'s temp+humidity pair should remain.
    expect(devices[0].sensors).toHaveLength(2);
    expect(devices[0].sensors.every((s) => s.key === "0")).toBe(true);
  });

  it("removes a device (and its sensors) once its feed is dropped from the saved list", async () => {
    const { savePullDevicesForHousehold, listHouseholdDevices } = await import("./devices");

    await savePullDevicesForHousehold(
      "house-1",
      [
        feed({ id: "feed-1", url: "https://a.example.com" }),
        feed({ id: "feed-2", url: "https://b.example.com" }),
      ],
      [
        probe({ id: "feed-1:0", feedId: "feed-1" }),
        probe({ id: "feed-2:0", feedId: "feed-2" }),
      ],
    );
    // Drop feed-2 entirely.
    await savePullDevicesForHousehold(
      "house-1",
      [feed({ id: "feed-1", url: "https://a.example.com" })],
      [probe({ id: "feed-1:0", feedId: "feed-1" })],
    );

    const { devices } = await listHouseholdDevices("house-1");
    expect(devices).toHaveLength(1);
    expect(devices[0].pull_url).toBe("https://a.example.com");
    // The removed device's sensors must not be left as orphans in device_sensors.
    expect(
      fakeSupabase.tables.device_sensors.some((s) => s.device_id !== devices[0].id),
    ).toBe(false);
  });

  it("skips a feed with an empty url without creating a device for it", async () => {
    const { savePullDevicesForHousehold, listHouseholdDevices } = await import("./devices");

    const result = await savePullDevicesForHousehold("house-1", [feed({ url: "" })], []);

    expect(result).toEqual({ error: null });
    const { devices } = await listHouseholdDevices("house-1");
    expect(devices).toEqual([]);
  });

  it("tolerates a duplicate-key insert race on a sensor without failing the whole save", async () => {
    const { savePullDevicesForHousehold } = await import("./devices");

    fakeSupabase.failNextInsert(
      "device_sensors",
      "duplicate key value violates unique constraint",
    );

    const result = await savePullDevicesForHousehold("house-1", [feed()], [probe()]);

    expect(result).toEqual({ error: null });
  });

  it("fails the save on a non-duplicate sensor insert error", async () => {
    const { savePullDevicesForHousehold } = await import("./devices");

    fakeSupabase.failNextInsert("device_sensors", "constraint violation: not null");

    const result = await savePullDevicesForHousehold("house-1", [feed()], [probe()]);

    expect(result).toEqual({ error: "constraint violation: not null" });
  });

  it("propagates a listHouseholdDevices error instead of proceeding to write", async () => {
    fakeSupabase = {
      from: (table: string) => {
        const chain = {
          select: () => chain,
          eq: () => chain,
          order: () =>
            Promise.resolve({ data: null, error: { message: "db down" } }),
        };
        return chain;
      },
      tables: { devices: [], device_sensors: [] },
      failNextInsert: () => {},
    } as unknown as ReturnType<typeof makeFakeSupabase>;
    const { savePullDevicesForHousehold } = await import("./devices");

    const result = await savePullDevicesForHousehold("house-1", [feed()], [probe()]);

    expect(result).toEqual({ error: "db down" });
  });
});
