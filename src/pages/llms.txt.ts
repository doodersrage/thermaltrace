import type { APIRoute } from "astro";
import { answers } from "../lib/answers";
import { BRAND_NAME } from "../lib/brand";
import { resolveSiteUrl } from "../lib/schemaMarkup";
import {
  FREE_HISTORY_DAYS,
  FREE_MAX_DEVICES,
  MEMBER_HISTORY_DAYS,
  MEMBER_MAX_DEVICES,
  PRO_HISTORY_DAYS,
  PRO_MAX_DEVICES,
} from "../lib/entitlements";
import {
  getMemberPriceDisplay,
  getPortfolioPriceDisplay,
  getProPriceDisplay,
  type PlanPriceDisplay,
} from "../lib/stripePricing";

export const prerender = false;

/**
 * llms.txt — concise product summary for answer engines / AI crawlers.
 * Spec-inspired: https://llmstxt.org/
 */
export const GET: APIRoute = ({ site }) => {
  const siteUrl = resolveSiteUrl(site).replace(/\/+$/, "");
  const member = getMemberPriceDisplay();
  const pro = getProPriceDisplay();
  const portfolio = getPortfolioPriceDisplay();
  const price = (p: PlanPriceDisplay) =>
    p.monthly ? `${p.monthly}/month${p.annual ? ` or ${p.annual}/year` : ""}` : "see pricing page";

  // Plain facts first: answer engines quote the top of this file.
  const body = `# ${BRAND_NAME}

> ${BRAND_NAME} is a hosted dashboard that sends freeze, leak, and heat alerts from temperature and water sensors in garages, crawlspaces, attics, workshops, cabins, and other unheated spaces. The software is open source (MIT); there is a free plan with no credit card.

## Key facts

- What it does: live readings, history charts, and alerts when a space nears freezing, a leak sensor gets wet, a space gets too hot, humidity spikes, or a sensor stops reporting. It also warns ahead of forecast freezing nights.
- Who it is for: homeowners, landlords, and makers who want to know before pipes freeze in a garage, crawlspace, or empty house, and who are comfortable with a DIY sensor or already run Home Assistant.
- Hardware: none sold. Works with an ESP32 or Arduino plus a DS18B20 or DHT22 probe (about $25 in parts), ESPHome, Home Assistant, MQTT (via an HTTPS bridge), or any device that can POST JSON. Pre-filled firmware sketches are generated per device.
- Alerts: email, browser and Android push, Discord, Telegram, Slack, Microsoft Teams, ntfy, and Pushover on every plan; SMS, WhatsApp, and outbound webhooks on Pro. Leak alerts fire automatically when a flood sensor is wet.
- Free plan: ${FREE_MAX_DEVICES} push devices, ${FREE_HISTORY_DAYS} days of history, freeze and leak alerts by email and push, one family live-share link.
- Member (${price(member)}): ${MEMBER_MAX_DEVICES} devices, ${MEMBER_HISTORY_DAYS} days of history, CSV export, forecast freeze warnings.
- Pro (${price(pro)}): ${PRO_MAX_DEVICES} devices per property, ${PRO_HISTORY_DAYS} days of history, SMS alerts, National Weather Service freeze warnings, webhooks, API keys, Nest/Ecobee context, insurance claims evidence packs. 14-day free trial.
- Portfolio (${price(portfolio)}): Pro for landlords and property managers with many properties.
- Compared with sealed Wi-Fi thermometers (TempStick, Govee): ${BRAND_NAME} uses your own sensors, so hardware is cheaper and you can put probes right on the pipes, but it needs a little setup.
- Source code: https://github.com/doodersrage/thermaltrace

## Start here

- Pricing and plan limits: ${siteUrl}/pricing
- Live demo (no account): ${siteUrl}/demo
- Pipe freeze time calculator: ${siteUrl}/freeze-time-calculator
- Create a free account: ${siteUrl}/register
- ESP32 freeze kit parts list: ${siteUrl}/about/esp32-freeze-kit
- Browser flasher (no IDE; ESP32 + DS18B20): ${siteUrl}/flash
- Home Assistant (HACS integration and push): ${siteUrl}/integrations/home-assistant
- Comparisons (TempStick, YoLink, SensorPush, Shelly H&T, Govee, Nest, Ecobee, Tempest, DIY MQTT): ${siteUrl}/compare
- Guides: ${siteUrl}/guides
- Illustrative freeze, leak, and heat scenarios (not customer accounts): ${siteUrl}/stories

## Answers

${answers.map((a) => `- ${a.question} ${siteUrl}${a.path}`).join("\n")}

## Integrations and developers

- HTTP API: ${siteUrl}/docs/api
- OpenAPI: ${siteUrl}/openapi.yaml
- Matter / Apple Home: ${siteUrl}/integrations/matter
- SmartThings (via Matter): ${siteUrl}/integrations/smartthings
- Node-RED: ${siteUrl}/integrations/node-red
- InfluxDB & Telegraf: ${siteUrl}/integrations/influx
- IFTTT / n8n / Sheets: ${siteUrl}/integrations/automation
- Companion apps (Android, desktop): ${siteUrl}/apps

## Optional

- Community freeze map (shows sample data until enough households opt in): ${siteUrl}/freeze-map
- Probe simulator: ${siteUrl}/about/probe-demo
- Accessories: ${siteUrl}/accessories
- System status: ${siteUrl}/system-status
- Contact: ${siteUrl}/contact
- Privacy: ${siteUrl}/privacy
- Terms: ${siteUrl}/terms
`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
