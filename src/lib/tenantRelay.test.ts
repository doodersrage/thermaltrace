import { beforeEach, describe, expect, it, vi } from "vitest";

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "update"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  (builder as { then: unknown }).then = (
    resolve: (value: unknown) => unknown,
    reject?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(resolve, reject);
  return builder;
}

const mockFrom = vi.fn();
vi.mock("./supabase", () => ({
  createServerClient: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
}));

const mockSendEmail = vi.fn();
vi.mock("./mailer", () => ({
  sendEmail: (...a: unknown[]) => mockSendEmail(...a),
}));

const mockBrandedEmailParts = vi.fn();
vi.mock("./emailLayout", () => ({
  brandedEmailParts: (...a: unknown[]) => mockBrandedEmailParts(...a),
}));

const mockResolveSiteUrl = vi.fn();
vi.mock("./schemaMarkup", () => ({
  resolveSiteUrl: (...a: unknown[]) => mockResolveSiteUrl(...a),
}));

const mockGetUserHouseholdRole = vi.fn();
const mockCanEditHousehold = vi.fn();
vi.mock("./households", () => ({
  getUserHouseholdRole: (...a: unknown[]) => mockGetUserHouseholdRole(...a),
  canEditHousehold: (...a: unknown[]) => mockCanEditHousehold(...a),
}));

beforeEach(() => {
  mockFrom.mockReset();
  mockSendEmail.mockReset().mockResolvedValue(undefined);
  mockBrandedEmailParts.mockReset().mockReturnValue({ text: "plain", html: "<p>html</p>" });
  mockResolveSiteUrl.mockReset().mockReturnValue("https://default.example");
  mockGetUserHouseholdRole.mockReset().mockResolvedValue("owner");
  mockCanEditHousehold.mockReset().mockReturnValue(true);
});

describe("getTenantNotifySettings", () => {
  it("returns trimmed email and name", async () => {
    mockFrom.mockReturnValue(
      mockQuery({ data: { tenant_notify_email: "  a@b.com  ", tenant_notify_name: "  Bo  " } }),
    );
    const { getTenantNotifySettings } = await import("./tenantRelay");

    expect(await getTenantNotifySettings("house-1")).toEqual({ email: "a@b.com", name: "Bo" });
  });

  it("returns nulls when there is no row or fields are blank", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null }));
    const { getTenantNotifySettings } = await import("./tenantRelay");

    expect(await getTenantNotifySettings("house-1")).toEqual({ email: null, name: null });
  });

  it("treats a whitespace-only value as absent", async () => {
    mockFrom.mockReturnValue(
      mockQuery({ data: { tenant_notify_email: "   ", tenant_notify_name: null } }),
    );
    const { getTenantNotifySettings } = await import("./tenantRelay");

    expect(await getTenantNotifySettings("house-1")).toEqual({ email: null, name: null });
  });
});

describe("updateTenantNotifySettings", () => {
  it("rejects an invalid email without touching the database", async () => {
    const { updateTenantNotifySettings } = await import("./tenantRelay");

    const result = await updateTenantNotifySettings("house-1", { email: "not-an-email", name: null });

    expect(result).toEqual({ error: "Invalid email address." });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("saves a trimmed valid email and name", async () => {
    const builder = mockQuery({ error: null });
    mockFrom.mockReturnValue(builder);
    const { updateTenantNotifySettings } = await import("./tenantRelay");

    const result = await updateTenantNotifySettings("house-1", {
      email: "  tenant@example.com  ",
      name: "  Alex  ",
    });

    expect(result).toEqual({ error: null });
    expect(builder.update).toHaveBeenCalledWith({
      tenant_notify_email: "tenant@example.com",
      tenant_notify_name: "Alex",
    });
  });

  it("clears both fields when given empty strings", async () => {
    const builder = mockQuery({ error: null });
    mockFrom.mockReturnValue(builder);
    const { updateTenantNotifySettings } = await import("./tenantRelay");

    await updateTenantNotifySettings("house-1", { email: "", name: "" });

    expect(builder.update).toHaveBeenCalledWith({
      tenant_notify_email: null,
      tenant_notify_name: null,
    });
  });

  it("surfaces a database error", async () => {
    mockFrom.mockReturnValue(mockQuery({ error: { message: "not allowed" } }));
    const { updateTenantNotifySettings } = await import("./tenantRelay");

    expect(
      await updateTenantNotifySettings("house-1", { email: "a@b.com", name: null }),
    ).toEqual({ error: "not allowed" });
  });
});

describe("sendTenantFreezeRelay", () => {
  const baseInput = {
    householdId: "house-1",
    managerUserId: "user-1",
    householdName: "The Smiths",
    alertTitle: "Garage freezing",
    alertBody: "Temp dropped below 32F",
  };

  it("refuses when the caller cannot edit the household", async () => {
    mockCanEditHousehold.mockReturnValue(false);
    const { sendTenantFreezeRelay } = await import("./tenantRelay");

    const result = await sendTenantFreezeRelay(baseInput);

    expect(result).toEqual({ ok: false, error: "Not authorized to notify tenant." });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("fails when there is no tenant contact configured", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null }));
    const { sendTenantFreezeRelay } = await import("./tenantRelay");

    const result = await sendTenantFreezeRelay(baseInput);

    expect(result).toEqual({ ok: false, error: "No tenant contact configured." });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("greets the tenant by name when one is on file", async () => {
    mockFrom.mockReturnValue(
      mockQuery({ data: { tenant_notify_email: "tenant@example.com", tenant_notify_name: "Alex" } }),
    );
    const { sendTenantFreezeRelay } = await import("./tenantRelay");

    await sendTenantFreezeRelay(baseInput);

    expect(mockBrandedEmailParts).toHaveBeenCalledWith(
      expect.objectContaining({
        intro: expect.stringContaining("Hi Alex,"),
      }),
    );
  });

  it("falls back to a generic greeting without a tenant name", async () => {
    mockFrom.mockReturnValue(
      mockQuery({ data: { tenant_notify_email: "tenant@example.com", tenant_notify_name: null } }),
    );
    const { sendTenantFreezeRelay } = await import("./tenantRelay");

    await sendTenantFreezeRelay(baseInput);

    expect(mockBrandedEmailParts).toHaveBeenCalledWith(
      expect.objectContaining({ intro: expect.stringContaining("Hello,") }),
    );
  });

  it("uses resolveSiteUrl when no siteUrl is provided, and the given one otherwise", async () => {
    mockFrom.mockReturnValue(
      mockQuery({ data: { tenant_notify_email: "tenant@example.com", tenant_notify_name: null } }),
    );
    const { sendTenantFreezeRelay } = await import("./tenantRelay");

    await sendTenantFreezeRelay(baseInput);
    expect(mockBrandedEmailParts).toHaveBeenCalledWith(
      expect.objectContaining({ cta: { label: "ThermalTrace", url: "https://default.example" } }),
    );

    mockBrandedEmailParts.mockClear();
    await sendTenantFreezeRelay({ ...baseInput, siteUrl: "https://custom.example" });
    expect(mockBrandedEmailParts).toHaveBeenCalledWith(
      expect.objectContaining({ cta: { label: "ThermalTrace", url: "https://custom.example" } }),
    );
  });

  it("sends the email with a bracketed household subject and returns ok", async () => {
    mockFrom.mockReturnValue(
      mockQuery({ data: { tenant_notify_email: "tenant@example.com", tenant_notify_name: null } }),
    );
    const { sendTenantFreezeRelay } = await import("./tenantRelay");

    const result = await sendTenantFreezeRelay(baseInput);

    expect(mockSendEmail).toHaveBeenCalledWith(
      "tenant@example.com",
      "[The Smiths] Garage freezing",
      "plain",
      { html: "<p>html</p>" },
    );
    expect(result).toEqual({ ok: true });
  });

  it("returns a delivery-failed error when sendEmail throws", async () => {
    mockFrom.mockReturnValue(
      mockQuery({ data: { tenant_notify_email: "tenant@example.com", tenant_notify_name: null } }),
    );
    mockSendEmail.mockRejectedValue(new Error("smtp down"));
    const { sendTenantFreezeRelay } = await import("./tenantRelay");

    const result = await sendTenantFreezeRelay(baseInput);

    expect(result).toEqual({ ok: false, error: "Email delivery failed." });
  });
});
