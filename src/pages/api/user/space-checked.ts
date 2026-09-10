import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";
import { getAuthFromCookies, setAuthCookies } from "../../../lib/auth";
import { formRedirectPath } from "../../../lib/siteUrl";

type SpaceCheckedMap = Record<string, string>;

function parseCheckedMap(raw: unknown): SpaceCheckedMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: SpaceCheckedMap = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && Number.isFinite(Date.parse(value))) {
      out[key] = new Date(value).toISOString();
    }
  }
  return out;
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromCookies(cookies);
  const wantsJson =
    (request.headers.get("accept") ?? "").includes("application/json") ||
    (request.headers.get("content-type") ?? "").includes("application/json");

  if (!session || !user) {
    if (wantsJson) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return redirect("/signin");
  }

  let redirectTo = "/dashboard";
  let checkedAt = new Date().toISOString();
  let householdId: string | null = null;

  if (wantsJson) {
    try {
      const body = (await request.json()) as {
        checked_at?: string;
        household_id?: string;
      };
      if (body.checked_at && Number.isFinite(Date.parse(body.checked_at))) {
        checkedAt = new Date(body.checked_at).toISOString();
      }
      if (typeof body.household_id === "string" && body.household_id.trim()) {
        householdId = body.household_id.trim();
      }
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    const formData = await request.formData();
    redirectTo = formRedirectPath(formData, "/dashboard");
    const rawHousehold = formData.get("household_id")?.toString()?.trim();
    if (rawHousehold) householdId = rawHousehold;
  }

  const accessToken = cookies.get("sb-access-token")!.value;
  const refreshToken = cookies.get("sb-refresh-token")!.value;
  const client = createAuthClient();
  const { error: sessionError } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) {
    if (wantsJson) {
      return new Response(JSON.stringify({ error: "Session error" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return redirect(`${redirectTo}?checked_error=1`);
  }

  const existingMap = parseCheckedMap(user.user_metadata?.space_checked_by_household);
  const nextMap = { ...existingMap };
  if (householdId) {
    nextMap[householdId] = checkedAt;
  }

  const { error } = await client.auth.updateUser({
    data: {
      space_checked_at: checkedAt,
      space_checked_by_household: nextMap,
    },
  });
  if (error) {
    if (wantsJson) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return redirect(`${redirectTo}?checked_error=1`);
  }

  const { data: refreshed } = await client.auth.refreshSession({
    refresh_token: refreshToken,
  });
  if (refreshed.session) {
    setAuthCookies(
      cookies,
      refreshed.session.access_token,
      refreshed.session.refresh_token,
    );
  }

  if (wantsJson) {
    return new Response(
      JSON.stringify({
        ok: true,
        checked_at: checkedAt,
        household_id: householdId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return redirect(`${redirectTo}?checked_saved=1`);
};
