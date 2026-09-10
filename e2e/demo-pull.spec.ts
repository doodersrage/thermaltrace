import { test, expect } from "@playwright/test";
import { getE2ECredentials, signIn } from "./helpers/auth";

const EXAMPLE_FEED_PATH = "/api/feeds/example";

/** Server-side probe discovery requires an HTTPS URL reachable from the preview worker. */
function exampleFeedUrlForE2E(pageOrigin: string): string {
  const site = process.env.SITE_URL?.replace(/\/+$/, "");
  if (site?.startsWith("https://")) {
    return `${site}${EXAMPLE_FEED_PATH}`;
  }
  return `${pageOrigin}${EXAMPLE_FEED_PATH}`;
}

test.describe("demo pull feed", () => {
  test("save example feed, discover probes, fetch readings, then clean up", async ({ page }) => {
    test.skip(!getE2ECredentials(), "Set E2E_TEST_EMAIL and E2E_TEST_PASSWORD");

    await signIn(page, "/dashboard/devices?tab=pull");

    const exampleFeedUrl = exampleFeedUrlForE2E(new URL(page.url()).origin);
    const feedId = `e2e-demo-${Date.now()}`;

    const saveRes = await page.request.post("/api/user/pull-setup", {
      headers: { "Content-Type": "application/json" },
      data: {
        redirect: "/dashboard/devices?tab=pull",
        feeds: [
          {
            id: feedId,
            name: "E2E example feed",
            url: exampleFeedUrl,
            enabled: true,
            jsonRoot: "temp",
          },
        ],
        probes: [],
      },
    });
    expect(saveRes.ok()).toBeTruthy();
    const saveBody = (await saveRes.json()) as { ok?: boolean; discoveredProbes?: number };
    expect(saveBody.ok).toBeTruthy();
    expect((saveBody.discoveredProbes ?? 0) > 0).toBeTruthy();

    const fetchRes = await page.request.post("/api/devices/pull-fetch", {
      headers: { Accept: "application/json" },
    });
    expect(fetchRes.ok()).toBeTruthy();
    const fetchBody = (await fetchRes.json()) as {
      ok?: boolean;
      feeds?: Array<{ ok: boolean }>;
    };
    expect(fetchBody.ok).toBeTruthy();
    expect(fetchBody.feeds?.some((row) => row.ok)).toBeTruthy();

    await page.goto(
      `/dashboard/devices?tab=pull&pull_saved=1&probes_discovered=${saveBody.discoveredProbes ?? 0}`,
    );
    await expect(page.getByText(/Pull setup saved/i)).toBeVisible();

    const deleteRes = await page.request.post("/api/user/pull-setup/delete", {
      form: {
        feed_id: feedId,
        redirect: "/dashboard/devices?tab=pull",
      },
    });
    expect(deleteRes.ok()).toBeTruthy();
  });
});
