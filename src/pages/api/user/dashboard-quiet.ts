import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";
import { getAuthFromCookies, setAuthCookies } from "../../../lib/auth";
import {
  quietUntilSevenDaysFromNow,
  updateDashboardQuietUntil,
} from "../../../lib/dashboardComfort";
import { formRedirectPath } from "../../../lib/siteUrl";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromCookies(cookies);

  if (!session || !user) {
    return redirect("/signin");
  }

  const formData = await request.formData();
  const redirectTo = formRedirectPath(formData, "/dashboard");
  const action = formData.get("action")?.toString() ?? "quiet_7d";

  const quietUntil =
    action === "clear" ? null : quietUntilSevenDaysFromNow();

  const accessToken = cookies.get("sb-access-token")!.value;
  const refreshToken = cookies.get("sb-refresh-token")!.value;

  const { error } = await updateDashboardQuietUntil(
    accessToken,
    refreshToken,
    quietUntil,
  );

  if (error) {
    return redirect(`${redirectTo}?quiet_error=1`);
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
    `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}${
      quietUntil ? "quiet_saved=1" : "quiet_cleared=1"
    }`,
  );
};
