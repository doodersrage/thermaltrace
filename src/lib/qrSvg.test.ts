import { describe, expect, it } from "vitest";
import { renderIngestQrDataUrl, renderIngestQrSvg } from "./qrSvg";

describe("renderIngestQrSvg", () => {
  it("renders an svg tagged with the requested display size", () => {
    const svg = renderIngestQrSvg("https://example.com/ingest?key=abc", 150);

    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('width="150"');
    expect(svg).toContain('height="150"');
  });

  it("defaults to a 200x200 display size", () => {
    const svg = renderIngestQrSvg("https://example.com/ingest");

    expect(svg).toContain('width="200"');
    expect(svg).toContain('height="200"');
  });

  it("sets the outer <svg> tag's width/height to the requested size exactly once", () => {
    const svg = renderIngestQrSvg("https://example.com/ingest", 120);
    const openingTag = svg.match(/^<svg[^>]*>/)?.[0] ?? "";

    expect(openingTag.match(/width="120"/g)?.length).toBe(1);
    expect(openingTag.match(/height="120"/g)?.length).toBe(1);
  });

  it("produces different pixel data for different input text", () => {
    const a = renderIngestQrSvg("https://example.com/a", 100);
    const b = renderIngestQrSvg("https://example.com/b", 100);

    expect(a).not.toBe(b);
  });
});

describe("renderIngestQrDataUrl", () => {
  it("wraps the svg in a data: url that decodes back to the same markup", () => {
    const text = "https://example.com/ingest?key=abc";
    const dataUrl = renderIngestQrDataUrl(text, 120);

    expect(dataUrl.startsWith("data:image/svg+xml;charset=utf-8,")).toBe(true);

    const encoded = dataUrl.slice("data:image/svg+xml;charset=utf-8,".length);
    expect(decodeURIComponent(encoded)).toBe(renderIngestQrSvg(text, 120));
  });

  it("defaults to a 200x200 display size", () => {
    const dataUrl = renderIngestQrDataUrl("hello");
    const encoded = dataUrl.slice("data:image/svg+xml;charset=utf-8,".length);
    expect(decodeURIComponent(encoded)).toContain('width="200"');
  });
});
