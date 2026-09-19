export type Story = {
  slug: string;
  path: string;
  headline: string;
  title: string;
  description: string;
  quote: string;
  location: string;
  datePublished: string;
  ogImage: string;
  /** Optional Creative Commons hero from aboutPhotos (not used on dashboard). */
  photoId?: import("./aboutPhotos").AboutPhotoId;
  setup: string[];
  timeline: Array<{ time: string; detail: string }>;
  outcome: string;
  faqs: Array<{ question: string; answer: string }>;
};

export const stories: Story[] = [
  {
    slug: "garage-freeze-alert",
    path: "/stories/garage-freeze-alert",
    headline: "Garage freeze alert case study",
    title: "We got the text before the pipes froze",
    description:
      "How a Minneapolis homeowner avoided pipe damage with ThermalTrace freeze alerts, ESP32 ingest, and Pro SMS when a space heater failed overnight.",
    quote: "We got the text before the pipes froze",
    location: "Minneapolis, MN",
    datePublished: "2025-11-01",
    ogImage: "/og-story-freeze.jpg",
    setup: [
      "ESP32 + DHT22 pushing every 5 minutes to ThermalTrace ingest",
      "Freeze threshold at 34°F with Pro SMS + Telegram routing",
      "Weekly digest for the household; share link for a neighbor who watches the house",
    ],
    timeline: [
      { time: "2:14 a.m.", detail: "Garage crossed 33°F; SMS to both owners + Telegram family channel." },
      { time: "2:22 a.m.", detail: "Owner restarted the space heater remotely via a smart plug." },
      { time: "3:05 a.m.", detail: "Temperature recovering; no pipe damage, no emergency plumber." },
    ],
    outcome:
      "One failed heater overnight would have meant a burst pipe. The alert paid for a year of Pro in a single night.",
    faqs: [
      {
        question: "What alert channels caught the freeze?",
        answer:
          "Pro SMS to both owners plus Telegram to a family channel when the garage crossed 33°F at 2:14 a.m.",
      },
      {
        question: "What hardware was used?",
        answer:
          "An ESP32 with a DHT22 pushing every five minutes to ThermalTrace ingest, with a 34°F freeze threshold.",
      },
    ],
  },
  {
    slug: "cabin-winter-watch",
    path: "/stories/cabin-winter-watch",
    headline: "Cabin winter watch case study",
    title: "Weekend cabin, weekday peace of mind",
    description:
      "How a Vermont cabin owner used ThermalTrace email and Pro push alerts to catch a furnace outage mid-week before pipes froze in an empty house.",
    quote: "The cabin texted us from three hours away",
    location: "Stowe, VT",
    datePublished: "2025-12-12",
    ogImage: "/og-story-freeze.jpg",
    photoId: "snow-cabins",
    setup: [
      "Wi-Fi ESP8266 near the mechanical room, two probes (indoor + crawlspace)",
      "Pro plan with email + browser push; freeze threshold 36°F",
      "Household invite for a local friend as backup responder",
    ],
    timeline: [
      { time: "Tue 11:40 a.m.", detail: "Crawlspace dropped below threshold after a power blip reset the furnace." },
      { time: "Tue 11:41 a.m.", detail: "Push + email fired; owner called the local friend." },
      { time: "Tue 1:10 p.m.", detail: "Friend reset the furnace; temps climbing before evening cold set in." },
    ],
    outcome:
      "Empty cabins fail silently. A mid-week alert beat a Friday arrival to frozen pipes and a flooded crawlspace.",
    faqs: [
      {
        question: "Do you need SMS for a cabin?",
        answer:
          "Email and Pro browser push were enough here because someone could respond within two hours. SMS helps when you’re offline hiking.",
      },
      {
        question: "How many probes?",
        answer:
          "Two: living space for comfort context, crawlspace for the freeze risk that actually matters.",
      },
    ],
  },
  {
    slug: "server-closet-heat",
    path: "/stories/server-closet-heat",
    headline: "Server closet heat case study",
    title: "Homelab heat spike before the weekend",
    description:
      "A Denver homelabber caught a stuck garage-door-adjacent server closet fan with ThermalTrace high-temp alerts and webhook → Home Assistant.",
    quote: "The closet was cooking and we were out of town",
    location: "Denver, CO",
    datePublished: "2026-01-18",
    ogImage: "/og-dashboard.jpg",
    photoId: "server-rack",
    setup: [
      "Existing ESP32 already on ThermalTrace for the garage; second probe in the closet",
      "High-temp threshold 95°F plus freeze watch on the garage side",
      "Pro webhook into Home Assistant to cut a smart plug if temps stayed high (today: use the HACS integration or outbound webhook blueprint)",
    ],
    timeline: [
      { time: "Fri 6:05 p.m.", detail: "Closet hit 96°F after a fan failed; webhook tripped HA automation." },
      { time: "Fri 6:06 p.m.", detail: "Non-critical gear powered down; SMS confirmed the cutover." },
      { time: "Sat a.m.", detail: "Owner replaced the fan; no cooked NAS, no melt smell." },
    ],
    outcome:
      "Same stack that watches freeze risk also watches heat. One ingest path, two failure modes covered.",
    faqs: [
      {
        question: "Is ThermalTrace only for cold?",
        answer:
          "No: thresholds work both ways. Freeze is the headline risk for garages; heat matters for closets and workshops.",
      },
      {
        question: "How did Home Assistant fit?",
        answer:
          "Pro outbound webhooks POST alert JSON into Home Assistant. An automation switched a smart plug when closet temp stayed elevated. Today you can also use the official HACS integration for share-link sensors and snooze services, see thermaltrace.dev/integrations/home-assistant.",
      },
    ],
  },
  {
    slug: "pipe-near-miss",
    path: "/stories/pipe-near-miss",
    headline: "Attached garage pipe near-miss",
    title: "Thirty-four degrees and a near miss",
    description:
      "An Ohio attached-garage household used ThermalTrace history and a 34°F alert to catch a drafty door seal before supply lines iced.",
    quote: "History showed the cold corner every clear night",
    location: "Columbus, OH",
    datePublished: "2026-02-04",
    ogImage: "/og-story-freeze.jpg",
    photoId: "basement-pex-pipes",
    setup: [
      "Arduino + DHT22 on a shelf above the water heater in the attached garage",
      "Free plan email alerts at 34°F while evaluating; upgraded to Member for CSV",
      "Compared indoor garage vs outdoor weather on the dashboard",
    ],
    timeline: [
      { time: "Week 1", detail: "Alerts fired on clear nights; owner assumed ‘just cold air.’" },
      { time: "Week 2", detail: "CSV export showed the same corner dipping first every time." },
      { time: "Week 3", detail: "Weatherstripped the door; nights stayed above threshold." },
    ],
    outcome:
      "The alert was the tip; history was the proof. Fixing the seal cost less than one thawed-pipe deductible.",
    faqs: [
      {
        question: "Was Free enough?",
        answer:
          "Free caught the problem with email. Member CSV made the cold-corner pattern obvious enough to fix the door.",
      },
      {
        question: "Attached garages still freeze?",
        answer:
          "Yes, especially against exterior walls and leaky doors. ‘Attached’ is not the same as ‘conditioned.’",
      },
    ],
  },
  {
    slug: "crawlspace-pipe-watch",
    path: "/stories/crawlspace-pipe-watch",
    headline: "Crawlspace pipe watch case study",
    title: "The crawlspace texted before the supply line iced",
    description:
      "How a Michigan homeowner used a DS18B20 in the crawlspace with ThermalTrace freeze alerts to catch a drafty vent before supply lines froze.",
    quote: "The crawlspace texted before the supply line iced",
    location: "Grand Rapids, MI",
    datePublished: "2026-02-20",
    ogImage: "/og-story-freeze.jpg",
    photoId: "basement-pex-pipes",
    setup: [
      "ESP32 + waterproof DS18B20 zip-tied near the main supply run in the crawlspace",
      "Freeze threshold 36°F with email + Pro SMS",
      "Share link for a sibling who lives closer and can close the vent",
    ],
    timeline: [
      { time: "Sun 4:05 a.m.", detail: "Crawlspace crossed 35°F after a foundation vent stuck open overnight." },
      { time: "Sun 4:06 a.m.", detail: "SMS to owner + email; sibling drove over with a flashlight." },
      { time: "Sun 5:20 a.m.", detail: "Vent closed and insulated; temps climbing before morning low." },
    ],
    outcome:
      "Crawlspaces fail silently. A probe on the pipe run beat a thawed-pipe deductible by hours.",
    faqs: [
      {
        question: "Where should the crawlspace probe go?",
        answer:
          "On or near the coldest supply line, not just the access hatch. Pair with a living-space probe if you want comfort context upstairs.",
      },
      {
        question: "Is humidity enough?",
        answer:
          "Humidity helps spot moisture, but freeze risk is temperature at the pipes. Use a waterproof probe and a threshold a few degrees above 32°F.",
      },
    ],
  },
  {
    slug: "detached-garage-winter",
    path: "/stories/detached-garage-winter",
    headline: "Detached garage winter case study",
    title: "Detached garage, attached anxiety",
    description:
      "A Colorado detached garage used ThermalTrace email and forecast alerts to catch a failed shop heater before a utility sink line froze.",
    quote: "Detached does not mean disposable",
    location: "Fort Collins, CO",
    datePublished: "2026-03-01",
    ogImage: "/og-story-freeze.jpg",
    setup: [
      "Wi-Fi ESP32 on a shelf above the utility sink; second probe near the overhead door",
      "Member plan with forecast freeze warnings + email",
      "Vacation mode cleared before a week-long trip",
    ],
    timeline: [
      { time: "Wed forecast", detail: "Forecast alert flagged a Thursday overnight low; owner confirmed heater was on." },
      { time: "Thu 1:50 a.m.", detail: "Shop crossed 34°F after the heater tripped a GFCI; email fired." },
      { time: "Thu 2:15 a.m.", detail: "Owner reset the circuit remotely via a smart plug; sink line never iced." },
    ],
    outcome:
      "Detached garages lose heat fast. Forecast + threshold alerts covered both the planning window and the failure night.",
    faqs: [
      {
        question: "Do detached garages need two probes?",
        answer:
          "One near pipes or the utility sink is enough to start. A second near the door catches drafts that the back wall never sees.",
      },
      {
        question: "Is Free enough for a detached bay?",
        answer:
          "Free email works. Member forecast alerts help when you are traveling and want a heads-up before the overnight low.",
      },
    ],
  },
  {
    slug: "water-heater-pad-leak",
    path: "/stories/water-heater-pad-leak",
    headline: "Water heater pad leak case study",
    title: "The pad went wet at 3 a.m., not the freeze night",
    description:
      "How a Wisconsin household used a ThermalTrace flood contact under a garage water heater to catch a slow drip before it soaked the slab and ruined stored boxes.",
    quote: "The pad went wet at 3 a.m., not the freeze night",
    location: "Madison, WI",
    datePublished: "2026-03-08",
    ogImage: "/og-story-freeze.jpg",
    photoId: "basement-pex-pipes",
    setup: [
      "ESP32 already pushing garage temp; added a cheap wet/dry contact on the heater pan",
      "Ingest kind flood: auto-alerts when wet (no custom rule)",
      "Email + Pro SMS; freeze threshold still watching the same bay",
    ],
    timeline: [
      { time: "3:08 a.m.", detail: "Flood contact reported wet; SMS + email fired while vacation mode was on for a trip." },
      { time: "3:20 a.m.", detail: "Neighbor with a share link confirmed a drip at the drain valve." },
      { time: "Morning", detail: "Plumber tightened the valve; slab stayed dry enough that boxes were salvageable." },
    ],
    outcome:
      "Freeze and flood share one ingest path. Vacation muted threshold noise; the wet contact still woke the household.",
    faqs: [
      {
        question: "Do flood alerts need a custom rule?",
        answer:
          "No, when alerts are enabled, wet flood/leak contacts notify automatically. Use Rules → flood only to combine with door or temp conditions.",
      },
      {
        question: "Where should the contact sit?",
        answer:
          "On the pan floor away from normal condensation drip lines. Test with a damp cloth, then dry so you do not leave a sticky wet state.",
      },
    ],
  },
];

export function getStory(slug: string): Story | undefined {
  return stories.find((s) => s.slug === slug);
}
