import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockResolveApiKey = vi.fn();
vi.mock("../../../lib/apiKeys", () => ({
  resolveApiKey: (...a: unknown[]) => mockResolveApiKey(...a),
}));

const mockBuildPrometheusText = vi.fn();
vi.mock("../../../lib/prometheusMetrics", () => ({
  buildPrometheusText: (...a: unknown[]) => mockBuildPrometheusText(...a),
}));

function makeContext(authHeader: string | null): APIContext {
  const headers = new Headers();
  if (authHeader !== null) headers.set("authorization", authHeader);
  return { request: new Request("https://example.com/api/v1/metrics", { headers }) } as unknown as APIContext;
}

beforeEach(() => {
  mockResolveApiKey.mockReset();
  mockBuildPrometheusText.mockReset();
});

describe("GET /api/v1/metrics", () => {
  it("returns 401 when there is no Authorization header", async () => {
    const { GET } = await import("./metrics");

    const response = await GET(makeContext(null));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Missing Bearer token" });
    expect(mockResolveApiKey).not.toHaveBeenCalled();
  });

  it("returns 401 when the Authorization header isn't a Bearer token", async () => {
    const { GET } = await import("./metrics");

    const response = await GET(makeContext("Basic abc123"));

    expect(response.status).toBe(401);
  });

  it("returns 401 when the bearer token doesn't resolve to an api key", async () => {
    mockResolveApiKey.mockResolvedValue(null);
    const { GET } = await import("./metrics");

    const response = await GET(makeContext("Bearer gtm_bad-key"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Invalid API key" });
    expect(mockResolveApiKey).toHaveBeenCalledWith("gtm_bad-key");
  });

  it("returns the Prometheus text body for the resolved household on success", async () => {
    mockResolveApiKey.mockResolvedValue({ householdId: "house-1", keyId: "key-1" });
    mockBuildPrometheusText.mockResolvedValue("thermaltrace_temp_f 42\n");
    const { GET } = await import("./metrics");

    const response = await GET(makeContext("Bearer gtm_good-key"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/plain; version=0.0.4; charset=utf-8");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("thermaltrace_temp_f 42\n");
    expect(mockBuildPrometheusText).toHaveBeenCalledWith("house-1");
  });

  it("accepts a case-insensitive bearer prefix", async () => {
    mockResolveApiKey.mockResolvedValue({ householdId: "house-1", keyId: "key-1" });
    mockBuildPrometheusText.mockResolvedValue("");
    const { GET } = await import("./metrics");

    const response = await GET(makeContext("bearer gtm_good-key"));

    expect(response.status).toBe(200);
  });
});
