import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FcmDeliveryResult } from "./fcm";
import type { WebPushDeliveryResult } from "./webPush";

const mockSendWebPushToUser = vi.fn();
vi.mock("./webPush", () => ({
  sendWebPushToUser: (...a: unknown[]) => mockSendWebPushToUser(...a),
}));

const mockSendFcmToUser = vi.fn();
vi.mock("./fcm", () => ({
  sendFcmToUser: (...a: unknown[]) => mockSendFcmToUser(...a),
}));

function webResult(overrides: Partial<WebPushDeliveryResult> = {}): WebPushDeliveryResult {
  return { delivered: 0, failed: 0, skippedReason: null, ...overrides };
}

function fcmResult(overrides: Partial<FcmDeliveryResult> = {}): FcmDeliveryResult {
  return { delivered: 0, failed: 0, skippedReason: null, ...overrides };
}

beforeEach(() => {
  mockSendWebPushToUser.mockReset();
  mockSendFcmToUser.mockReset();
});

describe("sendPushChannelToUser", () => {
  it("fans out to both web push and fcm with the same payload", async () => {
    mockSendWebPushToUser.mockResolvedValue(webResult());
    mockSendFcmToUser.mockResolvedValue(fcmResult());
    const { sendPushChannelToUser } = await import("./pushChannel");

    await sendPushChannelToUser("user-1", { title: "Alert", body: "Freezing" });

    expect(mockSendWebPushToUser).toHaveBeenCalledWith("user-1", {
      title: "Alert",
      body: "Freezing",
    });
    expect(mockSendFcmToUser).toHaveBeenCalledWith("user-1", { title: "Alert", body: "Freezing" });
  });

  it("sums delivered/failed counts and clears skippedReason when anything was delivered", async () => {
    mockSendWebPushToUser.mockResolvedValue(webResult({ delivered: 2, failed: 1 }));
    mockSendFcmToUser.mockResolvedValue(fcmResult({ delivered: 1, failed: 0 }));
    const { sendPushChannelToUser } = await import("./pushChannel");

    const result = await sendPushChannelToUser("user-1", { title: "t", body: "b" });

    expect(result).toEqual({
      delivered: 3,
      failed: 1,
      skippedReason: null,
      web: webResult({ delivered: 2, failed: 1 }),
      fcm: fcmResult({ delivered: 1, failed: 0 }),
    });
  });

  it("defaults to push_no_subscription when nothing was delivered and neither channel gave a reason", async () => {
    mockSendWebPushToUser.mockResolvedValue(webResult());
    mockSendFcmToUser.mockResolvedValue(fcmResult());
    const { sendPushChannelToUser } = await import("./pushChannel");

    const result = await sendPushChannelToUser("user-1", { title: "t", body: "b" });

    expect(result.delivered).toBe(0);
    expect(result.skippedReason).toBe("push_no_subscription");
  });

  it("collapses matching no-subscription/no-token reasons to push_no_subscription", async () => {
    mockSendWebPushToUser.mockResolvedValue(webResult({ skippedReason: "push_no_subscription" }));
    mockSendFcmToUser.mockResolvedValue(fcmResult({ skippedReason: "fcm_no_token" }));
    const { sendPushChannelToUser } = await import("./pushChannel");

    const result = await sendPushChannelToUser("user-1", { title: "t", body: "b" });

    expect(result.skippedReason).toBe("push_no_subscription");
  });

  it("prefers a substantive error reason over a generic no-subscription/no-token reason", async () => {
    mockSendWebPushToUser.mockResolvedValue(webResult({ skippedReason: "push_no_subscription" }));
    mockSendFcmToUser.mockResolvedValue(fcmResult({ skippedReason: "fcm_send_failed" }));
    const { sendPushChannelToUser } = await import("./pushChannel");

    const result = await sendPushChannelToUser("user-1", { title: "t", body: "b" });

    expect(result.skippedReason).toBe("fcm_send_failed");
  });

  it("falls back to the first reason when both are generic but don't match the no-subscription/no-token pair", async () => {
    mockSendWebPushToUser.mockResolvedValue(
      webResult({ skippedReason: "web_push_not_configured" }),
    );
    mockSendFcmToUser.mockResolvedValue(fcmResult({ skippedReason: "fcm_no_token" }));
    const { sendPushChannelToUser } = await import("./pushChannel");

    const result = await sendPushChannelToUser("user-1", { title: "t", body: "b" });

    expect(result.skippedReason).toBe("web_push_not_configured");
  });

  it("uses the single available reason when only one channel reports one", async () => {
    mockSendWebPushToUser.mockResolvedValue(webResult({ skippedReason: null }));
    mockSendFcmToUser.mockResolvedValue(fcmResult({ skippedReason: "fcm_no_token" }));
    const { sendPushChannelToUser } = await import("./pushChannel");

    const result = await sendPushChannelToUser("user-1", { title: "t", body: "b" });

    expect(result.skippedReason).toBe("fcm_no_token");
  });
});
