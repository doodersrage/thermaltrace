import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockIsUserAdmin = vi.fn();
vi.mock("../../../lib/adminAccess", () => ({
  isUserAdmin: (...a: unknown[]) => mockIsUserAdmin(...a),
}));

const mockBuildContactsCsv = vi.fn();
const mockFetchAllContactSubmissions = vi.fn();
vi.mock("../../../lib/contactSubmissions", () => ({
  buildContactsCsv: (...a: unknown[]) => mockBuildContactsCsv(...a),
  fetchAllContactSubmissions: (...a: unknown[]) => mockFetchAllContactSubmissions(...a),
}));

function makeContext(): APIContext {
  return { cookies: {} } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "t" },
    user: { id: "user-1" },
  });
  mockIsUserAdmin.mockReset().mockResolvedValue(true);
  mockFetchAllContactSubmissions.mockReset().mockResolvedValue({ submissions: [], error: null });
  mockBuildContactsCsv.mockReset().mockReturnValue("name,email,message\n");
});

describe("GET /api/contacts/export.csv", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./export.csv");

    const response = await GET(makeContext());

    expect(response.status).toBe(401);
    expect(mockIsUserAdmin).not.toHaveBeenCalled();
  });

  it("returns 403 when the user isn't an admin", async () => {
    mockIsUserAdmin.mockResolvedValue(false);
    const { GET } = await import("./export.csv");

    const response = await GET(makeContext());

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Forbidden");
  });

  it("returns 500 with the error text when fetching submissions fails", async () => {
    mockFetchAllContactSubmissions.mockResolvedValue({ submissions: [], error: "db down" });
    const { GET } = await import("./export.csv");

    const response = await GET(makeContext());

    expect(response.status).toBe(500);
    expect(await response.text()).toBe("db down");
  });

  it("returns the built csv with the correct headers", async () => {
    mockBuildContactsCsv.mockReturnValue("name,email,message\nJane,a@b.com,hi\n");
    const { GET } = await import("./export.csv");

    const response = await GET(makeContext());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toContain(
      "attachment; filename=\"contact-submissions-",
    );
    expect(await response.text()).toBe("name,email,message\nJane,a@b.com,hi\n");
  });
});
