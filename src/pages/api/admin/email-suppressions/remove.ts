import type { APIRoute } from "astro";
import { getAuthFromCookies } from "../../../../lib/auth";
import { isUserAdmin } from "../../../../lib/adminAccess";
import { unsuppressEmail } from "../../../../lib/emailSuppressions";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromCookies(cookies);
  if (!session || !user || !(await isUserAdmin(user.id))) {
    return redirect("/signin");
  }

  const form = await request.formData().catch(() => null);
  const email = form?.get("email")?.toString() ?? "";
  const result = await unsuppressEmail(email);
  if (!result.ok) {
    const params = new URLSearchParams({
      error: result.error ?? "remove_failed",
    });
    return redirect(`/dashboard/email-suppressions?${params.toString()}`);
  }
  return redirect("/dashboard/email-suppressions?removed=1");
};
