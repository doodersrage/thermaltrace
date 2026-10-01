import { test, expect, type Page } from "@playwright/test";

/**
 * The browser flasher's "Send settings over USB" step, driven against a
 * stand-in for the board that speaks the probe firmware's serial protocol
 * (firmware/thermaltrace-probe). No hardware: this covers the page's side of
 * the conversation only.
 */
type BoardMode = "ok" | "reset-first" | "wifi-fail" | "bad-key" | "no-probe";

const DEVICE_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef";

/** Runs in the page before its scripts: replaces Web Serial with a fake board. */
function installFakeBoard(mode: BoardMode) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const state = { frames: [] as string[], baudRate: 0, closed: false };
  (window as unknown as { __board: typeof state }).__board = state;

  const requestPort = async () => {
    let push: ((bytes: Uint8Array) => void) | undefined;
    const say = (line: string, delayMs: number) =>
      setTimeout(() => push?.(encoder.encode(`${line}\n`)), delayMs);

    return {
      open: async (options: { baudRate: number }) => {
        state.baudRate = options.baudRate;
      },
      close: async () => {
        state.closed = true;
      },
      setSignals: async () => {},
      readable: new ReadableStream<Uint8Array>({
        start(controller) {
          push = (bytes) => controller.enqueue(bytes);
          say("ets Jul 29 2019 12:21:46 bootloader noise", 50);
          say("TT firmware 1.0.0", 100);
        },
      }),
      writable: new WritableStream<Uint8Array>({
        write(chunk) {
          state.frames.push(decoder.decode(chunk));
          // A board that resets when the port opens misses the first frame.
          if (mode === "reset-first" && state.frames.length === 1) return;
          say("TT key saved", 100);
          say("TT wifi joining", 150);
          if (mode === "wifi-fail") {
            say("TT wifi failed: check the network name and password (2.4 GHz only)", 400);
            return;
          }
          say("TT wifi ok", 400);
          if (mode === "bad-key") {
            say("TT post 401 probes=1", 700);
            say("TT key rejected: copy the device key again from Dashboard → Devices", 750);
          } else if (mode === "no-probe") {
            say("TT no probe: check the DS18B20 wiring and the 4.7k pull-up on GPIO 4", 700);
          } else {
            say("TT post 200 probes=1", 700);
          }
        },
      }),
    };
  };

  Object.defineProperty(navigator, "serial", { value: { requestPort }, configurable: true });
}

async function sendSettings(page: Page, mode: BoardMode, key = DEVICE_KEY) {
  await page.addInitScript(installFakeBoard, mode);
  await page.goto("/flash");
  await page.fill('input[name="ssid"]', "Home WiFi 2.4");
  await page.fill('input[name="password"]', " pass word ");
  await page.fill('input[name="key"]', key);
  const send = page.locator("[data-flasher-send]");
  await send.click();
  await expect(send).toBeEnabled({ timeout: 25_000 });
  return page.evaluate(
    () => (window as unknown as { __board: { frames: string[]; baudRate: number; closed: boolean } }).__board,
  );
}

test.describe("browser flasher", () => {
  test("page loads with the installer and firmware manifest", async ({ page, request }) => {
    await page.goto("/flash");
    await expect(page.getByRole("heading", { name: /Flash a freeze sensor from your browser/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Install firmware/i })).toBeVisible();

    const manifest = await (await request.get("/firmware/manifest.json")).json();
    expect(manifest.builds.map((build: { chipFamily: string }) => build.chipFamily)).toEqual([
      "ESP32",
      "ESP32-S3",
      "ESP32-C3",
    ]);
    for (const build of manifest.builds) {
      const image = await request.get(`/firmware/${build.parts[0].path}`);
      expect(image.status()).toBe(200);
    }
  });

  test("sends settings and reports the first reading", async ({ page }) => {
    const board = await sendSettings(page, "ok", `https://thermaltrace.dev/api/ingest/${DEVICE_KEY}`);

    await expect(page.locator("[data-flasher-status]")).toHaveText(/First reading delivered/);
    expect(board.baudRate).toBe(115200);
    expect(board.closed).toBe(true);
    // Tab-separated; the password keeps its spaces.
    expect(board.frames).toEqual([
      `TTCFG\tHome WiFi 2.4\t pass word \thttps://thermaltrace.dev/api/ingest/${DEVICE_KEY}\n`,
    ]);
  });

  test("resends when the board resets on connect and answers late", async ({ page }) => {
    const board = await sendSettings(page, "reset-first");

    await expect(page.locator("[data-flasher-status]")).toHaveText(/First reading delivered/);
    expect(board.frames.length).toBe(2);
    expect(board.closed).toBe(true);
  });

  for (const [mode, message] of [
    ["wifi-fail", /Wifi failed: check the network name and password/],
    ["bad-key", /Key rejected: copy the device key again/],
    ["no-probe", /No probe: check the DS18B20 wiring/],
  ] as const) {
    test(`reports a ${mode} board`, async ({ page }) => {
      const board = await sendSettings(page, mode);

      await expect(page.locator("[data-flasher-status]")).toHaveText(message);
      expect(board.closed).toBe(true);
    });
  }
});
