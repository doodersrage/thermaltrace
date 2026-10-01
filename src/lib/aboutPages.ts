import { expandedAboutPageMeta } from "./aboutExpandedPages";

export type AboutPage = {
  slug: string;
  title: string;
  description: string;
  summary: string;
  parentSlug?: string;
};

export const coreAboutPages: AboutPage[] = [
  {
    slug: "temperature-probes",
    title: "Temperature probes and their uses",
    description:
      "How temperature probes work in garages, workshops, attics, crawlspaces, and shops, where they are placed, and why multiple sensors improve reliability.",
    summary:
      "Probe types, placement strategies, and why averaging multiple sensors matters in unheated spaces.",
  },
  {
    slug: "temperature-changes",
    title: "Temperature changes and what causes them",
    description:
      "Understand daily swings, seasonal shifts, and sudden temperature changes in unheated spaces driven by weather and building physics.",
    summary:
      "Sun load, infiltration, doors, HVAC, and stored heat explain most temperature movement in garages, attics, and shops.",
  },
  {
    slug: "historical-data",
    title: "Historical temperature data usage",
    description:
      "Why saved readings matter for trend analysis, freeze protection, equipment checks, and CSV export workflows.",
    summary:
      "Turn snapshots into charts, alerts, and long-term records for maintenance and seasonal planning.",
  },
  {
    slug: "arduino-sketches",
    title: "Arduino and Arduino sketches",
    description:
      "Firmware architecture for network-connected temperature probes using Arduino boards and humidity sensors.",
    summary:
      "Sketches read probes, format JSON, and publish readings over HTTPS from the monitored space to the web.",
  },
  {
    slug: "arduino-circuit-wiring",
    title: "Arduino circuit wiring overview",
    description:
      "High-level wiring for an Arduino Uno with Ethernet shield, breadboard power rails, LCD contrast, and two DHT22 sensors.",
    summary:
      "How USB power, the breadboard, contrast pot, LCD, sensors, and Ethernet shield fit together.",
  },
  {
    slug: "arduino-pin-wiring",
    title: "Arduino pin-level wiring",
    description:
      "Exact GPIO assignments for the 16×2 LCD, DHT22 data lines, backlight transistor, and reserved SPI pins.",
    summary:
      "Pin-by-pin map matching the LiquidCrystal constructor and sensor data lines in firmware.",
  },
  {
    slug: "arduino-dht22-lcd",
    title: "DHT22 sensors and LCD display",
    description:
      "Dual DHT22 polling, local LCD readouts, backlight control, and how the Ethernet shield shares the header.",
    summary:
      "Why two probes show separate readings on the LCD while JSON feeds expose both to the website.",
  },
  {
    slug: "python-feeds",
    title: "Python scripts and JSON feeds",
    description:
      "FastAPI relay services, Redis caching, and Python tooling that sit between probes and the dashboard.",
    summary:
      "Backend scripts normalize probe JSON, cache responses, and expose stable HTTPS endpoints.",
  },
  {
    slug: "astro-applications",
    title: "Astro applications in this project",
    description:
      "How Astro server rendering, islands, and Cloudflare Workers deployment power ThermalTrace pages, dashboards, and edge API routes.",
    summary:
      "This site uses Astro for fast pages, authenticated dashboards, and API routes at the edge.",
  },
  {
    slug: "nextjs-node-applications",
    title: "Next.js and Node applications",
    description:
      "Compare Node and Next.js monitoring dashboards with ThermalTrace’s Astro-on-Cloudflare stack and when each fits DIY space-sensor projects.",
    summary:
      "Node runtimes excel at APIs and SSR; this project achieves the same goals with Astro on Cloudflare.",
  },
  {
    slug: "data-flow",
    title: "End-to-end monitoring data flow",
    description:
      "Follow a reading from the probe wire through JSON feeds, storage, and the signed-in history dashboard.",
    summary:
      "Hardware, relay, website fetch, Supabase storage, and CSV export in one pipeline.",
  },
  {
    slug: "accounts-and-dashboard",
    title: "Accounts, subscriptions, and dashboard tools",
    description:
      "Signed-in setup checklist, devices and sensors, alerts, households, share links, Stripe plans, and admin tools.",
    summary:
      "Create an account, connect hardware, configure alerts, invite household members, and upgrade when you need Pro channels.",
  },
  {
    slug: "ingest-and-webhooks",
    title: "Ingest API and alert webhooks",
    description:
      "Push sensor readings into ThermalTrace with the ingest API: native JSON, SenML, or Home Assistant REST, and send alerts to Discord, IFTTT, or Home Assistant.",
    summary:
      "Device API keys, typed sensor payloads, SenML and HA REST auto-detect, outbound HMAC webhooks, and Pro alert channels.",
  },
  {
    slug: "thermostat-oauth",
    title: "Nest & Ecobee thermostat OAuth (operators)",
    description:
      "Enable Nest and Ecobee OAuth on your ThermalTrace deployment so Pro households can connect thermostats for indoor context on freeze and leak alerts.",
    summary:
      "Device Access Console, Ecobee developer app, redirect URIs, and Worker secrets for NEST_* and ECOBEE_CLIENT_ID.",
  },
  {
    slug: "adding-devices",
    title: "Adding push and pull devices",
    description:
      "Step-by-step: create a push ingest device or HTTPS pull feed, map JSON keys to Home labels, and verify live readings.",
    summary:
      "Choose push vs pull, create the device or feed, POST or pull readings, and confirm Home shows live values.",
  },
  {
    slug: "mqtt-bridge",
    title: "MQTT bridge recipe",
    description:
      "Keep Mosquitto or Home Assistant MQTT on your LAN and mirror readings to ThermalTrace over HTTPS for household freeze and leak alerts and history.",
    summary:
      "POST /api/ingest/mqtt, Home Assistant rest_command, and Node-RED flow: dual-run without exposing your broker.",
  },
  {
    slug: "install-pwa",
    title: "Install as an app (PWA)",
    description:
      "Install ThermalTrace as a PWA on desktop, Android, or iOS for faster dashboard access and optional browser push freeze and leak alerts.",
    summary:
      "Desktop, Android, and iOS install steps, plus Web Push limits on Apple devices.",
  },
];

function buildAboutPages(): AboutPage[] {
  const expandedByParent = new Map<string, AboutPage[]>();

  for (const page of expandedAboutPageMeta) {
    const parent = page.parentSlug;
    if (!parent) continue;
    const group = expandedByParent.get(parent) ?? [];
    group.push(page);
    expandedByParent.set(parent, group);
  }

  const pages: AboutPage[] = [];

  for (const core of coreAboutPages) {
    pages.push(core);
    const children = expandedByParent.get(core.slug);
    if (children) {
      pages.push(...children);
    }
  }

  return pages;
}

export const aboutPages: AboutPage[] = buildAboutPages();

export function getAboutStats(): {
  coreCount: number;
  guideCount: number;
  totalCount: number;
} {
  const guideCount = aboutPages.filter((page) => page.parentSlug).length;
  return {
    coreCount: coreAboutPages.length,
    guideCount,
    totalCount: aboutPages.length,
  };
}

export function getAboutPage(slug: string): AboutPage | undefined {
  return aboutPages.find((page) => page.slug === slug);
}

export function getAboutParent(slug: string): AboutPage | undefined {
  const page = getAboutPage(slug);
  if (!page?.parentSlug) return undefined;
  return getAboutPage(page.parentSlug);
}
