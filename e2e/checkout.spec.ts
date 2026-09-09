import { test, expect } from "@playwright/test";
import { getE2ECredentials, signIn } from "./helpers/auth";

// Confirms the session -> Stripe checkout-session wiring still works end to end.
// This never enters card details or completes a purchase — it only asserts the
// server successfully created a Checkout Session and redirected the browser to
// Stripe's hosted page, which is where a silent regression would cost revenue.
test.describe("checkout", () => {
  test("checkout requires sign-in", async ({ request }) => {
    // Match the pricing page form POST (not JSON fetch) so middleware redirects.
    const res = await request.post("/api/stripe/checkout", {
      form: { plan: "member", interval: "monthly" },
      maxRedirects: 0,
    });
    expect([302, 303]).toContain(res.status());
    expect(res.headers()["location"] ?? "").toMatch(/\/signin/);
  });

  test("checkout rejects an unknown plan for signed-in users", async ({ page }) => {
    test.skip(!getE2ECredentials(), "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

    await signIn(page, "/pricing");
    const res = await page.request.post("/api/stripe/checkout", {
      form: { plan: "not-a-real-plan", interval: "monthly" },
      maxRedirects: 0,
    });
    // Either redirect back with an error flash or 4xx — never a Stripe session URL.
    if ([302, 303].includes(res.status())) {
      const location = res.headers()["location"] ?? "";
      expect(location).not.toMatch(/checkout\.stripe\.com/);
    } else {
      expect(res.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test("upgrade CTA redirects to a real Stripe checkout session", async ({ page }) => {
    test.skip(!getE2ECredentials(), "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

    await signIn(page, "/pricing");
    if (!page.url().includes("/pricing")) {
      await page.goto("/pricing");
    }

    const upgradeButton = page.getByRole("button", { name: /Upgrade to (Member|Pro)/i }).first();
    test.skip(
      (await upgradeButton.count()) === 0,
      "No upgrade CTA on /pricing for this account — likely already on a paid plan",
    );

    await upgradeButton.click();
    await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//, { timeout: 20_000 });
    expect(page.url()).toContain("checkout.stripe.com");
  });
});
