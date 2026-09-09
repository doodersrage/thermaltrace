import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("../../../lib/entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

const mockGetSiteUrl = vi.fn();
vi.mock("../../../lib/stripe", () => ({
  getSiteUrl: (...a: unknown[]) => mockGetSiteUrl(...a),
}));

const mockBuildClaimsPackHtml = vi.fn();
vi.mock("../../../lib/claimsPack", () => ({
  buildClaimsPackHtml: (...a: unknown[]) => mockBuildClaimsPackHtml(...a),
}));

const mockGenerateClaimsPackForUser = vi.fn();
vi.mock("../../../lib/claimsPackGenerate", () => ({
  generateClaimsPackForUser: (...a: unknown[]) => mockGenerateClaimsPackForUser(...a),
}));

const mockCreateClaimsPackExport = vi.fn();
vi.mock("../../../lib/claimsPackExports", () => ({
  createClaimsPackExport: (...a: unknown[]) => mockCreateClaimsPackExport(...a),
}));

const mockRenderDocumentPdf = vi.fn();
vi.mock("../../../lib/documentPdf", () => ({
  renderDocumentPdf: (...a: unknown[]) => mockRenderDocumentPdf(...a),
}));

function makeContext(search = ""): APIContext {
  return {
    cookies: {},
    request: new Request("https://example.com/api/claims/pack"),
    url: new URL(`https://example.com/api/claims/pack${search}`),
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "at" },
    user: { id: "user-1" },
  });
  mockGetUserEntitlements.mockReset().mockResolvedValue({ canUseClaimsPack: true });
  mockGetSiteUrl.mockReset().mockReturnValue("https://thermaltrace.dev/");
  mockBuildClaimsPackHtml.mockReset().mockReturnValue("<html>pack</html>");
  mockGenerateClaimsPackForUser.mockReset().mockResolvedValue({
    pack: { householdLabel: "Garage" },
    householdId: "house-1",
    fromQ: "2024-01-01",
    toQ: "2024-01-31",
  });
  mockCreateClaimsPackExport.mockReset().mockResolvedValue({ token: "tok-1", contentHash: "hash-1" });
  mockRenderDocumentPdf.mockReset().mockResolvedValue({
    bytes: new Uint8Array([1, 2, 3]),
    source: "browser",
  });
});

describe("GET /api/claims/pack", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./pack");

    const response = await GET(makeContext());

    expect(response.status).toBe(401);
  });

  it("returns 403 when the plan lacks claims pack access", async () => {
    mockGetUserEntitlements.mockResolvedValue({ canUseClaimsPack: false });
    const { GET } = await import("./pack");

    const response = await GET(makeContext());

    expect(response.status).toBe(403);
  });

  it("embeds a verify url and hash when the export can be persisted", async () => {
    const { GET } = await import("./pack");

    await GET(makeContext());

    expect(mockBuildClaimsPackHtml).toHaveBeenCalledWith(
      expect.objectContaining({
        verifyUrl: "https://thermaltrace.dev/api/claims/pack/tok-1",
        contentHash: "hash-1",
      }),
    );
  });

  it("falls back to the ungenerated pack when there's no household", async () => {
    mockGenerateClaimsPackForUser.mockResolvedValue({
      pack: { householdLabel: "Garage" },
      householdId: null,
      fromQ: "2024-01-01",
      toQ: "2024-01-31",
    });
    const { GET } = await import("./pack");

    await GET(makeContext());

    expect(mockCreateClaimsPackExport).not.toHaveBeenCalled();
    expect(mockBuildClaimsPackHtml).toHaveBeenCalledWith({ householdLabel: "Garage" });
  });

  it("returns the HTML pack when format=html", async () => {
    const { GET } = await import("./pack");

    const response = await GET(makeContext("?format=html"));

    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="thermaltrace-claims-2024-01-01-to-2024-01-31.html"',
    );
    expect(await response.text()).toBe("<html>pack</html>");
    expect(mockRenderDocumentPdf).not.toHaveBeenCalled();
  });

  it("returns 503 when PDF generation is unavailable", async () => {
    mockRenderDocumentPdf.mockResolvedValue(null);
    const { GET } = await import("./pack");

    const response = await GET(makeContext());

    expect(response.status).toBe(503);
  });

  it("returns the PDF by default", async () => {
    const { GET } = await import("./pack");

    const response = await GET(makeContext());

    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="thermaltrace-claims-2024-01-01-to-2024-01-31.pdf"',
    );
    expect(response.headers.get("X-Pdf-Source")).toBe("browser");
  });
});
