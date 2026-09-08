import {
  HA_DEV_DOCS_INTEGRATIONS,
  HA_INTEGRATION_PAGE,
  HACS_REPO_URL,
} from "./homeAssistantIntegration";
import { MATTER_INTEGRATION_PAGE, MATTER_REPO_URL } from "./matterIntegration";
import { NODERED_FLOW_URL, NODERED_INTEGRATION_PAGE } from "./nodeRedIntegration";
import { AUTOMATION_INTEGRATION_PAGE, N8N_ALERT_SHEETS_FLOW_URL } from "./automationIntegration";
import { INFLUX_INTEGRATION_PAGE, TELEGRAF_CONFIG_URL } from "./influxIntegration";
import { SMARTTHINGS_INTEGRATION_PAGE } from "./smartThingsIntegration";

export type IntegrationCard = {
  id: string;
  title: string;
  summary: string;
  href: string;
  /** When true, primary CTA opens in a new tab (external developer docs). */
  external?: boolean;
  tier?: string;
  cta?: string;
  /** Optional scan lines under the summary (e.g. inbound vs outbound). */
  bullets?: string[];
  /** Optional second link (often deep developer docs on GitHub Pages). */
  secondaryHref?: string;
  secondaryLabel?: string;
  secondaryExternal?: boolean;
};

export const INTEGRATIONS_HUB_PATH = "/integrations";

/** Extended developer docs (VitePress on GitHub Pages). Prefer in-app pages for hub CTAs. */
export const DEV_DOCS_BASE = "https://doodersrage.github.io/thermaltrace";

export const INTEGRATION_CARDS: IntegrationCard[] = [
  {
    id: "home-assistant",
    title: "Home Assistant (HACS)",
    summary:
      "Official custom integration: share-link sensors, snooze/vacation services, optional push ingest. Dual-run with MQTT on your LAN.",
    href: HA_INTEGRATION_PAGE,
    tier: "Family live link (Free) · Pro for history/metrics + inbound",
    cta: "Install guide",
    secondaryHref: "/about/home-assistant-notify-recipes",
    secondaryLabel: "Notify / TTS recipes",
  },
  {
    id: "matter",
    title: "Matter / Apple Home",
    summary:
      "Matterbridge plugin that polls a share link and exposes temperature, humidity, leak, door, power, and motion to Apple Home, Google Home, and Alexa. Runs on a LAN host — not CSA-certified.",
    href: MATTER_INTEGRATION_PAGE,
    tier: "Family live link (Free) · Pro for snooze switch",
    cta: "Matter bridge guide",
    secondaryHref: MATTER_REPO_URL,
    secondaryLabel: "GitHub plugin",
    secondaryExternal: true,
  },
  {
    id: "smartthings",
    title: "SmartThings (via Matter)",
    summary:
      "No Cloud-to-Cloud app: add the ThermalTrace Matterbridge on your LAN so SmartThings sees the same garage sensors as Apple Home.",
    href: SMARTTHINGS_INTEGRATION_PAGE,
    tier: "Family live link (Free)",
    cta: "SmartThings path",
    secondaryHref: MATTER_INTEGRATION_PAGE,
    secondaryLabel: "Matter bridge",
  },
  {
    id: "node-red",
    title: "Node-RED",
    summary:
      "Import a ready-made flow to mirror Mosquitto topics to ThermalTrace over HTTPS. Keep the broker local; optional door-sensor tab.",
    href: NODERED_INTEGRATION_PAGE,
    cta: "Node-RED guide",
    secondaryHref: NODERED_FLOW_URL,
    secondaryLabel: "Download flow JSON",
  },
  {
    id: "mqtt-bridge",
    title: "MQTT bridge",
    summary:
      "Keep Mosquitto local; mirror readings over HTTPS JSON push or pull feeds for household freeze and leak alerts and history.",
    href: "/about/mqtt-bridge",
    cta: "Bridge recipe",
    secondaryHref: `${DEV_DOCS_BASE}/integrations/mqtt-bridge`,
    secondaryLabel: "Developer docs",
    secondaryExternal: true,
  },
  {
    id: "webhooks",
    title: "Alert & reading webhooks",
    summary: "Pro webhooks go both ways: configure in Dashboard → Alerts / Share.",
    href: "/about/ingest-and-webhooks",
    tier: "Pro",
    cta: "In-app guide",
    bullets: [
      "Outbound: alert POSTs (optional HMAC) and high-volume reading webhooks on ingest",
      "Inbound: snooze / vacation / status endpoints for HA, Zapier, n8n, or Make",
    ],
    secondaryHref: `${DEV_DOCS_BASE}/integrations/webhooks`,
    secondaryLabel: "Payload reference",
    secondaryExternal: true,
  },
  {
    id: "grafana",
    title: "Grafana & Prometheus",
    summary:
      "Scrape GET /api/v1/metrics with a dashboard API key; download bundled Grafana dashboard JSON from Dashboard → Share.",
    href: "/docs/api",
    tier: "Pro API key",
    cta: "HTTP API (metrics)",
    secondaryHref: `${DEV_DOCS_BASE}/integrations/grafana`,
    secondaryLabel: "Grafana dashboard docs",
    secondaryExternal: true,
  },
  {
    id: "influx",
    title: "InfluxDB & Telegraf",
    summary:
      "Scrape the same Pro Prometheus metrics into InfluxDB 2.x, VictoriaMetrics, or any Telegraf output.",
    href: INFLUX_INTEGRATION_PAGE,
    tier: "Pro API key",
    cta: "Influx / Telegraf guide",
    secondaryHref: TELEGRAF_CONFIG_URL,
    secondaryLabel: "Download Telegraf config",
  },
  {
    id: "thermostat",
    title: "Nest & Ecobee",
    summary:
      "On thermaltrace.dev, Pro households connect Nest or Ecobee from Dashboard → Temperature for house setpoint context next to attic, crawlspace, and shop probes. Self-hosted deployments need the operator to enable OAuth client secrets first.",
    href: "/compare/nest",
    tier: "Pro (enabled on thermaltrace.dev)",
    cta: "vs Nest / Ecobee",
    secondaryHref: "/about/thermostat-oauth",
    secondaryLabel: "Operator OAuth setup",
  },
  {
    id: "esphome-shelly",
    title: "ESPHome & Shelly",
    summary:
      "HTTP POST recipes for DHT/BME probes and Shelly door contacts, no custom Arduino firmware required.",
    href: "/about/esphome-shelly-recipes",
    cta: "LAN sensor recipes",
  },
  {
    id: "personal-weather",
    title: "Ambient & WeatherFlow",
    summary:
      "Use your backyard weather station for outdoor context, NWS alerts, and forecast freeze risk.",
    href: "/about/personal-weather-stations",
    cta: "Station setup",
  },
  {
    id: "zapier",
    title: "Zapier & Make",
    summary:
      "Catch outbound alert hooks or POST inbound snooze actions from no-code automations.",
    href: "/about/zapier-make-recipes",
    cta: "Recipes",
  },
  {
    id: "automation",
    title: "IFTTT, n8n & Sheets",
    summary:
      "IFTTT Maker webhooks, self-hosted n8n, Google Sheets alert logs, and Notion databases from the same Pro outbound payload.",
    href: AUTOMATION_INTEGRATION_PAGE,
    tier: "Pro outbound webhook",
    cta: "IFTTT / n8n guide",
    secondaryHref: N8N_ALERT_SHEETS_FLOW_URL,
    secondaryLabel: "n8n → Sheets workflow",
  },
  {
    id: "freeze-map-embed",
    title: "Freeze map embed & badge",
    summary:
      "Drop the public opt-in freeze-risk map into a blog, Home Assistant dashboard, or README: iframe embed plus Markdown badge.",
    href: "/freeze-map#embed",
    tier: "Public (opt-in aggregates)",
    cta: "Embed & badge",
  },
];

export const HACS_BADGE_CUSTOM =
  "https://img.shields.io/badge/HACS-Custom-orange.svg?style=for-the-badge";

export const HACS_BADGE_DEFAULT =
  "https://img.shields.io/badge/HACS-Default-41BDF5.svg?style=for-the-badge";

/** Use Default badge after hacs/default PR merges; Custom until then. */
export const HACS_BADGE_URL = HACS_BADGE_CUSTOM;

export const HACS_DOCS_URL = HA_DEV_DOCS_INTEGRATIONS;

export { HACS_REPO_URL } from "./homeAssistantIntegration";
export { MATTER_REPO_URL } from "./matterIntegration";
