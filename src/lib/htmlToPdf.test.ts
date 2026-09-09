import { afterEach, describe, expect, it, vi } from "vitest";
import { env as cloudflareEnv } from "cloudflare:workers";

type FakeBrowserResponse = {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  text: () => Promise<string>;
  arrayBuffer: () => Promise<ArrayBuffer>;
};

function fakeResponse(overrides: Partial<FakeBrowserResponse> = {}): FakeBrowserResponse {
  return {
    ok: true,
    status: 200,
    headers: { get: () => "application/pdf" },
    text: () => Promise.resolve(""),
    arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
    ...overrides,
  };
}

const env = cloudflareEnv as unknown as Record<string, unknown>;

afterEach(() => {
  delete env.BROWSER;
  vi.restoreAllMocks();
});

describe("renderHtmlToPdf", () => {
  it("returns null when there is no BROWSER binding", async () => {
    const { renderHtmlToPdf } = await import("./htmlToPdf");

    expect(await renderHtmlToPdf("<p>hi</p>")).toBeNull();
  });

  it("posts the html with default pdf options and returns the response bytes", async () => {
    const quickAction = vi.fn().mockResolvedValue(fakeResponse());
    env.BROWSER = { quickAction };
    const { renderHtmlToPdf } = await import("./htmlToPdf");

    const result = await renderHtmlToPdf("<p>hi</p>");

    expect(result).toEqual(new Uint8Array([1, 2, 3]));
    expect(quickAction).toHaveBeenCalledWith("pdf", {
      html: "<p>hi</p>",
      pdfOptions: {
        format: "letter",
        printBackground: true,
        margin: { top: "0.5in", right: "0.5in", bottom: "0.5in", left: "0.5in" },
      },
    });
  });

  it("honors custom format and printBackground options", async () => {
    const quickAction = vi.fn().mockResolvedValue(fakeResponse());
    env.BROWSER = { quickAction };
    const { renderHtmlToPdf } = await import("./htmlToPdf");

    await renderHtmlToPdf("<p>hi</p>", { format: "a4", printBackground: false });

    const [, options] = quickAction.mock.calls[0]!;
    expect(options.pdfOptions.format).toBe("a4");
    expect(options.pdfOptions.printBackground).toBe(false);
  });

  it("returns null and logs when the response is not ok", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    env.BROWSER = {
      quickAction: vi.fn().mockResolvedValue(fakeResponse({ ok: false, status: 500 })),
    };
    const { renderHtmlToPdf } = await import("./htmlToPdf");

    expect(await renderHtmlToPdf("<p>hi</p>")).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns null and logs when the content type isn't a pdf", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    env.BROWSER = {
      quickAction: vi.fn().mockResolvedValue(
        fakeResponse({ headers: { get: () => "text/html" } }),
      ),
    };
    const { renderHtmlToPdf } = await import("./htmlToPdf");

    expect(await renderHtmlToPdf("<p>hi</p>")).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("returns null and logs when quickAction throws", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    env.BROWSER = { quickAction: vi.fn().mockRejectedValue(new Error("boom")) };
    const { renderHtmlToPdf } = await import("./htmlToPdf");

    expect(await renderHtmlToPdf("<p>hi</p>")).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith("Browser Run PDF error:", expect.any(Error));
  });
});
