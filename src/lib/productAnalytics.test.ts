import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isDashboardConversionPath,
  shouldTrackProductAnalytics,
  trackProductEvent,
} from "./productAnalytics";

type EnvRecord = Record<string, string | boolean | undefined>;
const env = import.meta.env as unknown as EnvRecord;
const savedEnv: EnvRecord = {};

afterEach(() => {
  for (const key of Object.keys(savedEnv)) {
    const original = savedEnv[key];
    if (original === undefined) {
      delete env[key];
    } else {
      env[key] = original;
    }
    delete savedEnv[key];
  }
  vi.unstubAllGlobals();
});

// import.meta.env is a Proxy that stringifies assigned values, so setting a
// key to `undefined` directly would store the literal string "undefined" —
// deleting the key is the only way to make it read back as undefined.
function stubEnv(key: string, value: string | boolean | undefined) {
  if (!(key in savedEnv)) savedEnv[key] = env[key];
  if (value === undefined) {
    delete env[key];
  } else {
    env[key] = value;
  }
}

describe("trackProductEvent", () => {
  it("does nothing when window is undefined", () => {
    expect(() => trackProductEvent("login")).not.toThrow();
  });

  it("does nothing (no throw) when window is defined but has no gtag", () => {
    vi.stubGlobal("window", {});
    expect(() => trackProductEvent("login")).not.toThrow();
  });

  it("calls gtag with the event name and props when gtag is present", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });

    trackProductEvent("purchase", { value: 10 });

    expect(gtag).toHaveBeenCalledWith("event", "purchase", { value: 10 });
  });

  it("calls gtag with an empty object when no props are given", () => {
    const gtag = vi.fn();
    vi.stubGlobal("window", { gtag });

    trackProductEvent("login");

    expect(gtag).toHaveBeenCalledWith("event", "login", {});
  });

  it("logs via console.debug when DEV is enabled and window is defined", () => {
    stubEnv("DEV", true);
    vi.stubGlobal("window", {});
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    trackProductEvent("login", { foo: "bar" });

    expect(debugSpy).toHaveBeenCalledWith("[product-analytics]", { event: "login", foo: "bar" });
    debugSpy.mockRestore();
  });

  it("does not log when DEV is not enabled", () => {
    stubEnv("DEV", false);
    vi.stubGlobal("window", {});
    const debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

    trackProductEvent("login");

    expect(debugSpy).not.toHaveBeenCalled();
    debugSpy.mockRestore();
  });
});

describe("shouldTrackProductAnalytics", () => {
  it("returns false when the metadata opts out, regardless of PROD", () => {
    stubEnv("PROD", true);
    expect(shouldTrackProductAnalytics({ product_analytics_opt_out: true })).toBe(false);
  });

  it("returns the PROD flag when there is no opt-out", () => {
    stubEnv("PROD", true);
    expect(shouldTrackProductAnalytics()).toBe(true);

    stubEnv("PROD", false);
    expect(shouldTrackProductAnalytics({ some_other_key: true })).toBe(false);
  });
});

describe("isDashboardConversionPath", () => {
  it("returns false for paths outside /dashboard", () => {
    expect(isDashboardConversionPath("/settings", "subscription=success")).toBe(false);
  });

  it("returns false when subscription=success is missing", () => {
    expect(isDashboardConversionPath("/dashboard")).toBe(false);
    expect(isDashboardConversionPath("/dashboard", "subscription=cancelled")).toBe(false);
  });

  it("returns true for /dashboard with a string subscription=success query", () => {
    expect(isDashboardConversionPath("/dashboard", "subscription=success")).toBe(true);
  });

  it("returns true for /dashboard with a URLSearchParams subscription=success query", () => {
    const params = new URLSearchParams("subscription=success");
    expect(isDashboardConversionPath("/dashboard", params)).toBe(true);
  });

  it("matches nested dashboard paths too", () => {
    expect(isDashboardConversionPath("/dashboard/billing", "subscription=success")).toBe(true);
  });
});
