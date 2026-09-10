import { getAboutPage, type AboutPage } from "./aboutPages";

export type AboutJourneyStep = {
  slug: string;
  label: string;
};

export type AboutJourney = {
  id: string;
  title: string;
  description: string;
  ctaHref: string;
  ctaLabel: string;
  steps: AboutJourneyStep[];
};

/** Job-based paths on the about hub: intent first, topics second. */
export const aboutJourneys: AboutJourney[] = [
  {
    id: "winter-pipes",
    title: "Protect pipes this winter",
    description:
      "Set freeze thresholds, add a wet/dry leak contact, wire alerts, and see how a real cold snap or pad leak looked in the stories.",
    ctaHref: "/register?next=/dashboard/devices",
    ctaLabel: "Start free monitoring",
    steps: [
      { slug: "freeze-protection-thresholds", label: "Freeze thresholds" },
      { slug: "time-to-freeze", label: "Time-to-freeze" },
      { slug: "cold-snap-playbook", label: "Cold-snap playbook" },
      { slug: "freeze-thaw-flood-playbook", label: "Thaw flood playbook" },
      { slug: "alert-channel-cookbook", label: "Alert channels" },
      { slug: "temperature-probe-case-study", label: "Case study" },
    ],
  },
  {
    id: "first-dht22",
    title: "Wire my first DHT22",
    description:
      "Sensor basics, pin wiring, and the Arduino sketch that publishes JSON.",
    ctaHref: "/about/arduino-sketches",
    ctaLabel: "Open Arduino overview",
    steps: [
      { slug: "dht22-sensor-overview", label: "DHT22 overview" },
      { slug: "dht22-data-line-wiring", label: "Data line wiring" },
      { slug: "arduino-pin-wiring", label: "Pin map" },
      { slug: "arduino-sketches", label: "Firmware sketch" },
    ],
  },
  {
    id: "esp-ingest",
    title: "Push from ESP / Pico / MCU / AVR asm",
    description:
      "Create a push device, POST so sensors auto-import, and optional OTA / QR stickers.",
    ctaHref: "/about/adding-devices",
    ctaLabel: "Add a device",
    steps: [
      { slug: "adding-devices", label: "Add push or pull" },
      { slug: "esp32-freeze-kit", label: "Buy ESP32 kit" },
      { slug: "pico-w-ingest", label: "Or flash Pico W" },
      { slug: "stm32-zephyr-ingest", label: "Or flash STM32" },
      { slug: "ch32v-riscv-ingest", label: "Or flash CH32V" },
      { slug: "avr-asm-ingest", label: "Or AVR assembly" },
      { slug: "cellular-ingest", label: "Or cellular LTE" },
      { slug: "teensy41-ingest", label: "Or Teensy 4.1" },
      { slug: "pic18-ethernet-ingest", label: "Or PIC18 Ethernet" },
      { slug: "ingest-and-webhooks", label: "Ingest API" },
      { slug: "kit-qr-onboarding", label: "Kit QR" },
      { slug: "esp32-web-flash", label: "Flash ESP32" },
      { slug: "esp32-ota-firmware", label: "ESP32 OTA" },
    ],
  },
  {
    id: "understand-readings",
    title: "Understand my readings",
    description:
      "Why garages swing, how data reaches the site, and how to spot stale feeds.",
    ctaHref: "/about/probe-demo",
    ctaLabel: "Try the probe demo",
    steps: [
      { slug: "temperature-changes", label: "What causes swings" },
      { slug: "data-flow", label: "Data flow" },
      { slug: "debugging-stale-readings", label: "Stale readings" },
      { slug: "historical-data", label: "History & CSV" },
    ],
  },
  {
    id: "share-household",
    title: "Share with my household",
    description:
      "Invite family, understand roles, and keep freeze and leak alerts in one place.",
    ctaHref: "/register?next=/dashboard/devices",
    ctaLabel: "Create a free account",
    steps: [
      { slug: "household-sharing-walkthrough", label: "Sharing walkthrough" },
      { slug: "accounts-and-dashboard", label: "Accounts & dashboard" },
      { slug: "group-membership-model", label: "Roles & groups" },
      { slug: "install-pwa", label: "Install the PWA" },
    ],
  },
];

export function getAboutJourneys(): AboutJourney[] {
  return aboutJourneys;
}

/** Journeys that include this guide, with the next unread step when possible. */
export function getJourneysForSlug(slug: string): Array<{
  journey: AboutJourney;
  stepIndex: number;
  nextStep: AboutJourneyStep | null;
  previousStep: AboutJourneyStep | null;
}> {
  const matches: Array<{
    journey: AboutJourney;
    stepIndex: number;
    nextStep: AboutJourneyStep | null;
    previousStep: AboutJourneyStep | null;
  }> = [];

  for (const journey of aboutJourneys) {
    const stepIndex = journey.steps.findIndex((step) => step.slug === slug);
    if (stepIndex < 0) continue;
    matches.push({
      journey,
      stepIndex,
      previousStep: stepIndex > 0 ? journey.steps[stepIndex - 1]! : null,
      nextStep:
        stepIndex < journey.steps.length - 1
          ? journey.steps[stepIndex + 1]!
          : null,
    });
  }

  return matches;
}

export function resolveJourneyStepPages(
  journey: AboutJourney,
): Array<AboutJourneyStep & { page: AboutPage | undefined }> {
  return journey.steps.map((step) => ({
    ...step,
    page: getAboutPage(step.slug),
  }));
}
