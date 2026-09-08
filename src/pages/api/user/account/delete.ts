import type { APIRoute } from "astro";
import type { User } from "@supabase/supabase-js";
import { getAuthFromCookies, clearAuthCookies } from "../../../../lib/auth";
import { deleteUserAccount } from "../../../../lib/accountLifecycle";
import {
  createAuthClient,
  createAuthClientFromSession,
  userHasAnyMfaEnrolled,
} from "../../../../lib/mfa";
import {
  clearMfaStepUpCookie,
  hasElevatedAuth,
} from "../../../../lib/mfaStepUpProof";
import { formRedirectPath } from "../../../../lib/siteUrl";

function userHasPasswordIdentity(user: User): boolean {
  const identities = user.identities ?? [];
  if (identities.length === 0) {
    // Older sessions may omit identities; if email exists, require password.
    return Boolean(user.email);
  }
  return identities.some((identity) => identity.provider === "email");
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromCookies(cookies);
  if (!session || !user) {
    return redirect("/signin");
  }

  const formData = await request.formData();
  const confirm = formData.get("confirm")?.toString();
  const password = formData.get("password")?.toString() ?? "";
  const confirmEmail = formData.get("confirm_email")?.toString()?.trim() ?? "";
  const redirectTo = formRedirectPath(formData, "/");

  if (confirm !== "DELETE") {
    return redirect("/dashboard/settings?delete_error=confirm");
  }

  if (userHasPasswordIdentity(user)) {
    const email = user.email?.trim();
    if (!email || !password) {
      return redirect("/dashboard/settings?delete_error=password");
    }
    const authClient = createAuthClient();
    const { error: passwordError } = await authClient.auth.signInWithPassword({
      email,
      password,
    });
    if (passwordError) {
      return redirect("/dashboard/settings?delete_error=password");
    }
  } else {
    const email = user.email?.trim()?.toLowerCase() ?? "";
    if (!email || confirmEmail.toLowerCase() !== email) {
      return redirect("/dashboard/settings?delete_error=email");
    }
  }

  const { client, error: sessionError } = await createAuthClientFromSession(
    session.access_token,
    session.refresh_token,
  );
  if (sessionError) {
    return redirect("/dashboard/settings?delete_error=1");
  }

  const hasMfa = await userHasAnyMfaEnrolled(client, user);
  if (
    hasMfa &&
    !(await hasElevatedAuth(request, cookies, session.access_token, user.id))
  ) {
    return redirect("/dashboard/settings?delete_error=mfa");
  }

  const { error } = await deleteUserAccount(user.id);
  if (error) {
    return redirect("/dashboard/settings?delete_error=1");
  }

  clearAuthCookies(cookies);
  clearMfaStepUpCookie(cookies);

  return redirect(`${redirectTo}?account_deleted=1`);
};
