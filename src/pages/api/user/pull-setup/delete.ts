import type { APIRoute } from "astro";
import { getAuthFromCookies } from "../../../../lib/auth";
import { deleteUserTempFeed } from "../../../../lib/userTempConfig";
import {
  redirectUnlessEditor,
  requireHouseholdEditor,
} from "../../../../lib/householdAuth";
import { formRedirectPath } from "../../../../lib/siteUrl";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromCookies(cookies);

  if (!session || !user) {
    return redirect("/signin");
  }

  const formData = await request.formData();
  const redirectTo = formRedirectPath(formData, "/dashboard/devices?tab=pull");

  const editor = await requireHouseholdEditor(user.id);
  const blocked = redirectUnlessEditor(editor, redirectTo, redirect);
  if (blocked) return blocked;

  const feedId = formData.get("feed_id")?.toString().trim() ?? "";
  if (!feedId) {
    return new Response("Feed id is required", { status: 400 });
  }

  const { error } = await deleteUserTempFeed(user.id, feedId);
  if (error) {
    return redirect(`${redirectTo.split("?")[0]}?feeds_error=1&tab=pull`);
  }

  return redirect(`${redirectTo.split("?")[0]}?feed_deleted=1&tab=pull`);
};
