import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

vi.mock("cloudflare:email", () => ({
  EmailMessage: class {
    constructor(
      public from: string,
      public to: string,
      public raw: string,
    ) {}
  },
}));

const mockCreateServerClient = vi.fn();
const mockInsert = vi.fn();
vi.mock("../../lib/supabase", () => ({
  createServerClient: () => mockCreateServerClient(),
}));

const mockGetTurnstileToken = vi.fn();
const mockVerifyTurnstileToken = vi.fn();
vi.mock("../../lib/turnstile", () => ({
  getTurnstileToken: (...a: unknown[]) => mockGetTurnstileToken(...a),
  verifyTurnstileToken: (...a: unknown[]) => mockVerifyTurnstileToken(...a),
}));

const mockRequireSmtpMailFrom = vi.fn();
const mockSendMailerRaw = vi.fn();
vi.mock("../../lib/mailer", () => ({
  requireSmtpMailFrom: () => mockRequireSmtpMailFrom(),
  sendMailerRaw: (...a: unknown[]) => mockSendMailerRaw(...a),
}));

const mockCheckContactRateLimit = vi.fn();
const mockIsContactHoneypotTriggered = vi.fn();
vi.mock("../../lib/contactLimits", () => ({
  CONTACT_HONEYPOT_FIELD: "company",
  CONTACT_MAX_MESSAGE_CHARS: 8000,
  checkContactRateLimit: (...a: unknown[]) => mockCheckContactRateLimit(...a),
  isContactHoneypotTriggered: (...a: unknown[]) => mockIsContactHoneypotTriggered(...a),
}));

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

function makeContext(fields: Record<string, string>, clientAddress = "1.2.3.4"): APIContext {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  const request = { formData: () => Promise.resolve(form) } as unknown as Request;
  return { request, clientAddress } as unknown as APIContext;
}

function validFields(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    name: "Jane Doe",
    email: "jane@example.com",
    message: "Hello there",
    ...overrides,
  };
}

beforeEach(() => {
  mockIsContactHoneypotTriggered.mockReset().mockReturnValue(false);
  mockCheckContactRateLimit.mockReset().mockReturnValue({ ok: true });
  mockGetTurnstileToken.mockReset().mockReturnValue("token");
  mockVerifyTurnstileToken.mockReset().mockResolvedValue({ success: true });
  mockRequireSmtpMailFrom.mockReset().mockReturnValue("noreply@thermaltrace.dev");
  mockSendMailerRaw.mockReset().mockResolvedValue(undefined);
  mockInsert.mockReset().mockResolvedValue({ error: null });
  mockCreateServerClient.mockReset().mockReturnValue({
    from: () => ({ insert: mockInsert }),
  });
  stubEnv("SMTP_MAIL_TO", "support@thermaltrace.dev");
});

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
  vi.restoreAllMocks();
});

describe("POST /api/contact", () => {
  it("silently succeeds without sending mail when the honeypot is triggered", async () => {
    mockIsContactHoneypotTriggered.mockReturnValue(true);
    const { POST } = await import("./contact");

    const response = await POST(makeContext(validFields({ company: "spambot" })));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      message: "Thanks, we got your message. We usually reply within 1–2 business days.",
    });
    expect(mockSendMailerRaw).not.toHaveBeenCalled();
    expect(mockCheckContactRateLimit).not.toHaveBeenCalled();
  });

  it("returns 429 with Retry-After when rate limited", async () => {
    mockCheckContactRateLimit.mockReturnValue({ ok: false, error: "Slow down.", retryAfterSec: 60 });
    const { POST } = await import("./contact");

    const response = await POST(makeContext(validFields()));

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(await response.json()).toEqual({ message: "Slow down." });
  });

  it("returns 400 when Turnstile verification fails", async () => {
    mockVerifyTurnstileToken.mockResolvedValue({ success: false, error: "Bad token." });
    const { POST } = await import("./contact");

    const response = await POST(makeContext(validFields()));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "Bad token." });
  });

  it("falls back to a generic message when Turnstile fails without an error string", async () => {
    mockVerifyTurnstileToken.mockResolvedValue({ success: false });
    const { POST } = await import("./contact");

    const response = await POST(makeContext(validFields()));

    expect(await response.json()).toEqual({ message: "Verification failed." });
  });

  it("returns 400 when required fields are missing", async () => {
    const { POST } = await import("./contact");

    const response = await POST(makeContext({ name: "Jane" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "Missing required fields." });
  });

  it("returns 400 when the message exceeds the max length", async () => {
    const { POST } = await import("./contact");

    const response = await POST(makeContext(validFields({ message: "x".repeat(8001) })));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: "Message is too long." });
  });

  it("returns 503 when no mail recipient is configured", async () => {
    stubEnv("SMTP_MAIL_TO", undefined);
    const { POST } = await import("./contact");

    const response = await POST(makeContext(validFields()));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ message: "Mail recipient is not configured." });
  });

  it("sends the email, stores the submission, and returns success", async () => {
    const { POST } = await import("./contact");

    const response = await POST(makeContext(validFields()));

    expect(response.status).toBe(200);
    expect(mockSendMailerRaw).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledWith([
      { name: "Jane Doe", email: "jane@example.com", message: "Hello there" },
    ]);
    expect(await response.json()).toEqual({
      success: true,
      message: "Thanks, we got your message. We usually reply within 1–2 business days.",
    });
  });

  it("still returns success even when storing the submission fails", async () => {
    mockInsert.mockResolvedValue({ error: { message: "db down" } });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("./contact");

    const response = await POST(makeContext(validFields()));

    expect(response.status).toBe(200);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns 500 when sending mail throws", async () => {
    mockSendMailerRaw.mockRejectedValue(new Error("smtp down"));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { POST } = await import("./contact");

    const response = await POST(makeContext(validFields()));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      message: "Failed to send message. Please try again.",
    });
    expect(errorSpy).toHaveBeenCalled();
  });
});
