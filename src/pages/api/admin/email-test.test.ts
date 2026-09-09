import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockIsUserAdmin = vi.fn();
vi.mock("../../../lib/adminAccess", () => ({
  isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a),
}));

const mockGetUserById = vi.fn();
vi.mock("../../../lib/supabase", () => ({
  createAdminClient: () => ({ auth: { admin: { getUserById: (...a: unknown[]) => mockGetUserById(...a) } } }),
}));

const mockResolveSiteUrl = vi.fn();
vi.mock("../../../lib/schemaMarkup", () => ({
  resolveSiteUrl: (...a: unknown[]) => mockResolveSiteUrl(...a),
}));

const mockBuildDripEmail = vi.fn();
vi.mock("../../../lib/dripEmails", () => ({
  buildDripEmail: (...a: unknown[]) => mockBuildDripEmail(...a),
}));

const mockBuildTrialReminderEmail = vi.fn();
vi.mock("../../../lib/trialEmails", () => ({
  buildTrialReminderEmail: (...a: unknown[]) => mockBuildTrialReminderEmail(...a),
}));

const mockSendEmail = vi.fn();
vi.mock("../../../lib/mailer", () => ({
  sendEmail: (...a: unknown[]) => mockSendEmail(...a),
}));

// import.meta.env is a Proxy that stringifies assigned values, so setting a
// key to `undefined` stores the literal string "undefined" rather than
// clearing it. Always `delete` a key to represent "unset".
const env = import.meta.env as unknown as Record<string, string | undefined>;
const savedFrom = env.SMTP_MAIL_FROM;

function makeContext(form: Record<string, string> | null): APIContext {
  const request = {
    formData: async () => {
      if (form === null) throw new Error("no form");
      const fd = new FormData();
      for (const [k, v] of Object.entries(form)) fd.set(k, v);
      return fd;
    },
  } as unknown as Request;
  return { request, cookies: {} } as unknown as APIContext;
}

beforeEach(() => {
  vi.resetModules();
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1", email: "user@example.com" },
  });
  mockIsUserAdmin.mockReset().mockResolvedValue(true);
  mockGetUserById.mockReset().mockResolvedValue({ data: { user: { email: "user@example.com" } } });
  mockResolveSiteUrl.mockReset().mockReturnValue("https://thermaltrace.dev");
  mockBuildDripEmail.mockReset().mockReturnValue({ subject: "Drip", text: "text", html: "<p>html</p>" });
  mockBuildTrialReminderEmail.mockReset().mockReturnValue({ subject: "Trial", text: "text", html: "<p>html</p>" });
  mockSendEmail.mockReset().mockResolvedValue(undefined);
  env.SMTP_MAIL_FROM = "noreply@thermaltrace.dev";
});

afterEach(() => {
  if (savedFrom === undefined) delete env.SMTP_MAIL_FROM;
  else env.SMTP_MAIL_FROM = savedFrom;
});

describe("POST /api/admin/email-test", () => {
  it("returns 403 when not an admin", async () => {
    mockIsUserAdmin.mockResolvedValue(false);
    const { POST } = await import("./email-test");

    const response = await POST(makeContext({}));

    expect(response.status).toBe(403);
  });

  it("returns 400 when there's no email on the account", async () => {
    mockGetUserById.mockResolvedValue({ data: { user: { email: null } } });
    mockGetAuthFromCookies.mockResolvedValue({
      session: { access_token: "tok" },
      user: { id: "user-1", email: undefined },
    });
    const { POST } = await import("./email-test");

    const response = await POST(makeContext({}));

    expect(response.status).toBe(400);
  });

  it("returns 503 when SMTP_MAIL_FROM isn't configured", async () => {
    delete env.SMTP_MAIL_FROM;
    const { POST } = await import("./email-test");

    const response = await POST(makeContext({}));

    expect(response.status).toBe(503);
  });

  it("defaults to the drip_day1 template", async () => {
    const { POST } = await import("./email-test");

    await POST(makeContext(null));

    expect(mockBuildDripEmail).toHaveBeenCalledWith("day1", "https://thermaltrace.dev");
    expect(mockSendEmail).toHaveBeenCalledWith(
      "user@example.com",
      "[Test] Drip",
      "text",
      { html: "<p>html</p>" },
    );
  });

  it("builds the drip_day3 template", async () => {
    const { POST } = await import("./email-test");

    await POST(makeContext({ kind: "drip_day3" }));

    expect(mockBuildDripEmail).toHaveBeenCalledWith("day3", "https://thermaltrace.dev");
  });

  it("builds the trial_3d template with the expected args", async () => {
    const { POST } = await import("./email-test");

    await POST(makeContext({ kind: "trial_3d" }));

    expect(mockBuildTrialReminderEmail).toHaveBeenCalledWith({
      plan: "Pro",
      remaining: 3,
      siteUrl: "https://thermaltrace.dev",
    });
    expect(mockSendEmail).toHaveBeenCalledWith(
      "user@example.com",
      "[Test] Trial",
      "text",
      { html: "<p>html</p>" },
    );
  });

  it("falls back to drip_day1 for an unrecognized kind", async () => {
    const { POST } = await import("./email-test");

    await POST(makeContext({ kind: "bogus" }));

    expect(mockBuildDripEmail).toHaveBeenCalledWith("day1", "https://thermaltrace.dev");
  });

  it("redirects to the ops page on success", async () => {
    const { POST } = await import("./email-test");

    const response = await POST(makeContext({}));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/dashboard/ops?email_test=1");
  });

  it("returns 500 with the error message when sendEmail throws an Error", async () => {
    mockSendEmail.mockRejectedValue(new Error("smtp exploded"));
    const { POST } = await import("./email-test");

    const response = await POST(makeContext({}));

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("smtp exploded");
  });

  it("returns 500 with a generic message when sendEmail throws a non-Error", async () => {
    mockSendEmail.mockRejectedValue("nope");
    const { POST } = await import("./email-test");

    const response = await POST(makeContext({}));

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Send failed");
  });
});
