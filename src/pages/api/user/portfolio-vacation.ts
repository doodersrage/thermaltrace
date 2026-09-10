import type { APIRoute } from "astro";
import { getAuthFromCookies } from "../../../lib/auth";
import {
  applyVacationForHouseholdMembers,
  clearVacationForHouseholdMembers,
} from "../../../lib/alertSnoozeTokens";
import { getUserEntitlements } from "../../../lib/entitlements";
import { listUserHouseholds, canEditHousehold } from "../../../lib/households";
import { formRedirectPath } from "../../../lib/siteUrl";
import { vacationUntilFromDate } from "../../../lib/alertSnooze";

const VACATION_MAX_DAYS = 90;

function wantsJson(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function withFlashParams(
  redirectTo: string,
  params: Record<string, string | number>,
): string {
  const url = new URL(redirectTo, "https://thermaltrace.local");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }
  return `${url.pathname}${url.search}`;
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromCookies(cookies);
  const asJson = wantsJson(request);

  if (!session || !user) {
    if (asJson) return jsonResponse({ error: "Unauthorized" }, 401);
    return redirect("/signin");
  }

  const entitlements = await getUserEntitlements(user.id);
  if (!entitlements.canUsePortfolio) {
    if (asJson) return jsonResponse({ error: "Portfolio requires Pro or Portfolio plan" }, 403);
    return redirect("/dashboard/plans");
  }

  let action = "";
  let days = 7;
  let redirectTo = "/dashboard/portfolio";

  if (asJson) {
    try {
      const body = (await request.json()) as {
        action?: string;
        days?: number;
        until?: string;
      };
      action = body.action?.trim() ?? "";
      if (body.until) {
        const untilIso = vacationUntilFromDate(body.until);
        if (!untilIso) {
          return jsonResponse({ error: "Pick a future return date." }, 400);
        }
        days = Math.max(
          1,
          Math.ceil((Date.parse(untilIso) - Date.now()) / (24 * 60 * 60 * 1000)),
        );
      } else {
        days = Math.min(Math.max(Number(body.days) || 7, 1), VACATION_MAX_DAYS);
      }
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }
  } else {
    const formData = await request.formData();
    action = formData.get("action")?.toString().trim() ?? "";
    const until = formData.get("until")?.toString().trim() ?? "";
    if (until) {
      const untilIso = vacationUntilFromDate(until);
      if (!untilIso) {
        return redirect(withFlashParams(redirectTo, { vacation_error: 1 }));
      }
      days = Math.max(
        1,
        Math.ceil((Date.parse(untilIso) - Date.now()) / (24 * 60 * 60 * 1000)),
      );
    } else {
      const parsed = Number.parseInt(String(formData.get("days") ?? "7"), 10);
      days = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 7, 1), VACATION_MAX_DAYS);
    }
    redirectTo = formRedirectPath(formData, redirectTo);
  }

  const { households, error } = await listUserHouseholds(user.id);
  if (error) {
    if (asJson) return jsonResponse({ error }, 500);
    return redirect(withFlashParams(redirectTo, { vacation_error: 1 }));
  }

  const editable = households.filter((h) => canEditHousehold(h.role));
  if (editable.length === 0) {
    if (asJson) return jsonResponse({ error: "No editable properties" }, 403);
    return redirect(withFlashParams(redirectTo, { vacation_error: 1 }));
  }

  let membersTouched = 0;
  let propertiesTouched = 0;

  if (action === "vacation" || action === "vacation_7") {
    for (const household of editable) {
      membersTouched += await applyVacationForHouseholdMembers(household.household_id, days);
      propertiesTouched += 1;
    }
    if (asJson) {
      return jsonResponse({
        ok: true,
        action: "vacation",
        days,
        properties: propertiesTouched,
        members: membersTouched,
      });
    }
    return redirect(
      withFlashParams(redirectTo, {
        portfolio_vacation: 1,
        days,
        properties: propertiesTouched,
      }),
    );
  }

  if (action === "clear_vacation") {
    for (const household of editable) {
      membersTouched += await clearVacationForHouseholdMembers(household.household_id);
      propertiesTouched += 1;
    }
    if (asJson) {
      return jsonResponse({
        ok: true,
        action: "clear_vacation",
        properties: propertiesTouched,
        members: membersTouched,
      });
    }
    return redirect(
      withFlashParams(redirectTo, {
        portfolio_vacation_cleared: 1,
        properties: propertiesTouched,
      }),
    );
  }

  if (asJson) return jsonResponse({ error: "Unknown action" }, 400);
  return redirect(redirectTo);
};
