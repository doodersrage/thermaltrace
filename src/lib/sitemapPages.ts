import { aboutPages } from "./aboutPages";
import { stories } from "./stories";
import { answers } from "./answers";

/** About slugs that redirect elsewhere — omit from sitemap. */
const EXCLUDED_ABOUT_SLUGS = new Set(["zapier-integration"]);

/**
 * Web-stack and operator explainers (Astro, Next.js, Supabase, Redis, …) that
 * are not about freeze or leak monitoring. They stay reachable from the About
 * hub but are noindex and left out of the sitemap, so search engines read the
 * site as being about its actual topic.
 */
export const NOINDEX_ABOUT_SLUGS: ReadonlySet<string> = new Set([
  "astro-applications",
  "astro-server-side-rendering",
  "astro-islands-and-hydration",
  "cloudflare-workers-deployment",
  "middleware-auth-patterns",
  "env-secrets-cloudflare",
  "tailwind-v4-setup",
  "nextjs-node-applications",
  "nextjs-monitoring-dashboards",
  "node-express-api-patterns",
  "comparing-full-stack-options",
  "websocket-live-updates",
  "hosting-cost-comparison",
  "relay-security-and-access",
  "redis-cache-for-feeds",
  "docker-relay-deployment",
  "environment-variables-relay",
  "health-check-endpoints",
  "home-page-probe-fetch",
  "supabase-history-inserts",
  "cookie-session-lifecycle",
  "caching-feed-responses",
  "supabase-auth-flow",
  "stripe-csv-subscription",
  "admin-dashboard-features",
  "contact-form-admin-review",
]);

/** Public marketing and docs paths (not auth, dashboard, or token routes). */
const STATIC_PUBLIC_PATHS = [
  "/",
  "/about",
  "/guides",
  "/pricing",
  "/compare",
  "/compare/diy-mqtt",
  "/compare/govee",
  "/compare/tempest",
  "/compare/nest",
  "/compare/ecobee",
  "/compare/tempstick",
  "/compare/yolink",
  "/compare/sensorpush",
  "/compare/shelly",
  "/contact",
  "/privacy",
  "/terms",
  "/freeze-map",
  "/freeze-season",
  "/freeze-time-calculator",
  "/flash",
  "/claims-pack",
  "/property-management",
  "/demo",
  "/share-kit",
  "/system-status",
  "/docs/api",
  "/android",
  "/bay-buddy",
  "/desktop",
  "/apps",
  "/claim-puck",
  "/accessories",
  "/alert-beacon",
  "/door-puck",
  "/leak-puck",
  "/power-nudge",
  "/kit-labels",
  "/probe-mount-kit",
  "/claim-puck-case",
  "/gift",
  "/integrations",
  "/integrations/home-assistant",
  "/integrations/matter",
  "/integrations/smartthings",
  "/integrations/node-red",
  "/integrations/automation",
  "/integrations/influx",
  "/stories",
  "/answers",
] as const;

/** Pathnames for every public page that should appear in the XML sitemap. */
export function getPublicSitemapPaths(): string[] {
  const aboutPaths = aboutPages
    .filter(
      (page) =>
        !EXCLUDED_ABOUT_SLUGS.has(page.slug) &&
        !NOINDEX_ABOUT_SLUGS.has(page.slug),
    )
    .map((page) => `/about/${page.slug}`);
  const storyPaths = stories.map((story) => story.path);
  const answerPaths = answers.map((answer) => answer.path);

  return [...new Set([...STATIC_PUBLIC_PATHS, ...answerPaths, ...storyPaths, ...aboutPaths])];
}

/**
 * Last-modified dates (YYYY-MM-DD) for pages that record one. Pages without a
 * real date are omitted: a made-up lastmod teaches crawlers to ignore the field.
 */
export function getSitemapLastModified(): Map<string, string> {
  const dated = [...answers, ...stories];
  return new Map(dated.map((page) => [page.path, page.dateModified ?? page.datePublished]));
}

/** Absolute URLs for @astrojs/sitemap `customPages`. */
export function buildPublicSitemapUrls(site: string): string[] {
  const base = site.replace(/\/+$/, "");
  return getPublicSitemapPaths().map((path) => `${base}${path}`);
}
