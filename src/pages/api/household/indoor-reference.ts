import type { APIRoute } from "astro";
import { getAuthFromCookies } from "../../../lib/auth";
import {
  getOwnedHouseholdId,
  canEditHousehold,
  getUserHouseholdRole,
} from "../../../lib/households";
import { updateIndoorReferenceSensor } from "../../../lib/indoorReference";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromCookies(cookies);
  if (!session || !user) {
    return redirect("/signin");
  }

  const householdId = await getOwnedHouseholdId(user.id);
  if (!householdId) {
    return redirect("/dashboard/devices?indoor_ref_error=no_household");
  }

  const role = await getUserHouseholdRole(user.id, householdId);
  if (!canEditHousehold(role)) {
    return redirect("/dashboard/devices?indoor_ref_error=forbidden");
  }

  const form = await request.formData();
  const sensorRaw = form.get("sensor_id")?.toString().trim() ?? "";
  const sensorId = sensorRaw || null;
  const redirectTo =
    form.get("redirect")?.toString() || "/dashboard/devices?view=setup&tab=pull#indoor-reference";

  const result = await updateIndoorReferenceSensor(householdId, sensorId);
  if (result.error) {
    const url = new URL(redirectTo, "https://thermaltrace.dev");
    url.searchParams.set("indoor_ref_error", "save_failed");
    return redirect(`${url.pathname}${url.search}${url.hash}`);
  }

  const url = new URL(redirectTo, "https://thermaltrace.dev");
  url.searchParams.set("indoor_ref_saved", "1");
  return redirect(`${url.pathname}${url.search}${url.hash}`);
};
