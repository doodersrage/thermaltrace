import { BRAND_NAME } from "./brand";

/** Standard Open Graph share image size (Facebook / LinkedIn / X). */
export const OG_IMAGE_WIDTH = 1200;
export const OG_IMAGE_HEIGHT = 630;
export const OG_IMAGE_TYPE = "image/jpeg";

export const DEFAULT_OG_IMAGE_PATH = "/og-dashboard.jpg";

/** Pathname → public OG asset for marketing surfaces. */
export function resolveOgImagePath(pathname: string): string {
  const path = pathname.split("?")[0] || "/";

  if (path.startsWith("/pricing") || path.startsWith("/compare")) {
    return "/og-pricing.jpg";
  }
  if (
    path.startsWith("/apps") ||
    path.startsWith("/android") ||
    path.startsWith("/desktop") ||
    path.startsWith("/bay-buddy")
  ) {
    return "/og-android.jpg";
  }
  if (
    path.startsWith("/accessories") ||
    path.startsWith("/claim-puck") ||
    path.startsWith("/alert-beacon") ||
    path.startsWith("/door-puck") ||
    path.startsWith("/leak-puck") ||
    path.startsWith("/power-nudge") ||
    path.startsWith("/kit-labels") ||
    path.startsWith("/probe-mount-kit")
  ) {
    return "/og-about.jpg";
  }
  if (
    path.startsWith("/integrations") ||
    path.startsWith("/claims-pack") ||
    path === "/gift" ||
    path.startsWith("/property-management")
  ) {
    return "/og-dashboard.jpg";
  }
  if (path.startsWith("/freeze-map") || path.startsWith("/freeze-season")) {
    return "/og-freeze-map.jpg";
  }
  if (path.startsWith("/demo") || path.startsWith("/share-kit")) {
    return DEFAULT_OG_IMAGE_PATH;
  }
  if (path.startsWith("/about") || path.startsWith("/guides")) {
    return "/og-about.jpg";
  }
  if (path.startsWith("/stories")) {
    return "/og-story-freeze.jpg";
  }
  if (path.startsWith("/docs")) {
    return "/og-api.jpg";
  }
  if (path.startsWith("/android")) {
    return "/og-android.jpg";
  }
  if (path === "/contact" || path === "/privacy" || path === "/terms") {
    return DEFAULT_OG_IMAGE_PATH;
  }
  if (path === "/system-status") {
    return DEFAULT_OG_IMAGE_PATH;
  }

  return DEFAULT_OG_IMAGE_PATH;
}

export function resolveOgImageAlt(pathname: string): string {
  const path = pathname.split("?")[0] || "/";

  if (path.startsWith("/pricing") || path.startsWith("/compare")) {
    return `${BRAND_NAME} plans and pricing: Free, Member, Pro, and Portfolio freeze and flood/leak alert tiers`;
  }
  if (
    path.startsWith("/apps") ||
    path.startsWith("/android") ||
    path.startsWith("/desktop") ||
    path.startsWith("/bay-buddy")
  ) {
    return `${BRAND_NAME} companion apps: Android, Desktop, Bay Buddy, and PWA clients for your account`;
  }
  if (
    path.startsWith("/accessories") ||
    path.startsWith("/claim-puck") ||
    path.startsWith("/alert-beacon") ||
    path.startsWith("/door-puck") ||
    path.startsWith("/leak-puck") ||
    path.startsWith("/power-nudge") ||
    path.startsWith("/kit-labels") ||
    path.startsWith("/probe-mount-kit")
  ) {
    return `${BRAND_NAME} hardware accessories: claim puck, mood lights, door/leak contacts, and freeze-kit mounts`;
  }
  if (path.startsWith("/integrations")) {
    return `${BRAND_NAME} integrations: Home Assistant, Matter, Node-RED, Influx, MQTT, and automation webhooks`;
  }
  if (path.startsWith("/claims-pack")) {
    return `${BRAND_NAME} claims evidence pack for freeze and flood insurance documentation`;
  }
  if (path === "/gift") {
    return `${BRAND_NAME} gift / referral: share winter monitoring with a friend`;
  }
  if (path.startsWith("/property-management")) {
    return `${BRAND_NAME} Portfolio plan: multi-property freeze and leak monitoring`;
  }
  if (path.startsWith("/freeze-map") || path.startsWith("/freeze-season")) {
    return `${BRAND_NAME} opt-in freeze-risk map of city-level probe temperatures`;
  }
  if (path.startsWith("/demo")) {
    return `${BRAND_NAME} live probe temperature curves, no account required`;
  }
  if (path.startsWith("/share-kit")) {
    return `${BRAND_NAME} share kit: freeze map embeds and freeze/flood community post copy`;
  }
  if (path.startsWith("/about") || path.startsWith("/guides")) {
    return `${BRAND_NAME} guides for probes, firmware, freeze and flood/leak alerts, and ingest`;
  }
  if (path.startsWith("/stories")) {
    return `${BRAND_NAME} customer stories: freeze-risk and leak alerts before pipes and pads take damage`;
  }
  if (path.startsWith("/docs")) {
    return `${BRAND_NAME} HTTP API: ingest, metrics, webhooks, and OpenAPI`;
  }
  if (path.startsWith("/android")) {
    return `${BRAND_NAME} Android companion: early access on GitHub while Google Play review finishes`;
  }
  if (path === "/" || path === "") {
    return `${BRAND_NAME} live telemetry graph: probe curves with humidity, dew point, freeze alerts, and flood/wet contacts`;
  }

  return `${BRAND_NAME} environmental sensor dashboard with live curves, freeze alerts, and flood/leak contacts`;
}

export function absoluteOgImageUrl(siteUrl: string, imagePathOrUrl: string): string {
  if (/^https?:\/\//i.test(imagePathOrUrl)) return imagePathOrUrl;
  const base = siteUrl.replace(/\/+$/, "");
  const path = imagePathOrUrl.startsWith("/") ? imagePathOrUrl : `/${imagePathOrUrl}`;
  return `${base}${path}`;
}
