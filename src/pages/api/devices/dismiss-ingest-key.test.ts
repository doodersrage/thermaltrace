import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockClearSecretFlash = vi.fn();
vi.mock("../../../lib/secretFlash", () => ({
  FLASH_INGEST_KEY: "ingest_key",
  clearSecretFlash: (...a: unknown[]) => mockClearSecretFlash(...a),
}));

function makeContext(): APIContext {
  return { cookies: {} } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({ session: { access_token: "at" } });
  mockClearSecretFlash.mockReset();
});

describe("POST /api/devices/dismiss-ingest-key", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null });
    const { POST } = await import("./dismiss-ingest-key");

    const response = await POST(makeContext());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false });
    expect(mockClearSecretFlash).not.toHaveBeenCalled();
  });

  it("clears the flash and returns ok", async () => {
    const { POST } = await import("./dismiss-ingest-key");
    const context = makeContext();

    const response = await POST(context);

    expect(mockClearSecretFlash).toHaveBeenCalledWith(context.cookies, "ingest_key");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
