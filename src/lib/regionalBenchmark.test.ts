import { beforeEach, describe, expect, it, vi } from "vitest";

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  return builder;
}

const mockFrom = vi.fn();
vi.mock("./supabase", () => ({
  createServerClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}));

const mockFreezeMapAggregateKey = vi.fn();
vi.mock("./weatherCities", () => ({
  freezeMapAggregateKey: (...a: unknown[]) => mockFreezeMapAggregateKey(...a),
}));

function household(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    freeze_map_city_id: "123",
    freeze_map_label: "Household Label",
    freeze_map_opt_in: true,
    ...overrides,
  };
}

function setupQueries(householdData: unknown, snapshotData: unknown) {
  mockFrom.mockImplementation((table: string) =>
    table === "households"
      ? mockQuery({ data: householdData })
      : mockQuery({ data: snapshotData }),
  );
}

beforeEach(() => {
  mockFrom.mockReset();
  mockFreezeMapAggregateKey.mockReset().mockReturnValue("123");
});

describe("fetchRegionalBenchmark", () => {
  it("returns null for a non-finite yourTempF", async () => {
    const { fetchRegionalBenchmark } = await import("./regionalBenchmark");

    expect(
      await fetchRegionalBenchmark({ householdId: "house-1", yourTempF: NaN }),
    ).toBeNull();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns null when the household has not opted in", async () => {
    setupQueries(household({ freeze_map_opt_in: false }), null);
    const { fetchRegionalBenchmark } = await import("./regionalBenchmark");

    expect(
      await fetchRegionalBenchmark({ householdId: "house-1", yourTempF: 30 }),
    ).toBeNull();
  });

  it("returns null when the household has no city id", async () => {
    setupQueries(household({ freeze_map_city_id: null }), null);
    const { fetchRegionalBenchmark } = await import("./regionalBenchmark");

    expect(
      await fetchRegionalBenchmark({ householdId: "house-1", yourTempF: 30 }),
    ).toBeNull();
  });

  it("returns null when the aggregate key cannot be resolved", async () => {
    setupQueries(household(), null);
    mockFreezeMapAggregateKey.mockReturnValue(null);
    const { fetchRegionalBenchmark } = await import("./regionalBenchmark");

    expect(
      await fetchRegionalBenchmark({ householdId: "house-1", yourTempF: 30 }),
    ).toBeNull();
  });

  it("returns null when there is no usable snapshot", async () => {
    setupQueries(household(), { city_label: "Denver", avg_temp_f: null, min_temp_f: null });
    const { fetchRegionalBenchmark } = await import("./regionalBenchmark");

    expect(
      await fetchRegionalBenchmark({ householdId: "house-1", yourTempF: 30 }),
    ).toBeNull();
  });

  it("returns null when the resolved city average is not finite", async () => {
    setupQueries(household(), { city_label: "Denver", avg_temp_f: Infinity, min_temp_f: null });
    const { fetchRegionalBenchmark } = await import("./regionalBenchmark");

    expect(
      await fetchRegionalBenchmark({ householdId: "house-1", yourTempF: 30 }),
    ).toBeNull();
  });

  it("falls back to min_temp_f when avg_temp_f is unavailable", async () => {
    setupQueries(household(), { city_label: "Denver", avg_temp_f: null, min_temp_f: 28 });
    const { fetchRegionalBenchmark } = await import("./regionalBenchmark");

    const result = await fetchRegionalBenchmark({ householdId: "house-1", yourTempF: 28.5 });

    expect(result?.cityAvgTempF).toBe(28);
  });

  it("reports 'about typical' within 1.5F of the city average", async () => {
    setupQueries(household(), { city_label: "Denver", avg_temp_f: 30, min_temp_f: null });
    const { fetchRegionalBenchmark } = await import("./regionalBenchmark");

    const result = await fetchRegionalBenchmark({ householdId: "house-1", yourTempF: 30.9 });

    expect(result?.message).toBe("About typical for other ThermalTrace households in Denver tonight.");
  });

  it("reports colder-than-typical below the 1.5F band", async () => {
    setupQueries(household(), { city_label: "Denver", avg_temp_f: 30, min_temp_f: null });
    const { fetchRegionalBenchmark } = await import("./regionalBenchmark");

    const result = await fetchRegionalBenchmark({ householdId: "house-1", yourTempF: 25 });

    expect(result?.deltaF).toBe(-5);
    expect(result?.message).toBe(
      "5.0°F colder than typical ThermalTrace households in Denver right now.",
    );
  });

  it("reports warmer-than-typical above the 1.5F band", async () => {
    setupQueries(household(), { city_label: "Denver", avg_temp_f: 30, min_temp_f: null });
    const { fetchRegionalBenchmark } = await import("./regionalBenchmark");

    const result = await fetchRegionalBenchmark({ householdId: "house-1", yourTempF: 36 });

    expect(result?.deltaF).toBe(6);
    expect(result?.message).toBe(
      "6.0°F warmer than typical ThermalTrace households in Denver right now.",
    );
  });

  it("falls back from snapshot city_label to the household's label, then 'your region'", async () => {
    setupQueries(
      household({ freeze_map_label: "My Custom Label" }),
      { city_label: null, avg_temp_f: 30, min_temp_f: null },
    );
    const { fetchRegionalBenchmark } = await import("./regionalBenchmark");

    const result = await fetchRegionalBenchmark({ householdId: "house-1", yourTempF: 30 });

    expect(result?.cityLabel).toBe("My Custom Label");
  });

  it("falls back all the way to 'your region' when no label exists anywhere", async () => {
    setupQueries(
      household({ freeze_map_label: null }),
      { city_label: null, avg_temp_f: 30, min_temp_f: null },
    );
    const { fetchRegionalBenchmark } = await import("./regionalBenchmark");

    const result = await fetchRegionalBenchmark({ householdId: "house-1", yourTempF: 30 });

    expect(result?.cityLabel).toBe("your region");
  });
});

describe("formatBenchmarkAlertSuffix", () => {
  it("returns the benchmark's message", async () => {
    const { formatBenchmarkAlertSuffix } = await import("./regionalBenchmark");

    expect(
      formatBenchmarkAlertSuffix({
        cityLabel: "Denver",
        cityAvgTempF: 30,
        yourTempF: 30,
        deltaF: 0,
        message: "About typical.",
      }),
    ).toBe("About typical.");
  });

  it("returns null when there is no benchmark", async () => {
    const { formatBenchmarkAlertSuffix } = await import("./regionalBenchmark");

    expect(formatBenchmarkAlertSuffix(null)).toBeNull();
  });
});
