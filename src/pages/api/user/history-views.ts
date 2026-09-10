import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";
import { getAuthFromCookies, setAuthCookies } from "../../../lib/auth";
import { getOrCreateHouseholdForUser } from "../../../lib/households";
import {
  createHistorySavedView,
  deleteHistorySavedView,
  listHistorySavedViews,
  paramsFromSearchParams,
} from "../../../lib/historySavedViews";
import { formRedirectPath } from "../../../lib/siteUrl";

async function updateDefaultHistoryViewId(
  accessToken: string,
  refreshToken: string,
  viewId: string | null,
): Promise<{ error: Error | null; accessToken?: string; refreshToken?: string }> {
  const client = createAuthClient();
  const { data: sessionData, error: sessionError } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError || !sessionData.session) {
    return { error: sessionError ?? new Error("Invalid session") };
  }
  const { error } = await client.auth.updateUser({
    data: { default_history_view_id: viewId },
  });
  if (error) return { error };
  const { data: refreshed } = await client.auth.refreshSession({
    refresh_token: refreshToken,
  });
  return {
    error: null,
    accessToken: refreshed.session?.access_token,
    refreshToken: refreshed.session?.refresh_token,
  };
}

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
  const accessToken = cookies.get("sb-access-token")!.value;
  const refreshToken = cookies.get("sb-refresh-token")!.value;

  if (action === "delete") {
    const id = formData.get("id")?.toString();
    if (!id) return redirect(`${redirectTo}?view_error=1`);
    const result = await deleteHistorySavedView(user.id, id);
    if (!result.ok) return redirect(`${redirectTo}?view_error=1`);
    const currentDefault =
      typeof user.user_metadata?.default_history_view_id === "string"
        ? user.user_metadata.default_history_view_id
        : null;
    if (currentDefault === id) {
      const updated = await updateDefaultHistoryViewId(accessToken, refreshToken, null);
      if (updated.accessToken && updated.refreshToken) {
        setAuthCookies(cookies, updated.accessToken, updated.refreshToken);
      }
    }
    return redirect(`${redirectTo}?view_deleted=1`);
  }

  if (action === "set_default" || action === "clear_default") {
    const id = formData.get("id")?.toString() ?? null;
    const nextId = action === "clear_default" ? null : id;
    if (action === "set_default" && !id) {
      return redirect(`${redirectTo}?view_error=1`);
    }
    if (nextId) {
      const views = await listHistorySavedViews(user.id);
      if (!views.some((view) => view.id === nextId)) {
        return redirect(`${redirectTo}?view_error=1`);
      }
    }
    const updated = await updateDefaultHistoryViewId(accessToken, refreshToken, nextId);
    if (updated.error) return redirect(`${redirectTo}?view_error=1`);
    if (updated.accessToken && updated.refreshToken) {
      setAuthCookies(cookies, updated.accessToken, updated.refreshToken);
    }
    return redirect(`${redirectTo}?view_default=1`);
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
