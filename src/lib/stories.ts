/**
 * Illustrative scenarios, not customer accounts: each one walks through how
 * ThermalTrace behaves in a common failure (heater trip, stuck vent, wet pan)
 * using real features and plan limits. Keep them labeled as scenarios and never
 * attribute quotes, names, or results to real people.
 */
export type Story = {
  slug: string;
  path: string;
  headline: string;
  title: string;
  description: string;
  /** The kind of space, e.g. "Attached garage, cold climate". Not a real location. */
  setting: string;
  datePublished: string;
  /** Set when the scenario is meaningfully revised. */
  dateModified?: string;
  ogImage: string;
  /** Optional Creative Commons hero from aboutPhotos (not used on dashboard). */
  photoId?: import("./aboutPhotos").AboutPhotoId;
  setup: string[];
  timeline: Array<{ time: string; detail: string }>;
  /** Why the scenario matters: the takeaway, not a claimed result. */
  outcome: string;
  faqs: Array<{ question: string; answer: string }>;
};

export const stories: Story[] = [
  {
    slug: "garage-freeze-alert",
    path: "/stories/garage-freeze-alert",
    headline: "Garage heater failure scenario",
    title: "A garage heater trips at 2 a.m.",
    description:
      "Scenario: a garage heater fails overnight in a cold snap. How an ESP32 probe, a 34°F freeze threshold, and SMS alerts buy time before pipes freeze.",
    setting: "Heated garage with plumbing, cold climate",
    datePublished: "2025-11-01",
    dateModified: "2026-09-28",
    ogImage: "/og-story-freeze.jpg",
    setup: [
      "ESP32 + DHT22 pushing every 5 minutes to ThermalTrace ingest",
      "Freeze threshold at 34°F with SMS (Pro) and Telegram routing",
      "Weekly digest for the household; family live link for a neighbor who watches the house",
    ],
    timeline: [
      { time: "2:14 a.m.", detail: "The garage crosses 34°F; ThermalTrace texts both owners and posts to a Telegram family channel." },
      { time: "2:22 a.m.", detail: "One owner power-cycles the heater through a smart plug." },
      { time: "3:05 a.m.", detail: "The chart shows the temperature recovering, well before the pipes reach 32°F." },
    ],
    outcome:
      "A heater failure is only a disaster if nobody finds out until morning. The threshold sits a couple of degrees above freezing so there is time to respond, and SMS is what wakes you up at 2 a.m.; email alone is easy to sleep through.",
    faqs: [
      {
        question: "Which alert channels wake you up overnight?",
        answer:
          "SMS (Pro) and push (every plan) are the ones that reliably wake people up. Email and chat channels like Telegram are also on every plan and work well as a second route.",
      },
      {
        question: "What hardware does this take?",
        answer:
          "An ESP32 with a DHT22 or waterproof DS18B20 pushing every few minutes to ThermalTrace ingest, and a freeze threshold around 34°F.",
      },
    ],
  },
  {
    slug: "cabin-winter-watch",
    path: "/stories/cabin-winter-watch",
    headline: "Empty cabin furnace outage scenario",
    title: "The cabin furnace quits mid-week",
    description:
      "Scenario: a power blip resets the furnace in an empty winter cabin. A crawlspace probe and email and push alerts catch it days before your next visit.",
    setting: "Vacation cabin, empty most of the week",
    datePublished: "2025-12-12",
    dateModified: "2026-09-28",
    ogImage: "/og-story-freeze.jpg",
    photoId: "snow-cabins",
    setup: [
      "Wi-Fi ESP8266 near the mechanical room, two probes (living space + crawlspace)",
      "Email plus browser push; freeze threshold 36°F",
      "A local friend invited to the household as a backup responder",
    ],
    timeline: [
      { time: "Tue 11:40 a.m.", detail: "A power blip resets the furnace; the crawlspace drifts below 36°F." },
      { time: "Tue 11:41 a.m.", detail: "Push and email go out; the owner calls the local friend." },
      { time: "Tue 1:10 p.m.", detail: "The friend resets the furnace and the chart climbs before the evening cold." },
    ],
    outcome:
      "Empty buildings fail silently. The value is the lead time: a Tuesday alert instead of discovering frozen pipes on Friday.",
    faqs: [
      {
        question: "Do you need SMS for a cabin?",
        answer:
          "Not always. Email and push work when someone can respond within a couple of hours. SMS (Pro) helps when you may be away from a data connection.",
      },
      {
        question: "How many probes?",
        answer:
          "Two: one in the living space for context, one in the crawlspace where the freeze risk to pipes actually is.",
      },
    ],
  },
  {
    slug: "server-closet-heat",
    path: "/stories/server-closet-heat",
    headline: "Server closet overheating scenario",
    title: "A closet fan dies before the weekend",
    description:
      "Scenario: a homelab closet fan fails while you're away. A ThermalTrace heat rule and a Home Assistant webhook power down gear before it overheats.",
    setting: "Homelab closet next to a garage",
    datePublished: "2026-01-18",
    dateModified: "2026-09-28",
    ogImage: "/og-dashboard.jpg",
    photoId: "server-rack",
    setup: [
      "An ESP32 already watching the garage; a second probe in the closet",
      "Heat rule at 95°F (Alerts → Rules → Add heat rule) alongside freeze watch on the garage side",
      "Outbound webhook (Pro) into Home Assistant to switch off a smart plug",
    ],
    timeline: [
      { time: "Fri 6:05 p.m.", detail: "The closet reaches 96°F after a fan fails; the heat rule fires and the webhook reaches Home Assistant." },
      { time: "Fri 6:06 p.m.", detail: "An automation powers down non-critical gear; SMS confirms the alert." },
      { time: "Sat morning", detail: "The owner replaces the fan; the history chart shows how fast the closet heated." },
    ],
    outcome:
      "The same probes and ingest path cover both failure modes: freeze on the garage side, heat in the closet.",
    faqs: [
      {
        question: "Is ThermalTrace only for cold?",
        answer:
          "No. Freeze alerts are built in, and heat uses a rule (Temperature above, default 95°F) that you add in one click under Alerts → Rules.",
      },
      {
        question: "How does Home Assistant fit?",
        answer:
          "Pro outbound webhooks POST alert JSON to Home Assistant, where an automation can switch a smart plug. The official HACS integration also exposes readings as sensors and adds snooze services; see thermaltrace.dev/integrations/home-assistant.",
      },
    ],
  },
  {
    slug: "pipe-near-miss",
    path: "/stories/pipe-near-miss",
    headline: "Attached garage cold corner scenario",
    title: "The same corner dips below 34°F every clear night",
    description:
      "Scenario: repeat freeze alerts in an attached garage. How ThermalTrace history and CSV export point to a drafty door seal before supply lines ice.",
    setting: "Attached garage with a water heater",
    datePublished: "2026-02-04",
    dateModified: "2026-09-28",
    ogImage: "/og-story-freeze.jpg",
    photoId: "basement-pex-pipes",
    setup: [
      "Arduino + DHT22 on a shelf above the water heater",
      "Email alerts at 34°F on the Free plan; Member for CSV export",
      "Indoor garage compared against outdoor weather on the dashboard",
    ],
    timeline: [
      { time: "Week 1", detail: "Alerts fire on clear, still nights; it looks like ordinary cold." },
      { time: "Week 2", detail: "History and CSV show the door-side probe dipping first every time." },
      { time: "Week 3", detail: "After weatherstripping the door, nights stay above the threshold." },
    ],
    outcome:
      "An alert tells you something is wrong; history tells you where. A cheap seal fix beats waiting for the night it gets cold enough to split a pipe.",
    faqs: [
      {
        question: "Is the Free plan enough for this?",
        answer:
          "Free email alerts catch the problem. Member adds CSV export and longer history, which makes a repeating pattern easy to see.",
      },
      {
        question: "Do attached garages freeze?",
        answer:
          "Yes, especially along exterior walls and leaky doors. Attached is not the same as heated.",
      },
    ],
  },
  {
    slug: "crawlspace-pipe-watch",
    path: "/stories/crawlspace-pipe-watch",
    headline: "Crawlspace vent scenario",
    title: "A crawlspace vent sticks open overnight",
    description:
      "Scenario: a foundation vent sticks open on a cold night. How a waterproof DS18B20 on the supply line and ThermalTrace freeze alerts give you time to close it.",
    setting: "Crawlspace under a house, cold climate",
    datePublished: "2026-02-20",
    dateModified: "2026-09-28",
    ogImage: "/og-story-freeze.jpg",
    photoId: "basement-pex-pipes",
    setup: [
      "ESP32 + waterproof DS18B20 zip-tied near the main supply run",
      "Freeze threshold 36°F with email and SMS (Pro)",
      "Family live link for a relative who lives nearby",
    ],
    timeline: [
      { time: "Sun 4:05 a.m.", detail: "The crawlspace crosses 36°F with a foundation vent stuck open." },
      { time: "Sun 4:06 a.m.", detail: "SMS and email go out; the nearby relative checks the live link and heads over." },
      { time: "Sun 5:20 a.m.", detail: "The vent is closed and the chart starts climbing before the morning low." },
    ],
    outcome:
      "Nobody checks a crawlspace at 4 a.m. A probe on the pipe run, not at the hatch, is what turns a stuck vent into a quick fix.",
    faqs: [
      {
        question: "Where should the crawlspace probe go?",
        answer:
          "On or next to the coldest supply line, not at the access hatch. Add a living-space probe if you want context from upstairs.",
      },
      {
        question: "Is a humidity sensor enough?",
        answer:
          "No. Humidity helps spot moisture, but freeze risk is the temperature at the pipes. Use a waterproof probe and a threshold a few degrees above 32°F.",
      },
    ],
  },
  {
    slug: "detached-garage-winter",
    path: "/stories/detached-garage-winter",
    headline: "Detached shop heater scenario",
    title: "A forecast warning, then a tripped heater",
    description:
      "Scenario: a detached shop heater trips its GFCI on a forecast cold night. Forecast warnings cover the day before; threshold alerts cover the night of.",
    setting: "Detached shop with a utility sink",
    datePublished: "2026-03-01",
    dateModified: "2026-09-28",
    ogImage: "/og-story-freeze.jpg",
    setup: [
      "Wi-Fi ESP32 above the utility sink; second probe near the overhead door",
      "Forecast freeze warnings (Member) plus email",
      "Vacation mode off before a trip, so alerts keep flowing",
    ],
    timeline: [
      { time: "Wed", detail: "A forecast warning flags Thursday's overnight low; the owner confirms the heater is on." },
      { time: "Thu 1:50 a.m.", detail: "The heater trips its GFCI; the shop crosses 34°F and the email goes out." },
      { time: "Thu 2:15 a.m.", detail: "The owner resets the circuit through a smart plug before the sink line freezes." },
    ],
    outcome:
      "Detached buildings lose heat fast. A forecast warning covers the planning window; the threshold alert covers the failure itself.",
    faqs: [
      {
        question: "Do detached garages need two probes?",
        answer:
          "One near the pipes or sink is enough to start. A second near the door catches drafts the back wall never sees.",
      },
      {
        question: "Is Free enough for a detached shop?",
        answer:
          "Free email alerts work. Member adds forecast warnings, which help when you are away and want notice before the overnight low.",
      },
    ],
  },
  {
    slug: "water-heater-pad-leak",
    path: "/stories/water-heater-pad-leak",
    headline: "Water heater drip scenario",
    title: "A water heater drips at 3 a.m.",
    description:
      "Scenario: a garage water heater's drain valve drips overnight. A flood contact in the pan alerts you before the slab and stored boxes get soaked.",
    setting: "Garage with a water heater and storage",
    datePublished: "2026-03-08",
    dateModified: "2026-09-28",
    ogImage: "/og-story-freeze.jpg",
    photoId: "basement-pex-pipes",
    setup: [
      "The ESP32 already pushing garage temperature; a wet/dry contact added in the heater pan",
      "Ingest kind flood: alerts automatically when wet, no custom rule needed",
      "Email plus SMS (Pro); the freeze threshold keeps watching the same space",
    ],
    timeline: [
      { time: "3:08 a.m.", detail: "The flood contact reports wet; SMS and email go out even though vacation mode is on." },
      { time: "3:20 a.m.", detail: "A neighbor with the family live link checks in and finds a drip at the drain valve." },
      { time: "Morning", detail: "A plumber tightens the valve while the slab is still mostly dry." },
    ],
    outcome:
      "Leaks don't wait for a freeze. Flood contacts share the same device and ingest path, and wet alerts get through even when vacation mode mutes the routine ones.",
    faqs: [
      {
        question: "Do flood alerts need a custom rule?",
        answer:
          "No. With alerts enabled, wet flood/leak contacts notify automatically. Use a rule only to combine flood with door or temperature conditions.",
      },
      {
        question: "Where should the contact sit?",
        answer:
          "On the pan floor, away from normal condensation drips. Test with a damp cloth, then dry it so it doesn't stay in a wet state.",
      },
    ],
  },
];

export function getStory(slug: string): Story | undefined {
  return stories.find((s) => s.slug === slug);
}
