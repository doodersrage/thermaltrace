import type { APIRoute } from "astro";
import { getAuthFromCookies } from "../../../../lib/auth";
import {
  requireHouseholdManager,
  redirectUnlessManager,
  householdManagerCtx,
} from "../../../../lib/householdAuth";
import { deleteConnection, type ThermostatProvider } from "../../../../lib/thermostatConnections";
import { formRedirectPath } from "../../../../lib/siteUrl";

function isThermostatProvider(value: string | undefined): value is ThermostatProvider {
  return value === "nest" || value === "ecobee";
}

export const POST: APIRoute = async ({ params, request, cookies, redirect }) => {
  const { session, user } = await getAuthFromCookies(cookies);
  if (!session || !user) {
    return redirect("/signin");
  }

  if (!isThermostatProvider(params.provider)) {
    return redirect("/dashboard/devices?thermostat_error=1");
  }

  const manager = await requireHouseholdManager(user.id);
  const blocked = redirectUnlessManager(manager, "/dashboard/devices", redirect);
  if (blocked) return blocked;
  const ctx = householdManagerCtx(manager);

  const formData = await request.formData();
  const redirectTo = formRedirectPath(formData, "/dashboard/devices");

  await deleteConnection(ctx.householdId, params.provider);

  return redirect(`${redirectTo}${redirectTo.includes("?") ? "&" : "?"}thermostat_disconnected=${params.provider}`);
};
