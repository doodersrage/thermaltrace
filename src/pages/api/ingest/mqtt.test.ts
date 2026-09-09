import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockReadJsonBodyWithLimit = vi.fn();
vi.mock("../../../lib/ingestLimits", () => ({
  readJsonBodyWithLimit: (...a: unknown[]) => mockReadJsonBodyWithLimit(...a),
}));

const mockResolveConfiguredSiteUrl = vi.fn();
vi.mock("../../../lib/siteConfig", () => ({
  resolveConfiguredSiteUrl: (...a: unknown[]) => mockResolveConfiguredSiteUrl(...a),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeContext(options: {
  key?: string | null;
  body?: unknown;
} = {}): APIContext {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (options.key !== null) {
    headers.set("X-Ingest-Key", options.key ?? "device-key");
  }
  return {
    request: new Request("https://example.com/api/ingest/mqtt", {
      method: "POST",
      headers,
      body: JSON.stringify(options.body ?? { message: { temp1: 42 } }),
    }),
    site: new URL("https://app.example.com"),
  } as unknown as APIContext;
}

beforeEach(() => {
  mockReadJsonBodyWithLimit.mockReset().mockResolvedValue({
    ok: true,
    payload: { message: { temp1: 42.5 } },
  });
  mockResolveConfiguredSiteUrl.mockReset().mockReturnValue("https://app.example.com/");
  mockFetch.mockReset().mockResolvedValue(
    new Response(JSON.stringify({ ok: true, readings: 1 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  );
});

describe("POST /api/ingest/mqtt", () => {
  it("returns 400 when X-Ingest-Key is missing", async () => {
    const { POST } = await import("./mqtt");

    const response = await POST(makeContext({ key: null }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing X-Ingest-Key header" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns the body-limit error when the envelope is too large", async () => {
    mockReadJsonBodyWithLimit.mockResolvedValue({
      ok: false,
      error: "Payload too large",
      status: 413,
    });
    const { POST } = await import("./mqtt");

    const response = await POST(makeContext());

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: "Payload too large" });
  });

  it("returns 400 when payload JSON string is invalid", async () => {
    mockReadJsonBodyWithLimit.mockResolvedValue({
      ok: true,
      payload: { payload: "{not-json" },
    });
    const { POST } = await import("./mqtt");

    const response = await POST(makeContext());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid payload JSON string" });
  });

  it("forwards the message object to ingest with the device key header", async () => {
    const { POST } = await import("./mqtt");

    const response = await POST(makeContext());

    expect(mockFetch).toHaveBeenCalledWith(
      "https://app.example.com/api/ingest/_",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-Ingest-Key": "device-key",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ temp1: 42.5 }),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, readings: 1 });
  });

  it("parses a string payload before forwarding", async () => {
    mockReadJsonBodyWithLimit.mockResolvedValue({
      ok: true,
      payload: { payload: JSON.stringify({ temp1: 10 }) },
    });
    const { POST } = await import("./mqtt");

    await POST(makeContext());

    expect(mockFetch).toHaveBeenCalledWith(
      "https://app.example.com/api/ingest/_",
      expect.objectContaining({ body: JSON.stringify({ temp1: 10 }) }),
    );
  });
});
