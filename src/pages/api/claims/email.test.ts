import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromRequest = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromRequest: (...a: unknown[]) => mockGetAuthFromRequest(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("../../../lib/entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

const mockGetSiteUrl = vi.fn();
vi.mock("../../../lib/stripe", () => ({
  getSiteUrl: (...a: unknown[]) => mockGetSiteUrl(...a),
}));

const mockFormRedirectPath = vi.fn();
vi.mock("../../../lib/siteUrl", () => ({
  formRedirectPath: (...a: unknown[]) => mockFormRedirectPath(...a),
}));

const mockGenerateClaimsPackForUser = vi.fn();
vi.mock("../../../lib/claimsPackGenerate", () => ({
  generateClaimsPackForUser: (...a: unknown[]) => mockGenerateClaimsPackForUser(...a),
}));

const mockCreateClaimsPackExport = vi.fn();
vi.mock("../../../lib/claimsPackExports", () => ({
  createClaimsPackExport: (...a: unknown[]) => mockCreateClaimsPackExport(...a),
}));

const mockSendEmail = vi.fn();
const mockIsMailerRecipientNotAllowed = vi.fn();
vi.mock("../../../lib/mailer", () => ({
  sendEmail: (...a: unknown[]) => mockSendEmail(...a),
  isMailerRecipientNotAllowed: (...a: unknown[]) => mockIsMailerRecipientNotAllowed(...a),
}));

const mockBrandedEmailParts = vi.fn();
vi.mock("../../../lib/emailLayout", () => ({
  brandedEmailParts: (...a: unknown[]) => mockBrandedEmailParts(...a),
}));

function makeJsonContext(body: unknown | string): APIContext {
  const request = {
    headers: new Headers({ accept: "application/json" }),
    json: async () => {
      if (typeof body === "string") throw new Error("invalid");
      return body;
    },
  } as unknown as Request;
  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));
  return { request, cookies: {}, redirect } as unknown as APIContext;
}

function makeFormContext(form: Record<string, string>): APIContext {
  const formData = new FormData();
  for (const [k, v] of Object.entries(form)) formData.set(k, v);
  const request = {
    headers: new Headers(),
    formData: async () => formData,
  } as unknown as Request;
  const redirect = vi.fn((path: string) => new Response(null, { status: 302, headers: { Location: path } }));
  return { request, cookies: {}, redirect } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromRequest.mockReset().mockResolvedValue({
    session: { access_token: "at" },
    user: { id: "user-1", email: "user@example.com" },
  });
  mockGetUserEntitlements.mockReset().mockResolvedValue({ canUseClaimsPack: true });
  mockGetSiteUrl.mockReset().mockReturnValue("https://thermaltrace.dev/");
  mockFormRedirectPath.mockReset().mockReturnValue("/dashboard/history");
  mockGenerateClaimsPackForUser.mockReset().mockResolvedValue({
    pack: {
      householdLabel: "Garage",
      rangeFrom: "2024-01-01T00:00:00Z",
      rangeTo: "2024-01-31T00:00:00Z",
    },
    householdId: "house-1",
  });
  mockCreateClaimsPackExport.mockReset().mockResolvedValue({
    token: "tok-1",
    contentHash: "hash-1",
    error: null,
  });
  mockSendEmail.mockReset().mockResolvedValue(undefined);
  mockIsMailerRecipientNotAllowed.mockReset().mockReturnValue(false);
  mockBrandedEmailParts.mockReset().mockReturnValue({ text: "text body", html: "<p>html body</p>" });
});

describe("POST /api/claims/email", () => {
  it("returns 401 JSON when not authenticated and JSON is requested", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./email");

    const response = await POST(makeJsonContext({ adjuster_email: "a@example.com" }));

    expect(response.status).toBe(401);
  });

  it("redirects to /signin when not authenticated via form", async () => {
    mockGetAuthFromRequest.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./email");
    const context = makeFormContext({ adjuster_email: "a@example.com" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("./email");

    const response = await POST(makeJsonContext("not json"));

    expect(response.status).toBe(400);
  });

  it("returns pro_required when entitlement is missing (JSON)", async () => {
    mockGetUserEntitlements.mockResolvedValue({ canUseClaimsPack: false });
    const { POST } = await import("./email");

    const response = await POST(makeJsonContext({ adjuster_email: "a@example.com" }));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "pro_required" });
  });

  it("redirects with pro_required when entitlement is missing (form)", async () => {
    mockGetUserEntitlements.mockResolvedValue({ canUseClaimsPack: false });
    const { POST } = await import("./email");
    const context = makeFormContext({ adjuster_email: "a@example.com" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/history?claims_error=pro_required");
  });

  it("returns invalid_email when the address has no @", async () => {
    const { POST } = await import("./email");

    const response = await POST(makeJsonContext({ adjuster_email: "not-an-email" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_email" });
  });

  it("returns no_household when generation yields no household", async () => {
    mockGenerateClaimsPackForUser.mockResolvedValue({
      pack: { householdLabel: "Garage", rangeFrom: "2024-01-01", rangeTo: "2024-01-31" },
      householdId: null,
    });
    const { POST } = await import("./email");

    const response = await POST(makeJsonContext({ adjuster_email: "a@example.com" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "no_household" });
  });

  it("returns send_failed when the export can't be persisted", async () => {
    mockCreateClaimsPackExport.mockResolvedValue({ token: null, contentHash: null, error: "db down" });
    const { POST } = await import("./email");

    const response = await POST(makeJsonContext({ adjuster_email: "a@example.com" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "send_failed" });
  });

  it("returns recipient_not_allowed when the mailer rejects the recipient", async () => {
    mockIsMailerRecipientNotAllowed.mockReturnValue(true);
    mockSendEmail.mockRejectedValue(new Error("blocked"));
    const { POST } = await import("./email");

    const response = await POST(makeJsonContext({ adjuster_email: "a@example.com" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "recipient_not_allowed" });
  });

  it("returns send_failed when sendEmail throws for another reason", async () => {
    mockSendEmail.mockRejectedValue(new Error("smtp down"));
    const { POST } = await import("./email");

    const response = await POST(makeJsonContext({ adjuster_email: "a@example.com" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "send_failed" });
  });

  it("sends the email and returns the verify url and code (JSON)", async () => {
    const { POST } = await import("./email");

    const response = await POST(makeJsonContext({ adjuster_email: "a@example.com" }));
    const json = await response.json();

    expect(mockSendEmail).toHaveBeenCalledWith(
      "a@example.com",
      "Claims pack: Garage",
      "text body",
      { html: "<p>html body</p>" },
    );
    expect(json).toEqual({
      ok: true,
      verify_url: "https://thermaltrace.dev/api/claims/pack/tok-1",
      verification_code: "hash-1",
    });
  });

  it("redirects with claims_emailed=1 on success (form)", async () => {
    const { POST } = await import("./email");
    const context = makeFormContext({ adjuster_email: "a@example.com" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/dashboard/history?claims_emailed=1");
  });
});
