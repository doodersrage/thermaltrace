import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertSettings } from "./alerts";

const mockDeliverWebhookPost = vi.fn();
vi.mock("./webhookDeliveries", () => ({
  deliverWebhookPost: (...a: unknown[]) => mockDeliverWebhookPost(...a),
}));

function settings(
  overrides: Partial<Pick<AlertSettings, "readingWebhookUrl" | "readingWebhookSecret">> = {},
): Pick<AlertSettings, "readingWebhookUrl" | "readingWebhookSecret"> {
  return {
    readingWebhookUrl: "https://hooks.example.com/reading",
    readingWebhookSecret: null,
    ...overrides,
  };
}

async function expectedSignature(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

beforeEach(() => {
  mockDeliverWebhookPost.mockReset().mockResolvedValue(null);
});

describe("sendReadingWebhook", () => {
  it("does nothing when there is no configured url", async () => {
    const { sendReadingWebhook } = await import("./readingWebhook");

    await sendReadingWebhook("user-1", settings({ readingWebhookUrl: null }), { tempF: 30 });

    expect(mockDeliverWebhookPost).not.toHaveBeenCalled();
  });

  it("does nothing when the url is only whitespace", async () => {
    const { sendReadingWebhook } = await import("./readingWebhook");

    await sendReadingWebhook("user-1", settings({ readingWebhookUrl: "   " }), { tempF: 30 });

    expect(mockDeliverWebhookPost).not.toHaveBeenCalled();
  });

  it("posts the JSON body without a signature header when there is no secret", async () => {
    const { sendReadingWebhook } = await import("./readingWebhook");

    await sendReadingWebhook("user-1", settings(), { tempF: 30 });

    expect(mockDeliverWebhookPost).toHaveBeenCalledWith(
      "user-1",
      "reading",
      "https://hooks.example.com/reading",
      {
        "Content-Type": "application/json",
        "User-Agent": "ThermalTrace/1.0",
      },
      JSON.stringify({ tempF: 30 }),
    );
  });

  it("signs the body and sets both signature headers when a secret is configured", async () => {
    const { sendReadingWebhook } = await import("./readingWebhook");
    const body = JSON.stringify({ tempF: 30 });
    const expectedSig = `sha256=${await expectedSignature("my-secret", body)}`;

    await sendReadingWebhook("user-1", settings({ readingWebhookSecret: "my-secret" }), {
      tempF: 30,
    });

    const [, , , headers] = mockDeliverWebhookPost.mock.calls[0]!;
    expect(headers["X-ThermalTrace-Signature"]).toBe(expectedSig);
    expect(headers["X-GarageTemp-Signature"]).toBe(expectedSig);
  });

  it("trims url and secret whitespace before use", async () => {
    const { sendReadingWebhook } = await import("./readingWebhook");

    await sendReadingWebhook(
      "user-1",
      settings({ readingWebhookUrl: "  https://hooks.example.com/reading  ", readingWebhookSecret: "  " }),
      { tempF: 30 },
    );

    const [, , url, headers] = mockDeliverWebhookPost.mock.calls[0]!;
    expect(url).toBe("https://hooks.example.com/reading");
    expect(headers["X-ThermalTrace-Signature"]).toBeUndefined();
  });

  it("passes userId through even when null/undefined", async () => {
    const { sendReadingWebhook } = await import("./readingWebhook");

    await sendReadingWebhook(null, settings(), { tempF: 30 });

    expect(mockDeliverWebhookPost).toHaveBeenCalledWith(
      null,
      "reading",
      expect.any(String),
      expect.any(Object),
      expect.any(String),
    );
  });
});
