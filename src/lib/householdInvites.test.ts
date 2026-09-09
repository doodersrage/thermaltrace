import { beforeEach, describe, expect, it, vi } from "vitest";

function mockQuery(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "is", "gt", "order", "insert", "update", "delete", "upsert"]) {
    builder[method] = vi.fn(() => builder);
  }
  builder.single = vi.fn(() => Promise.resolve(result));
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

const mockAddHouseholdMemberByUserId = vi.fn();
const mockSetActiveHouseholdForUser = vi.fn();
vi.mock("./households", () => ({
  addHouseholdMemberByUserId: (...a: unknown[]) => mockAddHouseholdMemberByUserId(...a),
  setActiveHouseholdForUser: (...a: unknown[]) => mockSetActiveHouseholdForUser(...a),
}));

const mockSendEmail = vi.fn();
vi.mock("./mailer", () => ({
  sendEmail: (...a: unknown[]) => mockSendEmail(...a),
}));

vi.mock("./emailLayout", () => ({
  brandedEmailParts: () => ({ text: "plain text", html: "<p>html</p>" }),
}));

beforeEach(() => {
  mockFrom.mockReset();
  mockAddHouseholdMemberByUserId.mockReset().mockResolvedValue({ error: null });
  mockSetActiveHouseholdForUser.mockReset().mockResolvedValue({ error: null });
  mockSendEmail.mockReset().mockResolvedValue(undefined);
});

describe("parseHouseholdInviteRole", () => {
  it.each(["member", "viewer", "alert_only", "property_manager"])(
    "accepts the valid role '%s'",
    async (role) => {
      const { parseHouseholdInviteRole } = await import("./householdInvites");
      expect(parseHouseholdInviteRole(role)).toBe(role);
    },
  );

  it("trims whitespace before validating", async () => {
    const { parseHouseholdInviteRole } = await import("./householdInvites");
    expect(parseHouseholdInviteRole("  viewer  ")).toBe("viewer");
  });

  it("returns null for an invalid role", async () => {
    const { parseHouseholdInviteRole } = await import("./householdInvites");
    expect(parseHouseholdInviteRole("owner")).toBeNull();
  });

  it("returns null for empty/nullish input", async () => {
    const { parseHouseholdInviteRole } = await import("./householdInvites");
    expect(parseHouseholdInviteRole("")).toBeNull();
    expect(parseHouseholdInviteRole(null)).toBeNull();
    expect(parseHouseholdInviteRole(undefined)).toBeNull();
  });
});

describe("createHouseholdInvite", () => {
  it("normalizes the email and stores the invite", async () => {
    const builder = mockQuery({
      data: { id: "invite-1", household_id: "house-1", email: "a@b.com" },
      error: null,
    });
    mockFrom.mockReturnValue(builder);
    const { createHouseholdInvite } = await import("./householdInvites");

    const result = await createHouseholdInvite(
      "house-1",
      "  A@B.com  ",
      "user-1",
      3,
      "viewer",
    );

    expect(result.error).toBeNull();
    expect(result.invite?.id).toBe("invite-1");
    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        household_id: "house-1",
        email: "a@b.com",
        invited_by: "user-1",
        role: "viewer",
      }),
    );
  });

  it("defaults to a 7-day expiry and member role", async () => {
    const builder = mockQuery({ data: { id: "invite-2" }, error: null });
    mockFrom.mockReturnValue(builder);
    const { createHouseholdInvite } = await import("./householdInvites");

    await createHouseholdInvite("house-1", "a@b.com", "user-1");

    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ role: "member" }));
  });

  it("surfaces the database error", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: "duplicate invite" } }));
    const { createHouseholdInvite } = await import("./householdInvites");

    const result = await createHouseholdInvite("house-1", "a@b.com", "user-1");

    expect(result).toEqual({ invite: null, error: "duplicate invite" });
  });

  it("falls back to a generic error when there is no message", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: null }));
    const { createHouseholdInvite } = await import("./householdInvites");

    const result = await createHouseholdInvite("house-1", "a@b.com", "user-1");

    expect(result).toEqual({ invite: null, error: "Failed to create invite" });
  });
});

describe("listPendingInvites", () => {
  it("returns invites from supabase", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: [{ id: "i1" }], error: null }));
    const { listPendingInvites } = await import("./householdInvites");

    const result = await listPendingInvites("house-1");

    expect(result).toEqual({ invites: [{ id: "i1" }], error: null });
  });

  it("returns an empty array on error", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: { message: "boom" } }));
    const { listPendingInvites } = await import("./householdInvites");

    expect(await listPendingInvites("house-1")).toEqual({ invites: [], error: "boom" });
  });

  it("falls back to an empty array when data is null without error", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null, error: null }));
    const { listPendingInvites } = await import("./householdInvites");

    expect(await listPendingInvites("house-1")).toEqual({ invites: [], error: null });
  });
});

describe("getInviteByToken", () => {
  it("returns the invite when found", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: { id: "i1", token: "tok" } }));
    const { getInviteByToken } = await import("./householdInvites");

    expect(await getInviteByToken("tok")).toEqual({ id: "i1", token: "tok" });
  });

  it("returns null when not found", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null }));
    const { getInviteByToken } = await import("./householdInvites");

    expect(await getInviteByToken("missing")).toBeNull();
  });
});

describe("acceptHouseholdInvite", () => {
  function invite(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: "invite-1",
      household_id: "house-1",
      email: "member@example.com",
      token: "tok",
      invited_by: "owner-1",
      expires_at: "2099-01-01T00:00:00.000Z",
      accepted_at: null,
      created_at: "2020-01-01T00:00:00.000Z",
      role: "member",
      ...overrides,
    };
  }

  it("errors when the token does not resolve to an invite", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: null }));
    const { acceptHouseholdInvite } = await import("./householdInvites");

    const result = await acceptHouseholdInvite("tok", "user-1", "member@example.com");

    expect(result).toEqual({ householdId: null, error: "Invite not found" });
  });

  it("short-circuits successfully when the invite was already accepted", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: invite({ accepted_at: "2020-02-01T00:00:00.000Z" }) }));
    const { acceptHouseholdInvite } = await import("./householdInvites");

    const result = await acceptHouseholdInvite("tok", "user-1", "member@example.com");

    expect(result).toEqual({ householdId: "house-1", error: null });
    expect(mockAddHouseholdMemberByUserId).not.toHaveBeenCalled();
  });

  it("rejects an expired invite", async () => {
    mockFrom.mockReturnValue(
      mockQuery({ data: invite({ expires_at: "2000-01-01T00:00:00.000Z" }) }),
    );
    const { acceptHouseholdInvite } = await import("./householdInvites");

    const result = await acceptHouseholdInvite("tok", "user-1", "member@example.com");

    expect(result).toEqual({ householdId: null, error: "Invite expired" });
  });

  it("requires the signed-in email to match the invited email", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: invite() }));
    const { acceptHouseholdInvite } = await import("./householdInvites");

    const result = await acceptHouseholdInvite("tok", "user-1", "someone-else@example.com");

    expect(result).toEqual({
      householdId: null,
      error: "Sign in with the invited email address to accept",
    });
    expect(mockAddHouseholdMemberByUserId).not.toHaveBeenCalled();
  });

  it("rejects when there is no signed-in email at all", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: invite() }));
    const { acceptHouseholdInvite } = await import("./householdInvites");

    const result = await acceptHouseholdInvite("tok", "user-1", null);

    expect(result.error).toBe("Sign in with the invited email address to accept");
  });

  it("matches the invited email case-insensitively", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: invite() }));
    const { acceptHouseholdInvite } = await import("./householdInvites");

    const result = await acceptHouseholdInvite("tok", "user-1", "MEMBER@EXAMPLE.COM");

    expect(result.error).toBeNull();
  });

  it.each(["viewer", "alert_only", "property_manager"] as const)(
    "adds the member with the invite's '%s' role",
    async (role) => {
      mockFrom.mockReturnValue(mockQuery({ data: invite({ role }) }));
      const { acceptHouseholdInvite } = await import("./householdInvites");

      await acceptHouseholdInvite("tok", "user-1", "member@example.com");

      expect(mockAddHouseholdMemberByUserId).toHaveBeenCalledWith("house-1", "user-1", role);
    },
  );

  it("coerces an unrecognized role to member", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: invite({ role: "owner" }) }));
    const { acceptHouseholdInvite } = await import("./householdInvites");

    await acceptHouseholdInvite("tok", "user-1", "member@example.com");

    expect(mockAddHouseholdMemberByUserId).toHaveBeenCalledWith("house-1", "user-1", "member");
  });

  it("propagates an error from addHouseholdMemberByUserId without activating the household", async () => {
    mockFrom.mockReturnValue(mockQuery({ data: invite() }));
    mockAddHouseholdMemberByUserId.mockResolvedValue({ error: "already at device limit" });
    const { acceptHouseholdInvite } = await import("./householdInvites");

    const result = await acceptHouseholdInvite("tok", "user-1", "member@example.com");

    expect(result).toEqual({ householdId: null, error: "already at device limit" });
    expect(mockSetActiveHouseholdForUser).not.toHaveBeenCalled();
  });

  it("activates the household and marks the invite accepted on success", async () => {
    const builder = mockQuery({ data: invite() });
    mockFrom.mockReturnValue(builder);
    const { acceptHouseholdInvite } = await import("./householdInvites");

    const result = await acceptHouseholdInvite("tok", "user-1", "member@example.com");

    expect(result).toEqual({ householdId: "house-1", error: null });
    expect(mockSetActiveHouseholdForUser).toHaveBeenCalledWith("user-1", "house-1");
    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({ accepted_at: expect.any(String) }),
    );
  });
});

describe("revokeHouseholdInvite", () => {
  it("deletes the invite scoped to household and pending status", async () => {
    const builder = mockQuery({ error: null });
    mockFrom.mockReturnValue(builder);
    const { revokeHouseholdInvite } = await import("./householdInvites");

    const result = await revokeHouseholdInvite("house-1", "invite-1");

    expect(result).toEqual({ error: null });
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "invite-1");
    expect(builder.eq).toHaveBeenCalledWith("household_id", "house-1");
  });

  it("surfaces a delete error", async () => {
    mockFrom.mockReturnValue(mockQuery({ error: { message: "not allowed" } }));
    const { revokeHouseholdInvite } = await import("./householdInvites");

    expect(await revokeHouseholdInvite("house-1", "invite-1")).toEqual({ error: "not allowed" });
  });
});

describe("sendInviteEmail", () => {
  it("sends a branded invite email", async () => {
    const { sendInviteEmail } = await import("./householdInvites");

    await sendInviteEmail("a@b.com", "https://accept", "The Smiths", "owner@example.com");

    expect(mockSendEmail).toHaveBeenCalledWith(
      "a@b.com",
      "You're invited to The Smiths",
      "plain text",
      { html: "<p>html</p>" },
    );
  });

  it("swallows a mailer failure instead of throwing", async () => {
    mockSendEmail.mockRejectedValue(new Error("smtp down"));
    const { sendInviteEmail } = await import("./householdInvites");

    await expect(
      sendInviteEmail("a@b.com", "https://accept", "The Smiths", null),
    ).resolves.toBeUndefined();
  });
});
