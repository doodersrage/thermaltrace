import { describe, expect, it, vi } from "vitest";
import {
  FLASH_API_KEY,
  FLASH_INGEST_KEY,
  FLASH_INGEST_TTL_SEC,
  clearSecretFlash,
  consumeSecretFlash,
  peekSecretFlash,
  setSecretFlash,
} from "./secretFlash";

function fakeCookies() {
  const store = new Map<string, string>();
  return {
    set: vi.fn((name: string, value: string) => {
      store.set(name, value);
    }),
    get: vi.fn((name: string) => {
      const value = store.get(name);
      return value === undefined ? undefined : { value };
    }),
    delete: vi.fn((name: string) => {
      store.delete(name);
    }),
    _store: store,
  };
}

describe("setSecretFlash", () => {
  it("uses the longer ingest TTL for the ingest-key cookie by default", () => {
    const cookies = fakeCookies();

    setSecretFlash(cookies as never, FLASH_INGEST_KEY, "raw-key");

    expect(cookies.set).toHaveBeenCalledWith(
      FLASH_INGEST_KEY,
      "raw-key",
      expect.objectContaining({ maxAge: FLASH_INGEST_TTL_SEC }),
    );
  });

  it("uses the shorter default TTL for other flash cookies", () => {
    const cookies = fakeCookies();

    setSecretFlash(cookies as never, FLASH_API_KEY, "api-key");

    expect(cookies.set).toHaveBeenCalledWith(
      FLASH_API_KEY,
      "api-key",
      expect.objectContaining({ maxAge: 5 * 60 }),
    );
  });

  it("honors an explicit maxAgeSec override", () => {
    const cookies = fakeCookies();

    setSecretFlash(cookies as never, FLASH_API_KEY, "api-key", 42);

    expect(cookies.set).toHaveBeenCalledWith(
      FLASH_API_KEY,
      "api-key",
      expect.objectContaining({ maxAge: 42 }),
    );
  });

  it("sets HttpOnly, lax same-site cookies scoped to the whole site", () => {
    const cookies = fakeCookies();

    setSecretFlash(cookies as never, FLASH_API_KEY, "api-key");

    expect(cookies.set).toHaveBeenCalledWith(
      FLASH_API_KEY,
      "api-key",
      expect.objectContaining({ path: "/", httpOnly: true, sameSite: "lax" }),
    );
  });
});

describe("peekSecretFlash", () => {
  it("returns the trimmed cookie value without clearing it", () => {
    const cookies = fakeCookies();
    cookies._store.set(FLASH_API_KEY, "  api-key  ");

    expect(peekSecretFlash(cookies as never, FLASH_API_KEY)).toBe("api-key");
    expect(cookies.delete).not.toHaveBeenCalled();
    expect(cookies._store.has(FLASH_API_KEY)).toBe(true);
  });

  it("returns null when the cookie is missing or blank", () => {
    const cookies = fakeCookies();

    expect(peekSecretFlash(cookies as never, FLASH_API_KEY)).toBeNull();

    cookies._store.set(FLASH_API_KEY, "   ");
    expect(peekSecretFlash(cookies as never, FLASH_API_KEY)).toBeNull();
  });
});

describe("consumeSecretFlash", () => {
  it("returns the value and deletes the cookie when present", () => {
    const cookies = fakeCookies();
    cookies._store.set(FLASH_API_KEY, "api-key");

    expect(consumeSecretFlash(cookies as never, FLASH_API_KEY)).toBe("api-key");
    expect(cookies.delete).toHaveBeenCalledWith(FLASH_API_KEY, { path: "/" });
  });

  it("does not attempt to delete when there is nothing to consume", () => {
    const cookies = fakeCookies();

    expect(consumeSecretFlash(cookies as never, FLASH_API_KEY)).toBeNull();
    expect(cookies.delete).not.toHaveBeenCalled();
  });
});

describe("clearSecretFlash", () => {
  it("deletes the cookie scoped to the site path", () => {
    const cookies = fakeCookies();

    clearSecretFlash(cookies as never, FLASH_API_KEY);

    expect(cookies.delete).toHaveBeenCalledWith(FLASH_API_KEY, { path: "/" });
  });
});
