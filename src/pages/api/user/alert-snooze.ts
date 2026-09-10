import type { APIRoute } from "astro";
import { getAuthFromRequest } from "../../../lib/auth";
import {
  getAlertSettingsForUser,
  saveAlertSettingsForUser,
} from "../../../lib/notify";
import {
  snoozeUntilFromHours,
  vacationUntilFromDate,
  vacationUntilFromDays,
} from "../../../lib/alertSnooze";
import {
  redirectUnlessEditor,
  requireHouseholdEditor,
} from "../../../lib/householdAuth";
import { formRedirectPath } from "../../../lib/siteUrl";

const SNOOZE_MAX_HOURS = 168;
const VACATION_MAX_DAYS = 30;

function wantsJson(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

function parsePositiveInt(raw: FormDataEntryValue | null): number | null {
  if (raw == null) return null;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromRequest(request, cookies);
  const asJson = wantsJson(request);

  if (!session || !user) {
    if (asJson) return jsonResponse({ error: "Unauthorized" }, 401);
    return redirect("/signin");
  }

  let formData: FormData;
  if (asJson) {
    let body: {
      action?: string;
      hours?: number;
      days?: number;
      until?: string;
    };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }
    formData = new FormData();
    if (body.action) formData.set("action", body.action);
    if (body.hours != null) formData.set("hours", String(body.hours));
    if (body.days != null) formData.set("days", String(body.days));
    if (body.until) formData.set("until", body.until);
  } else {
    formData = await request.formData();
  }

  const redirectTo = formRedirectPath(formData, "/dashboard/alerts");

  const editor = await requireHouseholdEditor(user.id);
  const blocked = redirectUnlessEditor(editor, redirectTo, redirect);
  if (blocked) {
    if (asJson) return jsonResponse({ error: "Forbidden" }, 403);
    return blocked;
  }

  const action = formData.get("action")?.toString();
  const settings = await getAlertSettingsForUser(
    user.id,
    user.user_metadata as Record<string, unknown>,
  );

  if (action === "snooze_24" || action === "snooze") {
    const hours =
      action === "snooze_24"
        ? 24
        : Math.min(parsePositiveInt(formData.get("hours")) ?? 24, SNOOZE_MAX_HOURS);
    await saveAlertSettingsForUser(user.id, {
      ...settings,
      snoozeUntil: snoozeUntilFromHours(hours),
    });
    if (asJson) {
      return jsonResponse({
        ok: true,
        kind: "snooze",
        message: `Alerts snoozed for ${hours} hours.`,
        hours,
      });
    }
    return redirect(`${redirectTo}?snooze=1&hours=${hours}`);
  }

  if (action === "vacation_7" || action === "vacation" || action === "vacation_until") {
    const untilRaw = formData.get("until")?.toString()?.trim() ?? "";
    let vacationUntil: string | null = null;
    let message = "";
    if (action === "vacation_until" || untilRaw) {
      vacationUntil = vacationUntilFromDate(untilRaw);
      if (!vacationUntil) {
        if (asJson) return jsonResponse({ error: "Pick a future return date." }, 400);
        return redirect(`${redirectTo}?vacation_error=1`);
      }
      message = `Vacation until ${untilRaw}.`;
    } else {
      const days =
        action === "vacation_7"
          ? 7
          : Math.min(parsePositiveInt(formData.get("days")) ?? 7, VACATION_MAX_DAYS);
      vacationUntil = vacationUntilFromDays(days);
      message = `Vacation mode for ${days} days.`;
    }
    await saveAlertSettingsForUser(user.id, {
      ...settings,
      vacationUntil,
    });
    if (asJson) {
      return jsonResponse({ ok: true, kind: "vacation", message, vacationUntil });
    }
    return redirect(`${redirectTo}?vacation=1`);
  }

  if (action === "clear_snooze") {
    await saveAlertSettingsForUser(user.id, { ...settings, snoozeUntil: null });
    if (asJson) return jsonResponse({ ok: true, kind: "clear_snooze", message: "Snooze cleared." });
    return redirect(`${redirectTo}?snooze_cleared=1`);
  }

  if (action === "clear_vacation") {
    await saveAlertSettingsForUser(user.id, { ...settings, vacationUntil: null });
    if (asJson) return jsonResponse({ ok: true, kind: "clear_vacation", message: "Vacation cleared." });
    return redirect(`${redirectTo}?vacation_cleared=1`);
  }

  if (asJson) return jsonResponse({ error: "Unknown action" }, 400);
  return redirect(redirectTo);
};
