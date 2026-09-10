import type { APIRoute } from "astro";
import { getAuthFromCookies } from "../../../../lib/auth";
import {
  redirectUnlessEditor,
  requireHouseholdEditor,
} from "../../../../lib/householdAuth";
import { formRedirectPath } from "../../../../lib/siteUrl";
import {
  deleteUserTempFeed,
  getUserTempConfig,
  saveUserTempConfig,
} from "../../../../lib/userTempConfig";

function withQuery(redirectTo: string, params: Record<string, string>): string {
  const url = new URL(redirectTo, "https://thermaltrace.local");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  if (!url.searchParams.has("tab")) url.searchParams.set("tab", "pull");
  return `${url.pathname}?${url.searchParams.toString()}`;
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromCookies(cookies);
  if (!session || !user) return redirect("/signin");

  const formData = await request.formData();
  const redirectTo = formRedirectPath(formData, "/dashboard/devices?tab=pull");
  const editor = await requireHouseholdEditor(user.id);
  const blocked = redirectUnlessEditor(editor, redirectTo, redirect);
  if (blocked) return blocked;

  const action = formData.get("action")?.toString() ?? "";
  const feedIds = formData
    .getAll("feed_id")
    .map((value) => value.toString().trim())
    .filter(Boolean);

  if (feedIds.length === 0) {
    return redirect(withQuery(redirectTo, { bulk_error: "1" }));
  }

  if (action === "delete") {
    for (const feedId of feedIds) {
      const result = await deleteUserTempFeed(user.id, feedId);
      if (result.error) {
        return redirect(withQuery(redirectTo, { bulk_error: "1" }));
      }
    }
    return redirect(withQuery(redirectTo, { bulk_deleted: String(feedIds.length) }));
  }

  if (action === "enable" || action === "disable") {
    const current = await getUserTempConfig(user);
    if (current.error) {
      return redirect(withQuery(redirectTo, { bulk_error: "1" }));
    }
    const enabled = action === "enable";
    const idSet = new Set(feedIds);
    const feeds = current.feeds.map((feed) =>
      idSet.has(feed.id) ? { ...feed, enabled } : feed,
    );
    const result = await saveUserTempConfig(user.id, feeds, current.probes);
    if (result.error) {
      return redirect(withQuery(redirectTo, { bulk_error: "1" }));
    }
    return redirect(withQuery(redirectTo, { bulk_updated: String(feedIds.length) }));
  }

  return redirect(redirectTo);
};
