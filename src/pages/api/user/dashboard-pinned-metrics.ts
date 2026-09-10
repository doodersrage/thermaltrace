import type { APIRoute } from "astro";
import { createAuthClient } from "../../../lib/supabase";
import { getAuthFromCookies, setAuthCookies } from "../../../lib/auth";
import {
  DEFAULT_PINNED_OVERVIEW_METRICS,
  PINNABLE_OVERVIEW_METRICS,
  PINNED_METRICS_MAX,
  getPinnedOverviewMetrics,
  parsePinnedOverviewMetricsInput,
  updatePinnedOverviewMetrics,
  type PinnableOverviewMetric,
} from "../../../lib/dashboardComfort";
import { formRedirectPath } from "../../../lib/siteUrl";

function wantsJson(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromCookies(cookies);

  if (!session || !user) {
    if (wantsJson(request)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return redirect("/signin");
  }

  const accessToken = cookies.get("sb-access-token")!.value;
  const refreshToken = cookies.get("sb-refresh-token")!.value;
  const asJson = wantsJson(request);

  let metrics: PinnableOverviewMetric[] | null = null;
  let redirectTo = "/dashboard/settings";

  if (asJson) {
    try {
      const body = (await request.json()) as {
        action?: string;
        metric?: string;
        metrics?: string[];
      };
      if (body.action === "toggle" && typeof body.metric === "string") {
        const allowed = new Set<string>(PINNABLE_OVERVIEW_METRICS);
        if (!allowed.has(body.metric)) {
          return new Response(JSON.stringify({ error: "Invalid metric" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        const current = getPinnedOverviewMetrics(user);
        const id = body.metric as PinnableOverviewMetric;
        if (current.includes(id)) {
          metrics = current.filter((item) => item !== id);
          if (metrics.length === 0) metrics = [...DEFAULT_PINNED_OVERVIEW_METRICS];
        } else {
          metrics = [...current, id].slice(0, PINNED_METRICS_MAX);
        }
      } else if (Array.isArray(body.metrics)) {
        metrics = parsePinnedOverviewMetricsInput(body.metrics.map(String));
      }
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    const formData = await request.formData();
    redirectTo = formRedirectPath(formData, "/dashboard/settings");
    const toggle = formData.get("toggle")?.toString();
    if (toggle) {
      const allowed = new Set<string>(PINNABLE_OVERVIEW_METRICS);
      if (allowed.has(toggle)) {
        const current = getPinnedOverviewMetrics(user);
        const id = toggle as PinnableOverviewMetric;
        metrics = current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id].slice(0, PINNED_METRICS_MAX);
        if (metrics.length === 0) metrics = [...DEFAULT_PINNED_OVERVIEW_METRICS];
      }
    } else {
      const raw = formData.getAll("metrics").map((v) => String(v));
      metrics = parsePinnedOverviewMetricsInput(raw);
    }
  }

  if (!metrics) {
    if (asJson) {
      return new Response(JSON.stringify({ error: "No metrics" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return redirect(`${redirectTo}?pinned_error=1`);
  }

  const { error } = await updatePinnedOverviewMetrics(
    accessToken,
    refreshToken,
    metrics,
  );

  if (error) {
    if (asJson) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    return redirect(`${redirectTo}?pinned_error=1`);
  }

  const { data: refreshedSession } = await createAuthClient().auth.refreshSession({
    refresh_token: refreshToken,
  });

  if (refreshedSession.session) {
    setAuthCookies(
      cookies,
      refreshedSession.session.access_token,
      refreshedSession.session.refresh_token,
    );
  }

  if (asJson) {
    return new Response(JSON.stringify({ ok: true, metrics }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return redirect(
    `${redirectTo}${redirectTo.includes("?") ? "&" : "?"}pinned_saved=1`,
  );
};
