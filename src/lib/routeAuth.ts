/** Session-auth route rules shared by middleware and tests. */

const protectedPaths = ["/dashboard", "/_actions"];

/** Session-protected API prefixes. Exact public exceptions win first. */
const protectedApiPrefixes = [
  "/api/user/",
  "/api/garage-temps/",
  "/api/stripe/",
  "/api/admin/",
  "/api/feeds/",
  "/api/home/readings",
  "/api/household",
  "/api/devices",
  "/api/push/",
  "/api/share/manage",
  "/api/claims",
  "/api/alerts/export",
  "/api/api-keys",
  "/api/inbound-webhooks",
  "/api/status/manage",
  "/api/contacts",
  "/api/ical",
  "/api/auth/update-password",
  "/api/auth/mfa-manage",
  "/api/auth/companion",
  "/api/integrations",
  "/api/pucks",
  "/api/bays",
  "/api/monitoring",
];

/** Public endpoints that would otherwise match a protected prefix. */
const publicApiExactPaths = new Set([
  "/api/stripe/webhook",
  "/api/home/demo-temps",
  "/api/home/weather",
  "/api/feeds/example",
  // Companion start must work before a browser session exists (sets cookies, then OAuth).
  "/api/auth/companion/start",
]);

/** Public API path prefixes (e.g. token-based inbound webhooks). */
const publicApiPrefixes = [
  "/api/inbound/",
  "/api/alerts/snooze",
  "/api/alerts/ack",
  "/api/telegram/webhook",
];

export function pathRequiresAuth(pathname: string): boolean {
  if (publicApiExactPaths.has(pathname)) {
    return false;
  }

  if (publicApiPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return false;
  }

  if (pathname.startsWith("/status/")) {
    return false;
  }

  return (
    protectedPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    ) || protectedApiPrefixes.some((prefix) => pathname.startsWith(prefix))
  );
}
