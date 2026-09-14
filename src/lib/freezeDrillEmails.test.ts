import { describe, expect, it } from "vitest";
import { buildFreezeDrillEmailParts } from "./freezeDrillEmails";

describe("buildFreezeDrillEmailParts", () => {
  it("renders readiness checks as separate list rows in HTML", () => {
    const parts = buildFreezeDrillEmailParts({
      score: 40,
      siteUrl: "https://thermaltrace.dev",
      checks: [
        { ok: false, label: "Alerts enabled (freeze + auto flood)" },
        { ok: true, label: "All probes reporting (not stale)" },
      ],
    });

    expect(parts.html).toContain("Readiness");
    expect(parts.html).toContain("40%");
    expect(parts.html).toContain("<ul");
    expect(parts.html).toMatch(/<li[^>]*>○ Alerts enabled \(freeze \+ auto flood\)<\/li>/);
    expect(parts.html).toMatch(/<li[^>]*>✓ All probes reporting \(not stale\)<\/li>/);
    expect(parts.html).not.toContain("○ Alerts enabled (freeze + auto flood) ○");
    expect(parts.text).toContain("○ Alerts enabled (freeze + auto flood)");
    expect(parts.text).toContain("✓ All probes reporting (not stale)");
    expect(parts.text).not.toContain("• ○");
  });
});
