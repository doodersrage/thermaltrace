import { getAboutPage } from "./aboutPages";

export type GuideHubLink = {
  href: string;
  label: string;
  summary: string;
  /** Other hub category ids: shown as intentional cross-refs, not duplicate listings. */
  alsoIn?: string[];
};

export type GuideHubCategory = {
  id: string;
  title: string;
  description: string;
  links: GuideHubLink[];
};

type GuideHubLinkDef = {
  href: string;
  slug?: string;
  label?: string;
  summary?: string;
  alsoIn?: string[];
};

type GuideHubCategoryDef = {
  id: string;
  title: string;
  description: string;
  links: GuideHubLinkDef[];
};

const GUIDE_HUB_DEFS: GuideHubCategoryDef[] = [
  {
    id: "hardware",
    title: "Hardware setup",
    description:
      "Sensors, wiring, firmware, and creating push/pull devices on the dashboard.",
    links: [
      {
        href: "/about/adding-devices",
        slug: "adding-devices",
        alsoIn: ["api"],
      },
      { href: "/about/esp32-freeze-kit", slug: "esp32-freeze-kit" },
      { href: "/about/dht22-sensor-overview", slug: "dht22-sensor-overview" },
      { href: "/about/arduino-circuit-wiring", slug: "arduino-circuit-wiring" },
      { href: "/about/arduino-sketches", slug: "arduino-sketches" },
      { href: "/about/esp32-ota-firmware", slug: "esp32-ota-firmware" },
      { href: "/about/esp32-web-flash", slug: "esp32-web-flash" },
      { href: "/about/pico-w-ingest", slug: "pico-w-ingest" },
      { href: "/about/stm32-zephyr-ingest", slug: "stm32-zephyr-ingest" },
      { href: "/about/ch32v-riscv-ingest", slug: "ch32v-riscv-ingest" },
      { href: "/about/avr-asm-ingest", slug: "avr-asm-ingest" },
      { href: "/about/cellular-ingest", slug: "cellular-ingest" },
      { href: "/about/teensy41-ingest", slug: "teensy41-ingest" },
      { href: "/about/pic18-ethernet-ingest", slug: "pic18-ethernet-ingest" },
      { href: "/about/probe-demo", slug: "probe-demo" },
      {
        href: "/accessories",
        label: "Hardware accessories",
        summary: "Claim puck, alert beacon, door/leak/power contacts, kit labels, mounts.",
      },
      {
        href: "/claim-puck",
        label: "Claim puck",
        summary: "RP2040-Zero presence key and bay mood LED.",
      },
      {
        href: "/leak-puck",
        label: "Leak contact puck",
        summary: "Water pads that POST wet/dry flood sensors.",
      },
    ],
  },
  {
    id: "alerts",
    title: "Alerts",
    description: "Freeze thresholds, leak alerts, cold-snap playbooks, and notification channels.",
    links: [
      { href: "/about/freeze-protection-thresholds", slug: "freeze-protection-thresholds" },
      { href: "/about/time-to-freeze", slug: "time-to-freeze" },
      { href: "/about/cold-snap-playbook", slug: "cold-snap-playbook" },
      { href: "/about/freeze-thaw-flood-playbook", slug: "freeze-thaw-flood-playbook" },
      { href: "/about/garage-door-cold-playbook", slug: "garage-door-cold-playbook" },
      { href: "/about/personal-weather-stations", slug: "personal-weather-stations" },
      { href: "/about/alert-channel-cookbook", slug: "alert-channel-cookbook" },
      {
        href: "/stories/garage-freeze-alert",
        label: "Freeze case study",
        summary: "How a probe curve caught a cold night before pipes froze.",
      },
      {
        href: "/stories/water-heater-pad-leak",
        label: "Leak case study",
        summary: "How a wet contact under a garage water heater caught a drip before it soaked the slab.",
      },
    ],
  },
  {
    id: "sharing",
    title: "Sharing",
    description: "Household access, the phone app you can install today, and public status pages.",
    links: [
      { href: "/about/household-sharing-walkthrough", slug: "household-sharing-walkthrough" },
      { href: "/about/accounts-and-dashboard", slug: "accounts-and-dashboard" },
      { href: "/about/install-pwa", slug: "install-pwa" },
      {
        href: "/apps",
        label: "Companion apps",
        summary: "Android, Desktop, Bay Buddy, and PWA clients for your account.",
      },
      {
        href: "/android",
        label: "Android app (early access)",
        summary: "GitHub build/sideload while Play review finishes; PWA works today.",
      },
    ],
  },
  {
    id: "integrations",
    title: "Integrations",
    description:
      "Home Assistant HACS, Matter / Apple Home, MQTT→HTTPS bridge, ESPHome/Shelly, and comparison guides. Payload schemas live under API.",
    links: [
      {
        href: "/integrations",
        label: "Integrations hub",
        summary: "Home Assistant HACS, Matter bridge, MQTT, Grafana, webhooks, Nest/Ecobee, and Zapier.",
      },
      {
        href: "/integrations/home-assistant",
        label: "Home Assistant (HACS)",
        summary:
          "Official custom integration: share-link sensors, snooze/vacation services, optional push ingest.",
        alsoIn: ["api"],
      },
      {
        href: "/integrations/matter",
        label: "Matter / Apple Home",
        summary:
          "Matterbridge plugin: share-link sensors in Apple Home, Google Home, and Alexa (not CSA-certified).",
      },
      {
        href: "/about/mqtt-bridge",
        slug: "mqtt-bridge",
        alsoIn: ["api"],
      },
      { href: "/about/esphome-shelly-recipes", slug: "esphome-shelly-recipes" },
      {
        href: "/compare/diy-mqtt",
        label: "vs DIY MQTT",
        summary: "When hosted freeze and leak alerts beat self-hosting Mosquitto and cron.",
      },
    ],
  },
  {
    id: "api",
    title: "API",
    description:
      "Ingest payloads, outbound webhooks, OpenAPI, and Zapier/Make. Device creation is under Hardware; HACS and MQTT under Integrations.",
    links: [
      { href: "/about/ingest-and-webhooks", slug: "ingest-and-webhooks" },
      {
        href: "/docs/api",
        label: "HTTP API documentation",
        summary: "Ingest, metrics, webhooks, and the OpenAPI spec.",
      },
      { href: "/about/zapier-make-recipes", slug: "zapier-make-recipes" },
    ],
  },
];

const CATEGORY_TITLE: Record<string, string> = Object.fromEntries(
  GUIDE_HUB_DEFS.map((c) => [c.id, c.title]),
);

function resolveLink(def: GuideHubLinkDef): GuideHubLink {
  if (def.slug) {
    const page = getAboutPage(def.slug);
    return {
      href: def.href,
      label: def.label ?? page?.title ?? def.slug,
      summary: def.summary ?? page?.summary ?? "",
      alsoIn: def.alsoIn,
    };
  }
  return {
    href: def.href,
    label: def.label ?? def.href,
    summary: def.summary ?? "",
    alsoIn: def.alsoIn,
  };
}

export function getGuideHubCategories(): GuideHubCategory[] {
  return GUIDE_HUB_DEFS.map((category) => ({
    id: category.id,
    title: category.title,
    description: category.description,
    links: category.links.map(resolveLink),
  }));
}

export function guideHubCategoryTitle(id: string): string {
  return CATEGORY_TITLE[id] ?? id;
}
