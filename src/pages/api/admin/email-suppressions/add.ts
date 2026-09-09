import type { APIRoute } from "astro";
import { getAuthFromCookies } from "../../../../lib/auth";
import { isUserAdmin } from "../../../../lib/adminAccess";
import { addEmailSuppression } from "../../../../lib/emailSuppressions";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromCookies(cookies);
  if (!session || !user || !(await isUserAdmin(user.id))) {
    return redirect("/signin");
  }

  const form = await request.formData().catch(() => null);
  const email = form?.get("email")?.toString() ?? "";
  const reason = form?.get("reason")?.toString()?.trim() || "manual";
  const note = form?.get("note")?.toString()?.trim() || null;
  const result = await addEmailSuppression(email, reason, note);
  if (!result.ok) {
    const params = new URLSearchParams({
      error: result.error ?? "add_failed",
    });
    return redirect(`/dashboard/email-suppressions?${params.toString()}`);
  }
  return redirect("/dashboard/email-suppressions?added=1");
};
