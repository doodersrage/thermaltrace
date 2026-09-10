import { test, expect } from "@playwright/test";
import { getE2ECredentials, signIn } from "./helpers/auth";

/**
 * Signed-in happy path for the essentials-first UX:
 * Overview risk status → Alerts Essentials → family share create form.
 */
test.describe("happy path essentials", () => {
  test("overview shows garage risk status", async ({ page }) => {
    test.skip(!getE2ECredentials(), "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

    await signIn(page, "/dashboard");
    await expect(page.locator("#garage-risk")).toBeVisible();
    await expect(page.locator("#garage-risk-heading")).toBeVisible();
    await expect(page.getByText(/Space status|Garage status/i).first()).toBeVisible();
    await expect(page.locator("#status")).toBeVisible();
  });

  test("alerts essentials exposes freeze, email, and sensor-dead controls", async ({
    page,
  }) => {
    test.skip(!getE2ECredentials(), "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

    await signIn(page, "/dashboard/alerts?tab=settings");
    await expect(page.locator("#alert-section-essentials")).toBeVisible();
    await expect(page.locator("#freeze_threshold_f")).toBeVisible();
    await expect(page.locator("#alert_email")).toBeVisible();
    await expect(
      page.locator('input[name="outage_alerts_enabled"]'),
    ).toBeVisible();
    await expect(page.locator('input[name="digest_enabled"]')).toBeVisible();
    await expect(page.locator("#send-test-alert")).toBeVisible();
  });

  test("share page offers one-click family live link", async ({ page }) => {
    test.skip(!getE2ECredentials(), "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

    await signIn(page, "/dashboard/share/links");
    await expect(page.getByRole("heading", { name: /^Share$/i }).first()).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Create family live link/i }),
    ).toBeVisible();
  });
});
