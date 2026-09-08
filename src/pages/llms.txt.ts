import type { APIRoute } from "astro";
import { BRAND_DESCRIPTION, BRAND_NAME, BRAND_TAGLINE } from "../lib/brand";
import { getBrandDefinition, resolveSiteUrl } from "../lib/schemaMarkup";

export const prerender = false;

/**
 * llms.txt — concise product summary for answer engines / AI crawlers.
 * Spec-inspired: https://llmstxt.org/
 */
export const GET: APIRoute = ({ site }) => {
  const siteUrl = resolveSiteUrl(site).replace(/\/+$/, "");
  const body = `# ${BRAND_NAME}

> ${getBrandDefinition()}

${BRAND_DESCRIPTION}

${BRAND_NAME} (${BRAND_TAGLINE}) is open-source software. It does not sell hardware kits; guides link to Adafruit and Amazon parts lists.

## Primary pages

- Home: ${siteUrl}/
- Pricing: ${siteUrl}/pricing
- Guides hub: ${siteUrl}/guides
- About index: ${siteUrl}/about
- ESP32 freeze kit BOM: ${siteUrl}/about/esp32-freeze-kit
- Accessories: ${siteUrl}/accessories
- Companion apps: ${siteUrl}/apps
- Android companion: ${siteUrl}/android
- ThermalTrace Desktop: ${siteUrl}/desktop
- Bay Buddy: ${siteUrl}/bay-buddy
- Claim puck: ${siteUrl}/claim-puck
- Home Assistant (HACS): ${siteUrl}/integrations/home-assistant
- Matter / Apple Home: ${siteUrl}/integrations/matter
- Probe simulator: ${siteUrl}/about/probe-demo
- HTTP API: ${siteUrl}/docs/api
- OpenAPI: ${siteUrl}/openapi.yaml
- Freeze map: ${siteUrl}/freeze-map
- System status: ${siteUrl}/system-status
- Contact: ${siteUrl}/contact

## Optional

- Compare alternatives: ${siteUrl}/compare
- Stories: ${siteUrl}/stories
- Home Assistant: ${siteUrl}/integrations/home-assistant
- Privacy: ${siteUrl}/privacy
- Terms: ${siteUrl}/terms
- GitHub: https://github.com/doodersrage/thermaltrace
`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
