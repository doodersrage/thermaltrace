import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockGetSiteUrl = vi.fn();
vi.mock("../../../lib/stripe", () => ({
  getSiteUrl: (...a: unknown[]) => mockGetSiteUrl(...a),
}));

const mockGenerateMonitoringCertificateForUser = vi.fn();
vi.mock("../../../lib/monitoringCertificateGenerate", () => ({
  generateMonitoringCertificateForUser: (...a: unknown[]) => mockGenerateMonitoringCertificateForUser(...a),
}));

const mockRenderDocumentPdf = vi.fn();
vi.mock("../../../lib/documentPdf", () => ({
  renderDocumentPdf: (...a: unknown[]) => mockRenderDocumentPdf(...a),
}));

function makeContext(search = ""): APIContext {
  return {
    cookies: {},
    request: new Request("https://example.com/api/monitoring/certificate"),
    url: new URL(`https://example.com/api/monitoring/certificate${search}`),
  } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "at" },
    user: { id: "user-1" },
  });
  mockGetSiteUrl.mockReset().mockReturnValue("https://thermaltrace.dev/");
  mockGenerateMonitoringCertificateForUser.mockReset().mockResolvedValue({
    html: "<html>cert</html>",
    data: { deviceCount: 2 },
    filenameBase: "thermaltrace-certificate",
    error: null,
  });
  mockRenderDocumentPdf.mockReset().mockResolvedValue({
    bytes: new Uint8Array([1, 2, 3]),
    source: "browser",
  });
});

describe("GET /api/monitoring/certificate", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./certificate");

    const response = await GET(makeContext());

    expect(response.status).toBe(401);
  });

  it("returns 400 when the certificate can't be generated", async () => {
    mockGenerateMonitoringCertificateForUser.mockResolvedValue({
      html: null,
      data: null,
      filenameBase: "cert",
      error: "no devices",
    });
    const { GET } = await import("./certificate");

    const response = await GET(makeContext());

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("no devices");
  });

  it("returns the HTML certificate when format=html", async () => {
    const { GET } = await import("./certificate");

    const response = await GET(makeContext("?format=html"));

    expect(response.headers.get("Content-Type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="thermaltrace-certificate.html"',
    );
    expect(await response.text()).toBe("<html>cert</html>");
    expect(mockRenderDocumentPdf).not.toHaveBeenCalled();
  });

  it("returns 503 when PDF generation is unavailable", async () => {
    mockRenderDocumentPdf.mockResolvedValue(null);
    const { GET } = await import("./certificate");

    const response = await GET(makeContext());

    expect(response.status).toBe(503);
  });

  it("returns the PDF by default", async () => {
    const { GET } = await import("./certificate");

    const response = await GET(makeContext());

    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="thermaltrace-certificate.pdf"',
    );
    expect(response.headers.get("X-Pdf-Source")).toBe("browser");
  });
});
