import { test, expect } from "@playwright/test";
import { getE2ECredentials, signIn } from "./helpers/auth";

test.describe("alert settings", () => {
  // Shared E2E account: keep mutating tests from racing across workers.
  test.describe.configure({ mode: "serial" });

  test("alerts page requires sign-in", async ({ page }) => {
    await page.goto("/dashboard/alerts");
    await expect(page).toHaveURL(/signin/);
  });

  test("organized sections render when signed in", async ({ page }) => {
    test.skip(!getE2ECredentials(), "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

    await signIn(page, "/dashboard/alerts?tab=settings");
    await expect(page.getByRole("heading", { name: /Alerts/i }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: /Alert settings sections/i })).toBeVisible();
    await expect(page.locator("#alert-section-essentials")).toBeVisible();
    await expect(page.locator("#alert-section-channels")).toBeVisible();
    await expect(page.locator("#alert-section-advanced")).toBeVisible();
  });

  test("freeze threshold persists after save", async ({ page }) => {
    test.skip(!getE2ECredentials(), "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

    await signIn(page, "/dashboard/alerts?tab=settings");

    const threshold = page.locator("#freeze_threshold_f");
    await threshold.scrollIntoViewIfNeeded();

    const original = await threshold.inputValue();
    const trial = original === "31.5" ? "32" : "31.5";

    await threshold.fill(trial);
    await page.locator("#alert-settings-submit").click();
    await expect(page.getByRole("status").filter({ hasText: /Alert settings saved/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).toHaveURL(/tab=settings/);
    await expect(page.locator("#freeze_threshold_f")).toHaveValue(trial);

    await threshold.fill(original);
    await page.locator("#alert-settings-submit").click();
    await expect(page.getByRole("status").filter({ hasText: /Alert settings saved/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator("#freeze_threshold_f")).toHaveValue(original);
  });

  test("email channel + freeze alerts enable and test send", async ({ page }) => {
    test.skip(!getE2ECredentials(), "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

    await signIn(page, "/dashboard/alerts?tab=settings");

    const enabled = page.locator('input[name="alerts_enabled"]');
    const emailChannel = page.locator('input[name="channel_email"]');
    if (!(await enabled.isChecked())) await enabled.check();
    if (!(await emailChannel.isChecked())) await emailChannel.check();

    await page.locator("#alert-settings-submit").click();
    await expect(page.getByRole("status").filter({ hasText: /Alert settings saved/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: /Send test now/i }).click();
    await expect(page).toHaveURL(/test_sent=1|test_error=1/, { timeout: 25_000 });
    await expect(
      page.getByRole("status").filter({
        hasText: /Test alert sent|Could not send test|No channels|No alert channels/i,
      }),
    ).toBeVisible();
    await expect(page.getByRole("status")).toContainText(/Test alert sent/i);
  });
});

test.describe("ops admin", () => {
  test("ops email drip smoke when user is admin", async ({ page }) => {
    test.skip(!getE2ECredentials(), "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

    await signIn(page, "/dashboard/ops");
    if (!/\/dashboard\/ops\/?$/.test(new URL(page.url()).pathname)) {
      test.skip(true, "E2E user is not an admin — skip Ops email smoke");
    }

    await expect(page.getByRole("heading", { name: /Ops/i }).first()).toBeVisible();
    await page.getByRole("button", { name: /Test drip day 1/i }).click();
    await expect(page).toHaveURL(/email_test=1/, { timeout: 25_000 });
    await expect(page.getByText(/Test email sent/i)).toBeVisible();
  });
});

test.describe("dashboard overview", () => {
  test("overview loads for signed-in user", async ({ page }) => {
    test.skip(!getE2ECredentials(), "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

    await signIn(page, "/dashboard");
    await expect(page.getByRole("heading", { name: /Overview|Status|Getting started|Looking good|Freeze risk|Waiting|Add a probe|Close to freeze|Space looks|Cold snap|Sensor may|night/i }).first()).toBeVisible();
    await expect(page.locator("#garage-risk")).toBeVisible();
    await expect(page.locator("#status")).toBeVisible();
  });
});
