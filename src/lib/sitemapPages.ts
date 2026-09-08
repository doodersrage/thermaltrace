import { aboutPages } from "./aboutPages";
import { stories } from "./stories";

/** About slugs that redirect elsewhere — omit from sitemap. */
const EXCLUDED_ABOUT_SLUGS = new Set(["zapier-integration"]);

/**
 * Thin framework/stack explainers: keep crawlable from parent hubs, but omit
 * from the sitemap to reduce long-tail index bloat. Parents (astro-applications,
 * nextjs-node-applications) stay listed.
 */
const SITEMAP_DEPRIORITIZED_ABOUT_SLUGS = new Set([
  "astro-server-side-rendering",
  "astro-islands-and-hydration",
  "nextjs-monitoring-dashboards",
  "node-express-api-patterns",
  "comparing-full-stack-options",
  "relay-security-and-access",
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
  "/contact",
  "/privacy",
  "/terms",
  "/freeze-map",
  "/freeze-season",
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
  "/stories",
] as const;

/** Pathnames for every public page that should appear in the XML sitemap. */
export function getPublicSitemapPaths(): string[] {
  const aboutPaths = aboutPages
    .filter(
      (page) =>
        !EXCLUDED_ABOUT_SLUGS.has(page.slug) &&
        !SITEMAP_DEPRIORITIZED_ABOUT_SLUGS.has(page.slug),
    )
    .map((page) => `/about/${page.slug}`);
  const storyPaths = stories.map((story) => story.path);

  return [...new Set([...STATIC_PUBLIC_PATHS, ...storyPaths, ...aboutPaths])];
}

/** Absolute URLs for @astrojs/sitemap `customPages`. */
export function buildPublicSitemapUrls(site: string): string[] {
  const base = site.replace(/\/+$/, "");
  return getPublicSitemapPaths().map((path) => `${base}${path}`);
}
