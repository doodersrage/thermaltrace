import { test, expect } from "@playwright/test";

test.describe("public smoke", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ThermalTrace/i);
    await expect(page.getByText(/Garage & workshop sensor monitoring/i)).toBeVisible();
    await expect(page.getByText(/Know before your pipes freeze/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Free forever/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Install the web app/i })).toBeVisible();
    await expect(page.getByText(/Freeze and leak alerts on every plan/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /Open the guides hub/i })).toBeVisible();
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(jsonLd.some((block) => block.includes('"FAQPage"'))).toBe(true);
  });

  test("pricing page loads", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: /Plans that grow/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Full feature comparison/i })).toBeVisible();
    await expect(page.getByText("Threshold freeze and leak alerts", { exact: true })).toBeVisible();
    await expect(page.getByText("1 family live link").first()).toBeVisible();
    const wrap = page.locator("#plan-matrix .plan-comparison-wrap");
    const { scrollHeight, clientHeight } = await wrap.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(scrollHeight).toBe(clientHeight);
  });

  test("pricing comparison table scrolls horizontally on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/pricing");
    const wrap = page.locator("#plan-matrix .plan-comparison-wrap");
    await expect(page.getByText(/Swipe sideways to compare/i)).toBeVisible();
    const box = await wrap.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      overflowX: getComputedStyle(el).overflowX,
    }));
    expect(box.scrollWidth).toBeGreaterThan(box.clientWidth);
    expect(["auto", "scroll"]).toContain(box.overflowX);
  });

  test("pricing page billing interval toggle", async ({ page }) => {
    await page.goto("/pricing");
    const monthlyBtn = page.getByRole("button", { name: "Monthly" });
    const annualBtn = page.getByRole("button", { name: /Annual/i });
    await expect(monthlyBtn).toBeVisible();
    await expect(annualBtn).toBeVisible();

    const memberAmount = page.locator(".plan-tier-card-featured .plan-tier-amount");
    const memberPeriod = page.locator(".plan-tier-card-featured .plan-tier-period");
    const proCard = page.locator(".plan-tier-grid .plan-tier-card").nth(2);
    const proAmount = proCard.locator(".plan-tier-amount");
    const proPeriod = proCard.locator(".plan-tier-period");

    await monthlyBtn.click();
    await expect(monthlyBtn).toHaveAttribute("aria-pressed", "true");
    await expect(memberPeriod).toHaveText("/mo");
    await expect(proPeriod).toHaveText("/mo");
    const monthlyMember = (await memberAmount.innerText()).trim();
    const monthlyPro = (await proAmount.innerText()).trim();

    await annualBtn.click();
    await expect(annualBtn).toHaveAttribute("aria-pressed", "true");
    await expect(memberPeriod).toHaveText("/yr");
    await expect(proPeriod).toHaveText("/yr");
    await expect(memberAmount).not.toHaveText(monthlyMember);
    await expect(proAmount).not.toHaveText(monthlyPro);
  });

  test("500 error page loads", async ({ page }) => {
    await page.goto("/500");
    await expect(page.getByRole("heading", { name: /Something went wrong/i })).toBeVisible();
  });

  test("compare page loads", async ({ page }) => {
    await page.goto("/compare");
    await expect(page.getByRole("heading", { name: /Built for homeowners/i })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Govee / SmartThings" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Full feature matrix/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Open the plan comparison/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /See plans & pricing/i }).first()).toBeVisible();
  });

  test("case study CTA links to pricing", async ({ page }) => {
    await page.goto("/stories/garage-freeze-alert");
    await expect(page.getByRole("heading", { name: /pipes froze/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /See plans & pricing/i })).toBeVisible();
  });

  test("system status page loads", async ({ page }) => {
    await page.goto("/system-status");
    await expect(page.getByRole("heading", { name: /System status/i })).toBeVisible();
  });

  test("API docs page loads", async ({ page }) => {
    await page.goto("/docs/api");
    await expect(page.getByRole("heading", { name: /API documentation/i })).toBeVisible();
  });

  test("guides hub loads", async ({ page }) => {
    await page.goto("/guides");
    await expect(
      page.getByRole("heading", { name: /Set up probes, freeze\/flood alerts/i }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hardware setup" })).toBeVisible();
  });

  test("about hub loads", async ({ page }) => {
    await page.goto("/about/");
    await expect(page.getByRole("heading", { name: /About ThermalTrace/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Start here/i })).toBeVisible();
  });

  test("about guide loads", async ({ page }) => {
    await page.goto("/about/temperature-probes/");
    await expect(page.getByRole("heading", { name: /Temperature probes/i })).toBeVisible();
  });

  test("contact page routes support vs GitHub", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: /Get in touch/i })).toBeVisible();
    await expect(page.getByText(/usually reply within 1–2 business days/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /This form/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /GitHub issues/i })).toBeVisible();
    const issues = page.getByRole("link", { name: /GitHub issues/i }).first();
    await expect(issues).toHaveAttribute("href", /github.com\/doodersrage\/thermaltrace\/issues/);
    await expect(page.getByLabel(/Name/i)).toBeVisible();
    await expect(page.getByText("Protected by Cloudflare Turnstile.")).toBeVisible();
    await page.getByRole("button", { name: /Send message/i }).click();
    await expect(page.locator("#name")).toHaveJSProperty("validity.valueMissing", true);
  });

  test("privacy page loads", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("heading", { name: /Privacy/i })).toBeVisible();
  });

  test("terms page loads", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.getByRole("heading", { name: /Terms of service/i })).toBeVisible();
  });

  test("404 page loads", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist-thermaltrace");
    expect(res?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /Page not found/i })).toBeVisible();
  });

  test("Zapier integration docs load", async ({ page }) => {
    await page.goto("/about/zapier-make-recipes");
    await expect(page.getByRole("heading", { name: /Zapier.*Make/i })).toBeVisible();
  });

  test("integrations hub loads", async ({ page }) => {
    await page.goto("/integrations");
    await expect(page.getByRole("heading", { name: /Wire ThermalTrace into your stack/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /Home Assistant \(HACS\)/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: /Nest & Ecobee/i })).toBeVisible();
  });

  test("Home Assistant integration page loads", async ({ page }) => {
    await page.goto("/integrations/home-assistant");
    await expect(page.getByRole("heading", { name: /ThermalTrace in Home Assistant/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Install via HACS/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /HACS repo on GitHub/i })).toBeVisible();
    const jsonLd = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(jsonLd.some((block) => block.includes('"FAQPage"'))).toBe(true);
  });

  test("thermostat OAuth operator guide loads", async ({ page }) => {
    await page.goto("/about/thermostat-oauth");
    await expect(page.getByRole("heading", { name: /Nest & Ecobee thermostat OAuth/i })).toBeVisible();
    await expect(page.getByText("thermaltrace.dev/api/integrations/nest/callback")).toBeVisible();
  });

  test("portfolio requires sign-in", async ({ page }) => {
    await page.goto("/dashboard/portfolio");
    await expect(page).toHaveURL(/signin/);
  });

  test("manifest includes portfolio shortcut", async ({ request }) => {
    const res = await request.get("/manifest.webmanifest");
    expect(res.ok()).toBeTruthy();
    const manifest = await res.json();
    const urls = (manifest.shortcuts ?? []).map((s: { url: string }) => s.url);
    expect(urls).toContain("/dashboard/portfolio");
    expect(urls).toContain("/dashboard/alerts");
    expect(urls).toContain("/dashboard/live");
  });
});
