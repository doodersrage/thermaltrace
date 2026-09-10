import type { APIRoute } from "astro";
import { getAuthFromCookies } from "../../../lib/auth";
import { getOrCreateHouseholdForUser } from "../../../lib/households";
import { createServerClient } from "../../../lib/supabase";
import { formRedirectPath } from "../../../lib/siteUrl";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromCookies(cookies);
  if (!session || !user) {
    return redirect("/signin");
  }

  const formData = await request.formData();
  const redirectTo = formRedirectPath(formData, "/dashboard/household");
  const optInRaw = formData.getAll("digest_opt_in").map(String);
  const optIn = optInRaw.includes("1") || optInRaw.includes("on");

  const household = await getOrCreateHouseholdForUser(user.id, user.email);
  if (!household.householdId) {
    return redirect(`${redirectTo}?digest_error=1`);
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from("household_members")
    .update({ digest_opt_in: optIn })
    .eq("household_id", household.householdId)
    .eq("user_id", user.id);

  if (error) {
    return redirect(`${redirectTo}?digest_error=1`);
  }

  return redirect(
    `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}digest_saved=1`,
  );
};
