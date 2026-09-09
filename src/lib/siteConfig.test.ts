import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_SITE_URL, resolveConfiguredSiteUrl, resolvePageUrl } from "./siteConfig";

type EnvRecord = Record<string, string | undefined>;

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
});

// import.meta.env is a Proxy that stringifies assigned values, so setting a
// key to `undefined` directly would store the literal string "undefined" —
// deleting the key is the only way to make it read back as undefined.
function stubEnv(key: string, value: string | undefined) {
  if (!(key in savedEnv)) savedEnv[key] = env[key];
  if (value === undefined) {
    delete env[key];
  } else {
    env[key] = value;
  }
}

describe("resolveConfiguredSiteUrl", () => {
  it("prefers an explicit siteUrl argument, stripping trailing slashes", () => {
    expect(resolveConfiguredSiteUrl("https://example.com///")).toBe("https://example.com");
  });

  it("accepts a URL object for the explicit siteUrl argument", () => {
    expect(resolveConfiguredSiteUrl(new URL("https://example.com/foo"))).toBe(
      "https://example.com/foo",
    );
  });

  it("falls back to an explicit env argument (SITE_URL over ORIGIN)", () => {
    const result = resolveConfiguredSiteUrl(null, {
      SITE_URL: "https://env-site.example/",
      ORIGIN: "https://env-origin.example/",
    });

    expect(result).toBe("https://env-site.example");
  });

  it("falls back to ORIGIN when SITE_URL is blank in the explicit env argument", () => {
    const result = resolveConfiguredSiteUrl(null, {
      SITE_URL: "  ",
      ORIGIN: "https://env-origin.example/",
    });

    expect(result).toBe("https://env-origin.example");
  });

  it("falls back to import.meta.env when no siteUrl or env argument is given", () => {
    stubEnv("SITE_URL", "https://global-site.example/");

    expect(resolveConfiguredSiteUrl()).toBe("https://global-site.example");
  });

  it("falls back to the default site url when nothing else is configured", () => {
    stubEnv("SITE_URL", undefined);
    stubEnv("ORIGIN", undefined);

    expect(resolveConfiguredSiteUrl()).toBe(DEFAULT_SITE_URL);
  });
});

describe("resolvePageUrl", () => {
  it("joins the site url with a path that already starts with a slash", () => {
    expect(resolvePageUrl("https://example.com", "/dashboard")).toBe(
      "https://example.com/dashboard",
    );
  });

  it("adds a leading slash to a path that's missing one", () => {
    expect(resolvePageUrl("https://example.com", "dashboard")).toBe(
      "https://example.com/dashboard",
    );
  });
});
