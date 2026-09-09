import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetSiteUrl = vi.fn();
vi.mock("../../../../lib/stripe", () => ({
  getSiteUrl: (...a: unknown[]) => mockGetSiteUrl(...a),
}));

const mockBuildClaimsPackHtml = vi.fn();
vi.mock("../../../../lib/claimsPack", () => ({
  buildClaimsPackHtml: (...a: unknown[]) => mockBuildClaimsPackHtml(...a),
}));

const mockComputeClaimsPackHash = vi.fn();
const mockGetClaimsPackExportByToken = vi.fn();
vi.mock("../../../../lib/claimsPackExports", () => ({
  computeClaimsPackHash: (...a: unknown[]) => mockComputeClaimsPackHash(...a),
  getClaimsPackExportByToken: (...a: unknown[]) => mockGetClaimsPackExportByToken(...a),
}));

function makeContext(token = "tok-1"): APIContext {
  return {
    params: { token },
    request: new Request("https://example.com/api/claims/pack/tok-1"),
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetSiteUrl.mockReset().mockReturnValue("https://thermaltrace.dev/");
  mockBuildClaimsPackHtml.mockReset().mockReturnValue("<html>pack</html>");
  mockComputeClaimsPackHash.mockReset().mockResolvedValue("hash-1");
  mockGetClaimsPackExportByToken.mockReset().mockResolvedValue({ householdLabel: "Garage" });
});

describe("GET /api/claims/pack/[token]", () => {
  it("returns 404 when the token is missing", async () => {
    const { GET } = await import("./[token]");

    const response = await GET(makeContext("   "));

    expect(response.status).toBe(404);
  });

  it("returns 404 when the export can't be found", async () => {
    mockGetClaimsPackExportByToken.mockResolvedValue(null);
    const { GET } = await import("./[token]");

    const response = await GET(makeContext());

    expect(response.status).toBe(404);
  });

  it("recomputes the hash and renders the pack with a verify url", async () => {
    const { GET } = await import("./[token]");

    const response = await GET(makeContext());

    expect(mockComputeClaimsPackHash).toHaveBeenCalledWith({ householdLabel: "Garage" });
    expect(mockBuildClaimsPackHtml).toHaveBeenCalledWith({
      householdLabel: "Garage",
      verifyUrl: "https://thermaltrace.dev/api/claims/pack/tok-1",
      contentHash: "hash-1",
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(await response.text()).toBe("<html>pack</html>");
  });
});
