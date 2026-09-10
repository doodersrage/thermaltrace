import type { APIRoute } from "astro";
import { getAuthFromCookies } from "../../../lib/auth";
import { getOrCreateHouseholdForUser } from "../../../lib/households";
import {
  createHistorySavedView,
  deleteHistorySavedView,
  listHistorySavedViews,
  paramsFromSearchParams,
} from "../../../lib/historySavedViews";
import { formRedirectPath } from "../../../lib/siteUrl";

export const GET: APIRoute = async ({ cookies }) => {
  const { session, user } = await getAuthFromCookies(cookies);
  if (!session || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const views = await listHistorySavedViews(user.id);
  return new Response(JSON.stringify({ views }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromCookies(cookies);
  if (!session || !user) {
    return redirect("/signin");
  }

  const formData = await request.formData();
  const redirectTo = formRedirectPath(formData, "/dashboard/history");
  const action = formData.get("action")?.toString() ?? "create";

  if (action === "delete") {
    const id = formData.get("id")?.toString();
    if (!id) return redirect(`${redirectTo}?view_error=1`);
    const result = await deleteHistorySavedView(user.id, id);
    if (!result.ok) return redirect(`${redirectTo}?view_error=1`);
    return redirect(`${redirectTo}?view_deleted=1`);
  }

  const name = formData.get("name")?.toString() ?? "";
  const qs = formData.get("params")?.toString() ?? "";
  const params = paramsFromSearchParams(new URLSearchParams(qs));
  const household = await getOrCreateHouseholdForUser(user.id, user.email);
  const created = await createHistorySavedView({
    userId: user.id,
    householdId: household.householdId,
    name,
    params,
  });
  if (created.error) {
    return redirect(`${redirectTo}?view_error=1`);
  }
  return redirect(`${redirectTo}?view_saved=1`);
};
