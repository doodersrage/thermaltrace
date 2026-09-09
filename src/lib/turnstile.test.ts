import { afterEach, describe, expect, it, vi } from "vitest";
import { getTurnstileToken, verifyTurnstileToken } from "./turnstile";

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

function jsonResponse(body: unknown): Response {
  return { json: () => Promise.resolve(body) } as Response;
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
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("verifyTurnstileToken", () => {
  it("fails fast when there is no token", async () => {
    const result = await verifyTurnstileToken(null);
    expect(result).toEqual({ success: false, error: "Missing Turnstile verification." });
  });

  it("fails fast for an undefined token", async () => {
    const result = await verifyTurnstileToken(undefined);
    expect(result).toEqual({ success: false, error: "Missing Turnstile verification." });
  });

  it("passes verification when no secret is configured (dev/local escape hatch)", async () => {
    stubEnv("TURNSTILE_SECRET_TOKEN", undefined);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyTurnstileToken("some-token");

    expect(result).toEqual({ success: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("posts the token and secret to the Cloudflare siteverify endpoint", async () => {
    stubEnv("TURNSTILE_SECRET_TOKEN", "secret-value");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await verifyTurnstileToken("some-token", "1.2.3.4");

    expect(result).toEqual({ success: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(init.method).toBe("POST");
    const body = init.body as FormData;
    expect(body.get("secret")).toBe("secret-value");
    expect(body.get("response")).toBe("some-token");
    expect(body.get("remoteip")).toBe("1.2.3.4");
  });

  it("omits remoteip when it isn't provided", async () => {
    stubEnv("TURNSTILE_SECRET_TOKEN", "secret-value");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true }));
    vi.stubGlobal("fetch", fetchMock);

    await verifyTurnstileToken("some-token");

    const [, init] = fetchMock.mock.calls[0]!;
    const body = init.body as FormData;
    expect(body.get("remoteip")).toBeNull();
  });

  it("reports failure when Cloudflare rejects the token", async () => {
    stubEnv("TURNSTILE_SECRET_TOKEN", "secret-value");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: false })));

    const result = await verifyTurnstileToken("bad-token");

    expect(result).toEqual({ success: false, error: "Turnstile verification failed." });
  });
});

describe("getTurnstileToken", () => {
  it("reads the cf-turnstile-response field from form data", () => {
    const form = new FormData();
    form.set("cf-turnstile-response", "the-token");

    expect(getTurnstileToken(form)).toBe("the-token");
  });

  it("returns null when the field is missing", () => {
    const form = new FormData();
    expect(getTurnstileToken(form)).toBeNull();
  });
});
