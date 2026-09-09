import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MonitoringCertificateData } from "./monitoringCertificate";

const mockRenderHtmlToPdf = vi.fn();
vi.mock("./htmlToPdf", () => ({
  renderHtmlToPdf: (...a: unknown[]) => mockRenderHtmlToPdf(...a),
}));

const mockBuildMonitoringCertificatePdf = vi.fn();
vi.mock("./monitoringCertificatePdf", () => ({
  buildMonitoringCertificatePdf: (...a: unknown[]) => mockBuildMonitoringCertificatePdf(...a),
}));

const fallback = { certificateId: "cert-1" } as unknown as MonitoringCertificateData;

beforeEach(() => {
  mockRenderHtmlToPdf.mockReset();
  mockBuildMonitoringCertificatePdf.mockReset();
});

describe("renderDocumentPdf", () => {
  it("prefers the browser-rendered pdf when available", async () => {
    mockRenderHtmlToPdf.mockResolvedValue(new Uint8Array([1, 2, 3]));
    const { renderDocumentPdf } = await import("./documentPdf");

    const result = await renderDocumentPdf({ html: "<p>hi</p>", monitoringFallback: fallback });

    expect(result).toEqual({ bytes: new Uint8Array([1, 2, 3]), source: "browser" });
    expect(mockRenderHtmlToPdf).toHaveBeenCalledWith("<p>hi</p>");
    expect(mockBuildMonitoringCertificatePdf).not.toHaveBeenCalled();
  });

  it("falls back to the programmatic builder when the browser render is unavailable", async () => {
    mockRenderHtmlToPdf.mockResolvedValue(null);
    mockBuildMonitoringCertificatePdf.mockResolvedValue(new Uint8Array([4, 5, 6]));
    const { renderDocumentPdf } = await import("./documentPdf");

    const result = await renderDocumentPdf({ html: "<p>hi</p>", monitoringFallback: fallback });

    expect(result).toEqual({ bytes: new Uint8Array([4, 5, 6]), source: "programmatic" });
    expect(mockBuildMonitoringCertificatePdf).toHaveBeenCalledWith(fallback);
  });

  it("returns null when the browser render fails and there is no fallback data", async () => {
    mockRenderHtmlToPdf.mockResolvedValue(null);
    const { renderDocumentPdf } = await import("./documentPdf");

    const result = await renderDocumentPdf({ html: "<p>hi</p>" });

    expect(result).toBeNull();
    expect(mockBuildMonitoringCertificatePdf).not.toHaveBeenCalled();
  });
});
