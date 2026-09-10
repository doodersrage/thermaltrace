import type { APIRoute } from "astro";
import { getAuthFromRequest } from "../../../../lib/auth";
import {
  executeAlertAckPlaybook,
  type AckPlaybookAction,
} from "../../../../lib/alertAckPlaybook";
import { acknowledgeLatestUnackedAlert, acknowledgeAllUnackedAlerts } from "../../../../lib/alertEvents";
import { formRedirectPath } from "../../../../lib/siteUrl";
import { getSiteUrl } from "../../../../lib/stripe";

const VALID_ACTIONS = new Set<AckPlaybookAction>([
  "ack",
  "snooze_1h",
  "snooze_4h",
  "snooze_24h",
  "false_alarm",
  "raise_threshold",
  "notify_tenant",
  "webhook_ping",
]);

function wantsJson(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

function parseAction(raw: unknown): AckPlaybookAction | "ack_latest" | "ack_all" {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value === "ack_latest") return "ack_latest";
  if (value === "ack_all") return "ack_all";
  if (VALID_ACTIONS.has(value as AckPlaybookAction)) {
    return value as AckPlaybookAction;
  }
  return "ack";
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromRequest(request, cookies);
  if (!session || !user) {
    if (wantsJson(request)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return redirect("/signin");
  }

  let eventId: number | null = null;
  let redirectTo = "/dashboard/alerts";
  let action: AckPlaybookAction | "ack_latest" | "ack_all" = "ack";

  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    try {
      const body = (await request.json()) as {
        event_id?: number | string;
        action?: string;
      };
      eventId = Number(body.event_id);
      action = parseAction(body.action);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    const formData = await request.formData();
    const rawId = formData.get("event_id");
    eventId = rawId != null && String(rawId).trim() !== "" ? Number(rawId) : null;
    action = parseAction(formData.get("action")?.toString());
    redirectTo = formRedirectPath(formData, redirectTo);
  }

  if (action === "ack_all") {
    const ack = await acknowledgeAllUnackedAlerts(user.id);
    if (!ack.ok) {
      if (wantsJson(request)) {
        return new Response(JSON.stringify({ error: ack.error ?? "Nothing to acknowledge" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      return redirect(
        `${redirectTo}?ack_error=1&ack_msg=${encodeURIComponent(ack.error ?? "Nothing to acknowledge")}`,
      );
    }
    if (wantsJson(request)) {
      return new Response(
        JSON.stringify({ ok: true, count: ack.count, action: "ack_all" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return redirect(
      `${redirectTo}?ack_ok=1&ack_msg=${encodeURIComponent(`Handled ${ack.count} alert${ack.count === 1 ? "" : "s"}.`)}`,
    );
  }

  if (action === "ack_latest") {
    const ack = await acknowledgeLatestUnackedAlert(user.id);
    if (!ack.ok) {
      if (wantsJson(request)) {
        return new Response(JSON.stringify({ error: ack.error ?? "Nothing to acknowledge" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      return redirect(`${redirectTo}?ack_error=1`);
    }
    if (wantsJson(request)) {
      return new Response(
        JSON.stringify({ ok: true, event_id: ack.eventId, action: "ack_latest" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return redirect(`${redirectTo}?ack_ok=1`);
  }

  if (!Number.isFinite(eventId)) {
    if (wantsJson(request)) {
      return new Response(JSON.stringify({ error: "Invalid event_id" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return redirect(`${redirectTo}?ack_error=1`);
  }

  const siteUrl = getSiteUrl(request).replace(/\/$/, "");
  const result = await executeAlertAckPlaybook({
    userId: user.id,
    userEmail: user.email,
    eventId: eventId as number,
    action,
    siteUrl,
  });

  if (!result.ok) {
    if (wantsJson(request)) {
      return new Response(JSON.stringify({ error: result.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return redirect(
      `${redirectTo}?ack_error=1&ack_msg=${encodeURIComponent(result.message)}`,
    );
  }

  if (wantsJson(request)) {
    return new Response(
      JSON.stringify({ ok: true, event_id: eventId, action, message: result.message }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return redirect(`${redirectTo}?ack_ok=1&ack_msg=${encodeURIComponent(result.message)}`);
};
