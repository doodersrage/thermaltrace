import { afterEach, describe, expect, it, vi } from "vitest";
import Stripe from "stripe";
import { DEFAULT_SITE_URL } from "./siteConfig";

type EnvRecord = Record<string, string | undefined>;
const env = import.meta.env as unknown as EnvRecord;
const savedEnv: EnvRecord = {};

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
  vi.resetModules();
});

describe("createStripeClient", () => {
  it("throws when STRIPE_SECRET_KEY is not configured", async () => {
    stubEnv("STRIPE_SECRET_KEY", undefined);
    const { createStripeClient } = await import("./stripe");

    expect(() => createStripeClient()).toThrow("STRIPE_SECRET_KEY is not configured");
  });

  it("returns a real Stripe client once configured", async () => {
    stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    const { createStripeClient } = await import("./stripe");

    const client = createStripeClient();

    expect(client).toBeInstanceOf(Stripe);
  });

  it("caches and returns the same client instance across calls", async () => {
    stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    const { createStripeClient } = await import("./stripe");

    const first = createStripeClient();
    const second = createStripeClient();

    expect(first).toBe(second);
  });
});

describe("getSiteUrl", () => {
  it("prefers SITE_URL from the environment, stripping trailing slashes", async () => {
    stubEnv("SITE_URL", "https://env-site.example///");
    const { getSiteUrl } = await import("./stripe");

    expect(getSiteUrl(new Request("https://request-origin.example"))).toBe(
      "https://env-site.example",
    );
  });

  it("falls back to ORIGIN when SITE_URL is blank", async () => {
    stubEnv("SITE_URL", "  ");
    stubEnv("ORIGIN", "https://env-origin.example/");
    const { getSiteUrl } = await import("./stripe");

    expect(getSiteUrl(new Request("https://request-origin.example"))).toBe(
      "https://env-origin.example",
    );
  });

  it("falls back to the request's origin when no env url is configured", async () => {
    stubEnv("SITE_URL", undefined);
    stubEnv("ORIGIN", undefined);
    const { getSiteUrl } = await import("./stripe");

    expect(getSiteUrl(new Request("https://request-origin.example/checkout"))).toBe(
      "https://request-origin.example",
    );
  });

  it("falls back to resolveConfiguredSiteUrl when the request url can't be parsed", async () => {
    stubEnv("SITE_URL", undefined);
    stubEnv("ORIGIN", undefined);
    const { getSiteUrl } = await import("./stripe");

    const badRequest = { url: "not-a-valid-url" } as unknown as Request;
    expect(getSiteUrl(badRequest)).toBe(DEFAULT_SITE_URL);
  });
});

describe("buildSiteUrl", () => {
  it("joins the resolved site url with a path that has a leading slash", async () => {
    stubEnv("SITE_URL", "https://env-site.example");
    const { buildSiteUrl } = await import("./stripe");

    expect(buildSiteUrl(new Request("https://ignored.example"), "/billing")).toBe(
      "https://env-site.example/billing",
    );
  });

  it("adds a leading slash to a path that's missing one", async () => {
    stubEnv("SITE_URL", "https://env-site.example");
    const { buildSiteUrl } = await import("./stripe");

    expect(buildSiteUrl(new Request("https://ignored.example"), "billing")).toBe(
      "https://env-site.example/billing",
    );
  });
});

describe("isActiveSubscriptionStatus", () => {
  it("treats active and trialing as active", async () => {
    const { isActiveSubscriptionStatus } = await import("./stripe");

    expect(isActiveSubscriptionStatus("active")).toBe(true);
    expect(isActiveSubscriptionStatus("trialing")).toBe(true);
  });

  it("treats other statuses as inactive", async () => {
    const { isActiveSubscriptionStatus } = await import("./stripe");

    expect(isActiveSubscriptionStatus("canceled")).toBe(false);
    expect(isActiveSubscriptionStatus("past_due")).toBe(false);
    expect(isActiveSubscriptionStatus("")).toBe(false);
  });
});
