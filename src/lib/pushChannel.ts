import { sendFcmToUser, type FcmDeliveryResult } from "./fcm";
import { sendWebPushToUser, type WebPushDeliveryResult } from "./webPush";

export type PushChannelPayload = {
  title: string;
  body: string;
  eventId?: number | null;
};

export type CombinedPushResult = {
  delivered: number;
  failed: number;
  skippedReason: string | null;
  web: WebPushDeliveryResult;
  fcm: FcmDeliveryResult;
};

/**
 * Fan out push alerts to browser Web Push subscriptions and native FCM tokens.
 */
export async function sendPushChannelToUser(
  userId: string,
  payload: PushChannelPayload,
): Promise<CombinedPushResult> {
  const [web, fcm] = await Promise.all([
    sendWebPushToUser(userId, payload),
    sendFcmToUser(userId, payload),
  ]);

  const delivered = web.delivered + fcm.delivered;
  const failed = web.failed + fcm.failed;

  if (delivered > 0) {
    return { delivered, failed, skippedReason: null, web, fcm };
  }

  const reasons = [web.skippedReason, fcm.skippedReason].filter(Boolean);
  const skippedReason =
    reasons.length === 0
      ? "push_no_subscription"
      : reasons.includes("push_no_subscription") && reasons.includes("fcm_no_token")
        ? "push_no_subscription"
        : reasons.find((r) => r && !r.endsWith("_not_configured") && !r.endsWith("_no_token") && r !== "push_no_subscription") ??
          reasons[0] ??
          "push_no_subscription";

  return { delivered: 0, failed, skippedReason, web, fcm };
}
