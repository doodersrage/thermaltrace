import { describe, expect, it } from "vitest";
import {
  brandedEmailParts,
  buildBrandedEmailHtml,
  escapeEmailHtml,
} from "./emailLayout";
import { buildDripEmail } from "./dripEmails";
import { buildTrialReminderEmail } from "./trialEmails";

describe("emailLayout", () => {
  it("escapes HTML in titles and bodies", () => {
    expect(escapeEmailHtml(`<script>alert("x")</script>`)).not.toContain("<script>");
    const html = buildBrandedEmailHtml({
      title: `Freeze <alert>`,
      intro: `Check "north" wall & door`,
      cta: { label: "Open", url: "https://thermaltrace.dev/dashboard" },
    });
    expect(html).toContain("Freeze &lt;alert&gt;");
    expect(html).toContain("&quot;north&quot;");
    expect(html).toContain("Thermal");
    expect(html).toContain("Trace");
    expect(html).toContain("https://thermaltrace.dev/dashboard");
  });

  it("builds plain text with CTA URLs", () => {
    const parts = brandedEmailParts({
      title: "Hello",
      intro: "World",
      bullets: ["One"],
      cta: { label: "Go", url: "https://example.com/x" },
    });
    expect(parts.text).toContain("Hello");
    expect(parts.text).toContain("• One");
    expect(parts.text).toContain("Go: https://example.com/x");
  });

  it("keeps intro line breaks and checklist bullets on their own rows", () => {
    const html = buildBrandedEmailHtml({
      title: "Drill",
      intro: "Lead line.\n\nSecond line.",
      paragraphs: ["Readiness: 40%"],
      bullets: ["○ Alerts enabled", "✓ Probes reporting"],
    });
    expect(html).toContain("Lead line.<br /><br />Second line.");
    expect(html).toContain("<ul");
    expect(html).toContain("list-style:none");
    expect(html).toMatch(/<li[^>]*>○ Alerts enabled<\/li>/);
    expect(html).toMatch(/<li[^>]*>✓ Probes reporting<\/li>/);
    expect(html).not.toContain("○ Alerts enabled ○");
  });
});

describe("product email templates", () => {
  it("builds drip and trial multipart templates", () => {
    const drip = buildDripEmail("day1", "https://thermaltrace.dev");
    expect(drip.subject.toLowerCase()).toContain("probe");
    expect(drip.html).toContain("Open Devices");
    expect(drip.html).toContain("adding-devices");
    expect(drip.text).toContain("https://thermaltrace.dev/dashboard/devices");

    const trial = buildTrialReminderEmail({
      plan: "Pro",
      remaining: 3,
      siteUrl: "https://thermaltrace.dev",
    });
    expect(trial.subject).toContain("3 days");
    expect(trial.html).toContain("Trial reminder");
  });
});
