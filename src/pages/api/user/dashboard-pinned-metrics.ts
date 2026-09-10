import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";
import { getAuthFromCookies, setAuthCookies } from "../../../lib/auth";
import {
  parsePinnedOverviewMetricsInput,
  updatePinnedOverviewMetrics,
} from "../../../lib/dashboardComfort";
import { formRedirectPath } from "../../../lib/siteUrl";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromCookies(cookies);

  if (!session || !user) {
    return redirect("/signin");
  }

  const formData = await request.formData();
  const redirectTo = formRedirectPath(formData, "/dashboard/settings");
  const raw = formData.getAll("metrics").map((v) => String(v));
  const metrics = parsePinnedOverviewMetricsInput(raw);

  const accessToken = cookies.get("sb-access-token")!.value;
  const refreshToken = cookies.get("sb-refresh-token")!.value;

  const { error } = await updatePinnedOverviewMetrics(
    accessToken,
    refreshToken,
    metrics,
  );

  if (error) {
    return redirect(`${redirectTo}?pinned_error=1`);
  }

  const { data: refreshedSession } = await createAuthClient().auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (refreshedSession.session) {
    setAuthCookies(
      cookies,
      refreshedSession.session.access_token,
      refreshedSession.session.refresh_token,
    );
  }

  return redirect(
    `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}pinned_saved=1`,
  );
};
