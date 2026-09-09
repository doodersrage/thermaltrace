import { describe, expect, it } from "vitest";
import { escapeHtml } from "./htmlEscape";

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("a & b & c")).toBe("a &amp; b &amp; c");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("escapes double and single quotes", () => {
    expect(escapeHtml(`say "hi" & 'bye'`)).toBe("say &quot;hi&quot; &amp; &#39;bye&#39;");
  });

  it("leaves safe text unchanged", () => {
    expect(escapeHtml("Bay 1 reading 32F")).toBe("Bay 1 reading 32F");
  });

  it("escapes already-escaped ampersands again", () => {
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });
});
