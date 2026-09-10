import { afterEach, describe, expect, it } from "vitest";
import {
  buildGitHubOAuthCallbackUrl,
  buildOAuthCallbackUrl,
  buildSiteUrl,
  formRedirectPath,
  sanitizeNextPath,
  withQuery,
} from "./siteUrl";

// import.meta.env is a Proxy that stringifies assigned values, so setting a
// key to `undefined` stores the literal string "undefined" rather than
// clearing it. Always `delete` a key to represent "unset".
const env = import.meta.env as unknown as Record<string, string | undefined>;
const savedSiteUrl = env.SITE_URL;
const savedOrigin = env.ORIGIN;

function stubEnv(values: { SITE_URL?: string; ORIGIN?: string }) {
  if (values.SITE_URL === undefined) delete env.SITE_URL;
  else env.SITE_URL = values.SITE_URL;
  if (values.ORIGIN === undefined) delete env.ORIGIN;
  else env.ORIGIN = values.ORIGIN;
}

afterEach(() => {
  if (savedSiteUrl === undefined) delete env.SITE_URL;
  else env.SITE_URL = savedSiteUrl;
  if (savedOrigin === undefined) delete env.ORIGIN;
  else env.ORIGIN = savedOrigin;
});

describe("buildSiteUrl", () => {
  it("prefers an explicit site value, stripping trailing slashes", () => {
    stubEnv({});
    expect(buildSiteUrl(undefined, "https://example.com///")).toBe("https://example.com");
  });

  it("falls back to SITE_URL/ORIGIN env vars when no site or request is given", () => {
    stubEnv({});
    expect(buildSiteUrl()).toBe("https://thermaltrace.dev");
  });

  it("uses SITE_URL from env when a request is given, trimming trailing slashes", () => {
    stubEnv({ SITE_URL: "https://from-env.example.com/" });
    const request = new Request("https://request-host.example.com/page");
    expect(buildSiteUrl(request)).toBe("https://from-env.example.com");
  });

  it("falls back to ORIGIN from env when SITE_URL is unset", () => {
    stubEnv({ ORIGIN: "https://from-origin.example.com" });
    const request = new Request("https://request-host.example.com/page");
    expect(buildSiteUrl(request)).toBe("https://from-origin.example.com");
  });

  it("derives the origin from the request when no env vars are set", () => {
    stubEnv({});
    const request = new Request("https://request-host.example.com/page");
    expect(buildSiteUrl(request)).toBe("https://request-host.example.com");
  });

  it("prefers an explicit site over a request", () => {
    stubEnv({});
    const request = new Request("https://request-host.example.com/page");
    expect(buildSiteUrl(request, "https://explicit.example.com")).toBe(
      "https://explicit.example.com",
    );
  });
});

describe("buildOAuthCallbackUrl", () => {
  it("appends the auth callback path to the site url", () => {
    const request = new Request("https://example.com/page");
    expect(buildOAuthCallbackUrl(request, "https://example.com")).toBe(
      "https://example.com/api/auth/callback",
    );
  });
});

describe("buildGitHubOAuthCallbackUrl", () => {
  it("appends the GitHub callback path to the site url", () => {
    const request = new Request("https://example.com/page");
    expect(buildGitHubOAuthCallbackUrl(request, "https://example.com")).toBe(
      "https://example.com/api/auth/github/callback",
    );
  });
});

describe("sanitizeNextPath", () => {
  it("returns null for a null, undefined, or empty value", () => {
    expect(sanitizeNextPath(null)).toBeNull();
    expect(sanitizeNextPath(undefined)).toBeNull();
    expect(sanitizeNextPath("")).toBeNull();
  });

  it("accepts a same-origin relative path", () => {
    expect(sanitizeNextPath("/dashboard")).toBe("/dashboard");
  });

  it("trims whitespace before checking", () => {
    expect(sanitizeNextPath("  /dashboard  ")).toBe("/dashboard");
  });

  it("rejects a path that doesn't start with /", () => {
    expect(sanitizeNextPath("dashboard")).toBeNull();
    expect(sanitizeNextPath("https://evil.example.com")).toBeNull();
  });

  it("rejects a protocol-relative path", () => {
    expect(sanitizeNextPath("//evil.example.com")).toBeNull();
  });

  it("rejects a path containing a backslash or null byte", () => {
    expect(sanitizeNextPath("/ok\\evil.com")).toBeNull();
    expect(sanitizeNextPath("/ok\0evil")).toBeNull();
  });
});

describe("formRedirectPath", () => {
  it("returns the sanitized redirect field when present and valid", () => {
    const formData = new FormData();
    formData.set("redirect", "/settings");
    expect(formRedirectPath(formData, "/dashboard")).toBe("/settings");
  });

  it("falls back to the fallback path when the field is missing", () => {
    const formData = new FormData();
    expect(formRedirectPath(formData, "/dashboard")).toBe("/dashboard");
  });

  it("falls back to the fallback path when the field is unsafe", () => {
    const formData = new FormData();
    formData.set("redirect", "//evil.example.com");
    expect(formRedirectPath(formData, "/dashboard")).toBe("/dashboard");
  });

  it("reads from a custom field name", () => {
    const formData = new FormData();
    formData.set("next", "/custom");
    expect(formRedirectPath(formData, "/dashboard", "next")).toBe("/custom");
  });

  it("falls back to /dashboard when both the field and fallback are unsafe", () => {
    const formData = new FormData();
    formData.set("redirect", "not-a-path");
    expect(formRedirectPath(formData, "also-not-a-path")).toBe("/dashboard");
  });
});

describe("withQuery", () => {
  it("appends params to a bare path", () => {
    expect(withQuery("/dashboard/alerts", { alert_saved: "1" })).toBe(
      "/dashboard/alerts?alert_saved=1",
    );
  });

  it("keeps an existing tab query instead of producing a second ?", () => {
    expect(
      withQuery("/dashboard/alerts?tab=settings", { alert_saved: "1" }),
    ).toBe("/dashboard/alerts?tab=settings&alert_saved=1");
  });

  it("preserves a hash", () => {
    expect(
      withQuery("/dashboard/alerts?tab=settings#send-test-alert", { test_sent: "1" }),
    ).toBe("/dashboard/alerts?tab=settings&test_sent=1#send-test-alert");
  });
});
