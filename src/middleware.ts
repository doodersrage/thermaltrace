import { defineMiddleware } from "astro:middleware";
import {
  companionMfaHeaderValue,
  getAuthFromRequest,
} from "./lib/auth";
import { prefersJsonAuthError } from "./lib/authResponse";
import { pathRequiresAuth } from "./lib/routeAuth";
import {
  buildMfaChallengeUrl,
  getAalClaim,
  isMfaRequiredCookieSet,
  sessionNeedsMfaStepUp,
  setMfaRequiredCookie,
} from "./lib/mfa";
import { hasValidMfaStepUpProof } from "./lib/mfaStepUpProof";
import { recordServerError } from "./lib/serverErrors";
import { CANONICAL_HOST, LEGACY_HOSTS } from "./lib/siteConfig";
import {
  HA_BLUEPRINT_LEGACY_URL,
  HA_BLUEPRINT_URL,
  HA_ENTITIES_LEGACY_URL,
  HA_ENTITIES_YAML,
} from "./lib/homeAssistantIntegration";
import type { AstroCookies } from "astro";

const LEGACY_STATIC_REDIRECTS: Record<string, string> = {
  [HA_BLUEPRINT_LEGACY_URL]: HA_BLUEPRINT_URL,
  [HA_ENTITIES_LEGACY_URL]: HA_ENTITIES_YAML,
};

function isMfaExemptPath(pathname: string): boolean {
  return (
    pathname === "/signin/mfa" ||
    pathname === "/api/auth/mfa-verify" ||
    pathname === "/api/auth/mfa-manage" ||
    pathname === "/api/auth/signout" ||
    pathname === "/api/auth/set-session" ||
    // Password recovery session is typically aal1; allow completing reset.
    pathname === "/api/auth/update-password" ||
    pathname === "/reset-password"
  );
}

/** Header "1" or cookie "1" force MFA. Never treat client header "0" as clearance. */
function isMfaRequired(request: Request, cookies: AstroCookies): boolean {
  if (companionMfaHeaderValue(request) === "1") return true;
  return isMfaRequiredCookieSet(cookies);
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, hostname, protocol } = context.url;

  if (LEGACY_HOSTS.has(hostname)) {
    const dest = new URL(context.url);
    dest.hostname = CANONICAL_HOST;
    dest.protocol = "https:";
    return context.redirect(dest.toString(), 301);
  }

  if (hostname === CANONICAL_HOST && protocol === "http:") {
    const dest = new URL(context.url);
    dest.protocol = "https:";
    return context.redirect(dest.toString(), 301);
  }

  const legacyStatic = LEGACY_STATIC_REDIRECTS[pathname];
  if (legacyStatic) {
    return context.redirect(legacyStatic, 301);
  }

  let userId: string | null = null;

  try {
    if (pathRequiresAuth(pathname)) {
      const { session, user } = await getAuthFromRequest(
        context.request,
        context.cookies,
      );

      if (!session) {
        if (pathname.startsWith("/api/") && prefersJsonAuthError(context.request)) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }
        return context.redirect("/signin");
      }

      userId = user?.id ?? null;

      context.locals.session = session;
      context.locals.user = user ?? null;

      if (
        user &&
        pathname.startsWith("/dashboard") &&
        !pathname.startsWith("/api/")
      ) {
        const { loadDashboardShellForUser } = await import("./lib/dashboardShell");
        context.locals.dashboardShell = await loadDashboardShellForUser(
          user,
          session,
          { includeLiveLag: true },
        );
      }

      if (!isMfaExemptPath(pathname)) {
        const aal = getAalClaim(session.access_token);
        let needsMfa = false;

        if (aal === "aal2") {
          setMfaRequiredCookie(context.cookies, false);
        } else {
          const hasStepUp =
            !!userId &&
            (await hasValidMfaStepUpProof(
              context.request,
              context.cookies,
              userId,
            ));

          if (hasStepUp) {
            needsMfa = false;
          } else if (isMfaRequired(context.request, context.cookies)) {
            needsMfa = true;
          } else if (aal === "aal1") {
            // Never trust cookie/header "0" alone for aal1 — always re-check.
            needsMfa = await sessionNeedsMfaStepUp(
              session.access_token,
              session.refresh_token,
              user,
            );
            setMfaRequiredCookie(context.cookies, needsMfa);
          }
        }

        if (needsMfa) {
          if (pathname.startsWith("/api/") && prefersJsonAuthError(context.request)) {
            return new Response(JSON.stringify({ error: "MFA required" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            });
          }
          return context.redirect(buildMfaChallengeUrl(pathname));
        }
      }
    }

    const response = await next();
    const headers = new Headers(response.headers);
    if (!headers.has("X-Content-Type-Options")) {
      headers.set("X-Content-Type-Options", "nosniff");
    }
    if (!headers.has("Referrer-Policy")) {
      headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    }
    if (!headers.has("X-Frame-Options")) {
      headers.set("X-Frame-Options", "SAMEORIGIN");
    }
    if (!headers.has("Permissions-Policy")) {
      headers.set(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()",
      );
    }
    if (!headers.has("Content-Security-Policy-Report-Only")) {
      // Report-Only first: gather violations without breaking dashboard/analytics.
      headers.set(
        "Content-Security-Policy-Report-Only",
        [
          "default-src 'self'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'self'",
          "object-src 'none'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          "style-src 'self' 'unsafe-inline'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com https://analytics.ahrefs.com https://challenges.cloudflare.com",
          "connect-src 'self' https: wss:",
          "frame-src 'self' https://challenges.cloudflare.com",
          "worker-src 'self' blob:",
        ].join("; "),
      );
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch (error) {
    // Avoid recursive logging when serving the error page itself.
    if (pathname !== "/500") {
      await recordServerError({
        path: pathname,
        method: context.request.method,
        error,
        userId,
      });
    }

    if (pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (pathname === "/500") {
      return new Response("Internal Server Error", { status: 500 });
    }

    try {
      return context.rewrite("/500");
    } catch {
      return new Response("Internal Server Error", { status: 500 });
    }
  }
});
