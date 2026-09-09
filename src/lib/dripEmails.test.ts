import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockBrandedEmailParts = vi.fn();
vi.mock("./emailLayout", () => ({
  brandedEmailParts: (...a: unknown[]) => mockBrandedEmailParts(...a),
}));

const mockResolveSiteUrl = vi.fn();
vi.mock("./schemaMarkup", () => ({
  resolveSiteUrl: (...a: unknown[]) => mockResolveSiteUrl(...a),
}));

const mockSendEmail = vi.fn();
const mockIsMailerRecipientNotAllowed = vi.fn();
const mockPartitionMailErrors = vi.fn();
vi.mock("./mailer", () => ({
  sendEmail: (...a: unknown[]) => mockSendEmail(...a),
  isMailerRecipientNotAllowed: (...a: unknown[]) => mockIsMailerRecipientNotAllowed(...a),
  partitionMailErrors: (...a: unknown[]) => mockPartitionMailErrors(...a),
}));

const mockSelectEq = vi.fn();
const mockSelect = vi.fn(() => ({ eq: mockSelectEq }));
const mockUpdateEq = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect, update: mockUpdate }));
const mockGetUserById = vi.fn();
const mockAdmin = { from: mockFrom, auth: { admin: { getUserById: mockGetUserById } } };
vi.mock("./supabase", () => ({ createAdminClient: () => mockAdmin }));

beforeEach(() => {
  mockBrandedEmailParts.mockReset().mockImplementation((content: { title: string }) => ({
    text: `TEXT:${content.title}`,
    html: `HTML:${content.title}`,
  }));
  mockResolveSiteUrl.mockReset().mockReturnValue("https://thermaltrace.dev");
  mockSendEmail.mockReset().mockResolvedValue(undefined);
  mockIsMailerRecipientNotAllowed.mockReset().mockReturnValue(false);
  mockPartitionMailErrors.mockReset().mockReturnValue({ hardErrors: [], restrictedErrors: [] });
  mockSelectEq.mockReset().mockResolvedValue({ data: [] });
  mockUpdateEq.mockReset().mockResolvedValue({ error: null });
  mockGetUserById.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime("2024-06-15T12:00:00.000Z");
});

afterEach(() => {
  vi.useRealTimers();
});

describe("buildDripEmail", () => {
  it("builds the day1 email by default", async () => {
    const { buildDripEmail } = await import("./dripEmails");

    const mail = buildDripEmail("day1", "https://site.example");

    expect(mail.subject).toBe("Add your first probe to ThermalTrace");
    expect(mail.text).toBe("TEXT:Connect your first probe");
    expect(mail.html).toBe("HTML:Connect your first probe");
  });

  it("builds the day3 email", async () => {
    const { buildDripEmail } = await import("./dripEmails");

    const mail = buildDripEmail("day3", "https://site.example");

    expect(mail.subject).toBe("Turn on freeze and leak alerts before the next surprise");
  });

  it("builds the day7 email", async () => {
    const { buildDripEmail } = await import("./dripEmails");

    const mail = buildDripEmail("day7", "https://site.example");

    expect(mail.subject).toBe("Try Pro free — SMS, push, and more share scopes");
  });

  it("falls back to the resolved site url when none is given", async () => {
    const { buildDripEmail } = await import("./dripEmails");

    buildDripEmail("day1");

    expect(mockResolveSiteUrl).toHaveBeenCalledWith(null);
  });
});

describe("sendDripEmailsForAllUsers", () => {
  function row(overrides: Record<string, unknown> = {}) {
    return {
      user_id: "user-1",
      drip_emails_enabled: true,
      drip_email_stage: 0,
      last_drip_email_at: null,
      ...overrides,
    };
  }

  it("skips a row whose user has no email or no created_at", async () => {
    mockSelectEq.mockResolvedValue({ data: [row()] });
    mockGetUserById.mockResolvedValue({ data: { user: { email: null, created_at: "2024-06-14T00:00:00Z" } } });
    const { sendDripEmailsForAllUsers } = await import("./dripEmails");

    const result = await sendDripEmailsForAllUsers();

    expect(result).toEqual({ sent: 0, skipped: 1, errors: [], restricted: 0 });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("sends the day1 stage once the account is at least an hour old", async () => {
    mockSelectEq.mockResolvedValue({ data: [row()] });
    mockGetUserById.mockResolvedValue({
      data: { user: { email: "user@example.com", created_at: "2024-06-15T10:00:00.000Z" } },
    });
    const { sendDripEmailsForAllUsers } = await import("./dripEmails");

    const result = await sendDripEmailsForAllUsers();

    expect(mockSendEmail).toHaveBeenCalledWith(
      "user@example.com",
      "Add your first probe to ThermalTrace",
      expect.any(String),
      { html: expect.any(String) },
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ drip_email_stage: 1 }),
    );
    expect(mockUpdateEq).toHaveBeenCalledWith("user_id", "user-1");
    expect(result).toEqual({ sent: 1, skipped: 0, errors: [], restricted: 0 });
  });

  it("skips a row when the account is too young for the next stage", async () => {
    mockSelectEq.mockResolvedValue({ data: [row()] });
    mockGetUserById.mockResolvedValue({
      data: { user: { email: "user@example.com", created_at: "2024-06-15T11:59:30.000Z" } },
    });
    const { sendDripEmailsForAllUsers } = await import("./dripEmails");

    const result = await sendDripEmailsForAllUsers();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it("skips a row when the last drip email was sent under 20 hours ago", async () => {
    mockSelectEq.mockResolvedValue({
      data: [
        row({
          drip_email_stage: 0,
          last_drip_email_at: "2024-06-15T00:00:00.000Z",
        }),
      ],
    });
    mockGetUserById.mockResolvedValue({
      data: { user: { email: "user@example.com", created_at: "2024-06-01T00:00:00.000Z" } },
    });
    const { sendDripEmailsForAllUsers } = await import("./dripEmails");

    const result = await sendDripEmailsForAllUsers();

    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
  });

  it("counts a mailer-restricted error separately from other errors", async () => {
    mockSelectEq.mockResolvedValue({ data: [row()] });
    mockGetUserById.mockResolvedValue({
      data: { user: { email: "user@example.com", created_at: "2024-06-15T10:00:00.000Z" } },
    });
    mockSendEmail.mockRejectedValue(new Error("recipient not allowed"));
    mockIsMailerRecipientNotAllowed.mockReturnValue(true);
    const { sendDripEmailsForAllUsers } = await import("./dripEmails");

    const result = await sendDripEmailsForAllUsers();

    expect(result.restricted).toBe(1);
    expect(result.sent).toBe(0);
    expect(result.errors).toHaveLength(1);
  });

  it("records a generic send failure as an error without incrementing restricted", async () => {
    mockSelectEq.mockResolvedValue({ data: [row()] });
    mockGetUserById.mockResolvedValue({
      data: { user: { email: "user@example.com", created_at: "2024-06-15T10:00:00.000Z" } },
    });
    mockSendEmail.mockRejectedValue(new Error("smtp down"));
    mockIsMailerRecipientNotAllowed.mockReturnValue(false);
    const { sendDripEmailsForAllUsers } = await import("./dripEmails");

    const result = await sendDripEmailsForAllUsers();

    expect(result.restricted).toBe(0);
    expect(result.errors[0]).toContain("smtp down");
  });
});

describe("dripJobShouldFail", () => {
  it("returns true when partitionMailErrors reports hard errors", async () => {
    mockPartitionMailErrors.mockReturnValue({ hardErrors: ["boom"], restrictedErrors: [] });
    const { dripJobShouldFail } = await import("./dripEmails");

    expect(dripJobShouldFail(["boom"])).toBe(true);
  });

  it("returns false when there are no hard errors", async () => {
    mockPartitionMailErrors.mockReturnValue({ hardErrors: [], restrictedErrors: ["restricted"] });
    const { dripJobShouldFail } = await import("./dripEmails");

    expect(dripJobShouldFail(["restricted"])).toBe(false);
  });
});
