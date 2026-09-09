import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_SITE_URL,
} from "./siteConfig";
import {
  EXAMPLE_FEED_PATH,
  getDefaultPublicFeedUrl,
  getExampleFeedDocumentUrl,
  getExampleFeedUrl,
} from "./exampleFeed";

type EnvRecord = Record<string, string | undefined>;
const env = import.meta.env as unknown as EnvRecord;
const savedEnv: EnvRecord = {};

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
});

describe("getExampleFeedUrl", () => {
  it("joins an explicit site url with the example feed path", () => {
    expect(getExampleFeedUrl("https://example.com")).toBe(
      `https://example.com${EXAMPLE_FEED_PATH}`,
    );
  });

  it("falls back to the default site url when none is given", () => {
    stubEnv("SITE_URL", undefined);
    stubEnv("ORIGIN", undefined);

    expect(getExampleFeedUrl()).toBe(`${DEFAULT_SITE_URL}${EXAMPLE_FEED_PATH}`);
  });
});

describe("getExampleFeedDocumentUrl", () => {
  it("appends the document format query param", () => {
    expect(getExampleFeedDocumentUrl("https://example.com")).toBe(
      `https://example.com${EXAMPLE_FEED_PATH}?format=document`,
    );
  });
});

describe("getDefaultPublicFeedUrl", () => {
  it("uses GARAGE_TEMP_FEED_URL when configured", () => {
    stubEnv("GARAGE_TEMP_FEED_URL", "https://feed.example.com/pull");

    expect(getDefaultPublicFeedUrl()).toBe("https://feed.example.com/pull");
  });

  it("trims whitespace and stray carriage returns from the configured feed url", () => {
    stubEnv("GARAGE_TEMP_FEED_URL", "  https://feed.example.com/pull\r\n  ");

    expect(getDefaultPublicFeedUrl()).toBe("https://feed.example.com/pull");
  });

  it("falls back to the default site's example feed url when unconfigured", () => {
    stubEnv("GARAGE_TEMP_FEED_URL", undefined);

    expect(getDefaultPublicFeedUrl()).toBe(`${DEFAULT_SITE_URL}${EXAMPLE_FEED_PATH}`);
  });

  it("falls back when the configured value is only whitespace", () => {
    stubEnv("GARAGE_TEMP_FEED_URL", "   ");

    expect(getDefaultPublicFeedUrl()).toBe(`${DEFAULT_SITE_URL}${EXAMPLE_FEED_PATH}`);
  });
});
