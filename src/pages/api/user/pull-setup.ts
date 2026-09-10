import type { APIRoute } from "astro";
import { getAuthFromCookies } from "../../../lib/auth";
import type { TempFeedConfig, TempProbeConfig } from "../../../lib/tempFeedConfig";
import { sanitizeTempFeeds, sanitizeTempProbes } from "../../../lib/tempFeedConfig";
import { saveUserPullSetup } from "../../../lib/userTempConfig";
import {
  redirectUnlessEditor,
  requireHouseholdEditor,
} from "../../../lib/householdAuth";
import { formRedirectPath } from "../../../lib/siteUrl";

function parseFeeds(body: unknown): TempFeedConfig[] | null {
  if (!body || typeof body !== "object") return null;
  const feeds = (body as { feeds?: unknown }).feeds;
  if (!Array.isArray(feeds)) return null;
  const parsed: TempFeedConfig[] = [];
  for (const [index, item] of feeds.entries()) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const url = typeof row.url === "string" ? row.url.trim() : "";
    if (!url) continue;
    parsed.push({
      id:
        typeof row.id === "string" && row.id.trim()
          ? row.id.trim()
          : `feed-${index}`,
      name: typeof row.name === "string" && row.name.trim() ? row.name.trim() : `Feed ${index + 1}`,
      url,
      enabled: row.enabled !== false,
      jsonRoot: typeof row.jsonRoot === "string" ? row.jsonRoot : "temp",
    });
  }
  return parsed.length > 0 ? parsed : null;
}

function parseProbes(body: unknown, feedIds: Set<string>): TempProbeConfig[] {
  if (!body || typeof body !== "object") return [];
  const probes = (body as { probes?: unknown }).probes;
  if (!Array.isArray(probes)) return [];

  const parsed: TempProbeConfig[] = [];
  for (const [index, item] of probes.entries()) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const key = typeof row.key === "string" ? row.key.trim() : "";
    const feedId = typeof row.feedId === "string" ? row.feedId.trim() : "";
    if (!key || !feedId || !feedIds.has(feedId)) continue;
    parsed.push({
      id:
        typeof row.id === "string" && row.id.trim()
          ? row.id.trim()
          : `${feedId}-${key}-${index}`,
      feedId,
      key,
      label: typeof row.label === "string" && row.label.trim() ? row.label.trim() : `Probe ${key}`,
      visible: row.visible !== false,
    });
  }
  return parsed;
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromCookies(cookies);
  const contentType = request.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (!session || !user) {
    if (isJson) {
      return new Response(JSON.stringify({ ok: false, error: "Sign in required." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    return redirect("/signin");
  }

  const editor = await requireHouseholdEditor(user.id);
  let redirectTo = "/dashboard/devices?tab=pull";
  let feeds: TempFeedConfig[] | null = null;
  let probes: TempProbeConfig[] = [];

  if (isJson) {
    if (!editor.ok) {
      return new Response(JSON.stringify({ ok: false, error: "View-only access." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    const body = await request.json();
    if (typeof body === "object" && body && "redirect" in body && typeof body.redirect === "string") {
      redirectTo = body.redirect;
    }
    feeds = parseFeeds(body);
    if (!feeds) {
      return new Response(JSON.stringify({ ok: false, error: "No valid feeds provided." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    const feedIds = new Set(feeds.map((feed) => feed.id));
    probes = parseProbes(body, feedIds);
  } else {
    const formData = await request.formData();
    redirectTo = formRedirectPath(formData, redirectTo);
    const blocked = redirectUnlessEditor(editor, redirectTo, redirect);
    if (blocked) return blocked;
    const { parseTempFeedsFromFormData } = await import("../../../lib/tempFeedConfig");
    feeds = parseTempFeedsFromFormData(formData);
    const feedIds = new Set(feeds.map((feed) => feed.id));
    probes = parseProbes({ probes: JSON.parse(formData.get("probes_json")?.toString() ?? "[]") }, feedIds);
  }

  const sanitizedFeeds = sanitizeTempFeeds(feeds);
  const sanitizedProbes = sanitizeTempProbes(probes, sanitizedFeeds);
  const { error, discoveredProbes } = await saveUserPullSetup(
    user.id,
    sanitizedFeeds,
    sanitizedProbes,
  );

  if (error) {
    if (isJson) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    return redirect(`${redirectTo.split("?")[0]}?feeds_error=1&tab=pull`);
  }

  const query = new URLSearchParams({ pull_saved: "1", tab: "pull" });
  if (discoveredProbes && discoveredProbes > 0) {
    query.set("probes_discovered", String(discoveredProbes));
  }

  if (isJson) {
    return new Response(
      JSON.stringify({
        ok: true,
        redirect: `${redirectTo.split("?")[0]}?${query.toString()}`,
        discoveredProbes: discoveredProbes ?? 0,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  return redirect(`${redirectTo.split("?")[0]}?${query.toString()}`);
};
