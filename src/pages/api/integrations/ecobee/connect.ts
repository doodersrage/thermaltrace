import type { APIRoute } from "astro";
import { getAuthFromCookies } from "../../../../lib/auth";
import { requireHouseholdManager, redirectUnlessManager } from "../../../../lib/householdAuth";
import { getUserEntitlements } from "../../../../lib/entitlements";
import { buildEcobeeAuthorizeUrl } from "../../../../lib/thermostatOAuth";
import { buildSiteUrl, THERMOSTAT_OAUTH_STATE_COOKIE } from "../../../../lib/siteUrl";

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromCookies(cookies);
  if (!session || !user) {
    return redirect("/signin");
  }

  const entitlements = await getUserEntitlements(user.id);
  if (!entitlements.canUseThermostatIntegration) {
    return redirect("/dashboard/plans?upgrade=thermostat");
  }

  const manager = await requireHouseholdManager(user.id);
  const blocked = redirectUnlessManager(manager, "/dashboard/devices", redirect);
  if (blocked) return blocked;

  const state = randomState();
  cookies.set(THERMOSTAT_OAUTH_STATE_COOKIE, state, {
    path: "/",
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: "lax",
    maxAge: 60 * 10,
  });

  const redirectUri = `${buildSiteUrl(request)}/api/integrations/ecobee/callback`;
  const authorizeUrl = buildEcobeeAuthorizeUrl(state, redirectUri);
  if (!authorizeUrl) {
    return redirect("/dashboard/devices?thermostat_error=not_configured");
  }

  return redirect(authorizeUrl);
};
