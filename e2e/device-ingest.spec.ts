import { test, expect } from "@playwright/test";
import { getE2ECredentials, signIn } from "./helpers/auth";

test.describe("device ingest", () => {
  test("ingest rejects an unknown key", async ({ request }) => {
    const res = await request.post("/api/ingest/not-a-real-key", {
      data: { temp1: 40 },
    });
    expect(res.status()).toBe(401);
  });

  test("ingest rejects empty body for unknown key", async ({ request }) => {
    const res = await request.post("/api/ingest/not-a-real-key", {
      data: {},
    });
    expect(res.status()).toBe(401);
  });

  test("create device, POST a reading, see it land, then clean up", async ({ page }) => {
    test.skip(!getE2ECredentials(), "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

    await signIn(page, "/dashboard/devices?tab=push");

    await page.getByRole("button", { name: /Create push device/i }).click();

    // Device creation stores the key in a flash cookie — not the URL.
    await page.waitForURL(/device_created=1&focus_device=.+/, {
      timeout: 20_000,
    });
    const url = new URL(page.url());
    const deviceId = url.searchParams.get("focus_device");
    expect(deviceId).toBeTruthy();

    await expect(page.locator("#ingest-key-value")).toBeVisible({ timeout: 10_000 });
    const ingestKey = (await page.locator("#ingest-key-value").textContent())?.trim();
    expect(ingestKey).toBeTruthy();

    try {
      // This is the core product loop: probe posts JSON, dashboard reflects it.
      const ingestRes = await page.request.post(`/api/ingest/${ingestKey}`, {
        data: { temp1: 41.2, battery: 90 },
      });
      expect(ingestRes.ok()).toBeTruthy();
      const ingestJson = await ingestRes.json().catch(() => null);
      if (ingestJson && typeof ingestJson === "object") {
        expect(ingestJson).toEqual(
          expect.objectContaining({
            ok: expect.anything(),
          }),
        );
      }

      await page.reload();
      const deviceRow = page
        .locator("li", { has: page.locator(`form input[name="device_id"][value="${deviceId}"]`) })
        .first();
      await expect(deviceRow).toBeVisible();
      await expect(deviceRow.getByText("No POSTs yet")).toHaveCount(0);
    } finally {
      // Always remove the device this test created, even if an assertion above failed.
      page.once("dialog", (dialog) => dialog.accept());
      const deleteButton = page
        .locator('form[action="/api/devices"]', {
          has: page.locator(`input[name="device_id"][value="${deviceId}"]`),
        })
        .filter({ has: page.locator('input[name="action"][value="delete"]') })
        .getByRole("button", { name: "Delete" })
        .first();
      if (await deleteButton.count()) {
        await deleteButton.click();
        await page.waitForLoadState("networkidle").catch(() => {});
      }
    }
  });
});
