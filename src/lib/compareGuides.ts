export type CompareGuide = {
  slug: string;
  path: string;
  title: string;
  headline: string;
  description: string;
  competitor: string;
  summary: string;
  lede: string;
  /** Optional Creative Commons atmosphere photo. */
  photoId?: import("./aboutPhotos").AboutPhotoId;
  whenThermalTrace: string[];
  whenOther: string[];
  rows: Array<{ capability: string; thermaltrace: string; other: string }>;
  faqs: Array<{ question: string; answer: string }>;
};

export const compareGuides: CompareGuide[] = [
  {
    slug: "diy-mqtt",
    path: "/compare/diy-mqtt",
    title: "ThermalTrace vs DIY MQTT",
    headline: "ThermalTrace vs DIY MQTT + Node-RED",
    description:
      "Compare ThermalTrace freeze and leak alerts to a self-hosted MQTT, Node-RED, and cron stack: ops burden, SMS, history, and household sharing.",
    competitor: "DIY MQTT / Node-RED",
    summary:
      "DIY MQTT is powerful if you enjoy running brokers, dashboards, and alert scripts. ThermalTrace is the same outcome, live probes, freeze and leak alerts, history, without babysitting the stack at 2 a.m.",
    lede:
      "A Mosquitto broker, Node-RED flows, and a cron job can freeze-alert a garage. The cost is patching, TLS, Twilio, and a Pi that has to stay up. ThermalTrace is the hosted alerts and history layer: keep MQTT on the LAN if you want, bridge readings over HTTPS, and let household freeze and leak channels live in the cloud.",
    photoId: "ethernet-cable",
    whenThermalTrace: [
      "You want freeze and leak SMS/email/push without wiring Twilio yourself",
      "Household members need access without VPN to your Pi",
      "You still use ESP/Arduino. HTTPS ingest or MQTT→HTTP bridge",
    ],
    whenOther: [
      "You already run a hardened MQTT + Grafana stack and like maintaining it",
      "Every automation must stay fully on-LAN with no cloud dependency",
      "You need custom industrial protocols ThermalTrace does not speak",
    ],
    rows: [
      { capability: "Broker / server upkeep", thermaltrace: "Hosted (no Mosquitto to patch)", other: "You patch Mosquitto/HA" },
      { capability: "Freeze and leak alerts", thermaltrace: "Built-in channels + remaining-hours freeze clock", other: "Node-RED + Twilio/email" },
      { capability: "ESP ingest", thermaltrace: "HTTPS device key or MQTT bridge", other: "MQTT topic design" },
      { capability: "History & CSV", thermaltrace: "On paid plans", other: "Influx/Postgres you manage" },
      { capability: "Share with family", thermaltrace: "Household invites", other: "VPN or reverse proxy" },
    ],
    faqs: [
      {
        question: "Can I keep MQTT and still use ThermalTrace?",
        answer:
          "Yes. Keep Mosquitto or Home Assistant on your LAN for local automations and bridge selected topics over HTTPS ingest. ThermalTrace is the off-site freeze/leak alerts and history layer.",
      },
      {
        question: "Do I need to run Twilio myself?",
        answer:
          "No on ThermalTrace Pro: SMS, push, and chat channels are hosted. DIY MQTT usually means wiring Twilio or email yourself and keeping that stack online.",
      },
      {
        question: "Where is the MQTT bridge recipe?",
        answer:
          "thermaltrace.dev/about/mqtt-bridge and the HACS integration at thermaltrace.dev/integrations/home-assistant.",
      },
    ],
  },
  {
    slug: "govee",
    path: "/compare/govee",
    title: "ThermalTrace vs Govee",
    headline: "ThermalTrace vs Govee sensors",
    description:
      "Govee vs ThermalTrace for freeze and leak monitoring in unheated spaces: alerts, ESP ingest, multi-probe zones, and exportable history.",
    competitor: "Govee",
    summary:
      "Govee, and consumer hubs like SmartThings: are great for cheap room sensors and a polished phone app. ThermalTrace is built for freeze and leak workflows in garages, workshops, attics, and shops: your own ESP probes, household alerts, and history you can export.",
    lede:
      "Govee hygrometers (and SmartThings-style hubs that absorb the same class of Bluetooth/Wi-Fi pods) win on price and a friendly phone app for bedrooms and closets. They are weaker in a detached garage or shop: Bluetooth range, vendor lock-in, and alerts that mostly stay in-app. ThermalTrace assumes you bring an ESP32, then gives household freeze and leak routing and a season of exportable history.",
    photoId: "garage-workbench",
    whenThermalTrace: [
      "You want ESP, Pico W, STM32, CH32V, or Arduino probes you control (not only vendor pods)",
      "Freeze and leak alerts need SMS, webhooks, or household routing",
      "You care about CSV/history across a whole cold season",
    ],
    whenOther: [
      "You only need a few battery Bluetooth sensors indoors",
      "You prefer an all-in-one consumer app with no DIY hardware",
      "Garage Wi-Fi is impossible and Bluetooth range is enough",
    ],
    rows: [
      { capability: "Hardware", thermaltrace: "BYO ESP / Pico / Arduino", other: "Govee pods" },
      { capability: "Garage / detached spaces", thermaltrace: "Designed for it", other: "Hit-or-miss range" },
      { capability: "Alert channels", thermaltrace: "Email, SMS, push, chat, webhooks + time-to-freeze clock", other: "Mostly app push" },
      { capability: "Data export", thermaltrace: "CSV / API (paid tiers)", other: "Limited" },
      { capability: "Multi-user household", thermaltrace: "Included", other: "Account sharing awkward" },
    ],
    faqs: [
      {
        question: "Is ThermalTrace a Govee replacement for bedrooms?",
        answer:
          "Not primarily. Govee wins for cheap indoor Bluetooth pods and a polished consumer app. ThermalTrace is for freeze and leak workflows in garages, workshops, and other unheated spaces on hardware you control.",
      },
      {
        question: "Can I use ESP32 instead of Govee pods?",
        answer:
          "Yes. ThermalTrace expects BYO ESP/Pico/Arduino (or JSON ingest). That is the point for detached garages where Bluetooth range fails.",
      },
      {
        question: "Which has better freeze alert channels?",
        answer:
          "ThermalTrace: email, SMS (Pro), push, chat, and webhooks plus a time-to-freeze clock. Govee alerts are mostly in-app push.",
      },
    ],
  },
  {
    slug: "tempest",
    path: "/compare/tempest",
    title: "ThermalTrace vs Tempest",
    headline: "ThermalTrace vs WeatherFlow Tempest",
    description:
      "Outdoor weather stations like Tempest vs ThermalTrace indoor probes, when you need pipe freeze alerts where the water actually is.",
    competitor: "WeatherFlow Tempest",
    summary:
      "Tempest shines at yard weather: wind, rain, outdoor temp. Pipe freeze risk lives indoors. ThermalTrace watches the garage, crawlspace, or shop where the plumbing is.",
    lede:
      "A Tempest on the roof tells you outdoor air, wind, and rain with excellent fidelity. Pipes freeze where the water is, usually a garage, crawlspace, or shop the station never sees. Use Tempest for yard weather and ThermalTrace for the indoor probe that sits by the plumbing.",
    photoId: "cold-weather-road",
    whenThermalTrace: [
      "You need indoor / unheated-space probe temps for pipe risk",
      "Alerts should fire on space temperature, not only outdoor air",
      "You already have or want DIY sensors on Wi-Fi",
    ],
    whenOther: [
      "You want a best-in-class outdoor personal weather station",
      "Your goal is hyper-local forecast and storm data",
      "You do not have indoor plumbing freeze risk",
    ],
    rows: [
      { capability: "Primary job", thermaltrace: "Indoor freeze / space monitoring", other: "Outdoor weather" },
      { capability: "Probe location", thermaltrace: "Garage, crawlspace, closet", other: "Roof / yard" },
      { capability: "Freeze alerts on pipes", thermaltrace: "Direct + hours-until-freeze clock", other: "Infer from outdoor only" },
      { capability: "DIY ESP ingest", thermaltrace: "Yes", other: "N/A" },
      { capability: "Complements the other?", thermaltrace: "Yes, use both", other: "Yes: outdoor context" },
    ],
    faqs: [
      {
        question: "Does Tempest replace an indoor freeze probe?",
        answer:
          "No. Tempest measures outdoor yard weather. Pipe freeze risk lives indoors (garage, crawlspace, shop). Use Tempest for outdoor context and ThermalTrace for the probe by the plumbing.",
      },
      {
        question: "Can I use both Tempest and ThermalTrace?",
        answer:
          "Yes. Many households keep Tempest for weather and ThermalTrace for space temperature alerts where water actually sits.",
      },
      {
        question: "Will outdoor air alone catch a garage freeze?",
        answer:
          "Not reliably. Garages lag outdoor air and can freeze while the yard looks milder, or stay warmer while outdoor air plummets. Probe the space.",
      },
    ],
  },
  {
    slug: "nest",
    path: "/compare/nest",
    title: "ThermalTrace vs Nest Thermostat",
    headline: "ThermalTrace vs a Nest Thermostat for freeze protection in unheated spaces",
    description:
      "A Nest thermostat has no signal from an unheated garage. ThermalTrace probes that space and can show your Nest reading with freeze alerts.",
    competitor: "Nest Thermostat",
    summary:
      "Nest is excellent at running your HVAC and reporting the temperature where it (or a Nest Temperature Sensor) is installed -- almost never the garage, crawlspace, or shop where pipes actually freeze. ThermalTrace watches that space directly, and if you connect your Nest account, pulls its reading and heating status into every freeze alert for context.",
    lede:
      "Nest does one job very well: run the furnace and track the temperature of the room it's in. An unheated garage, crawlspace, or workshop is unconditioned by design, so Nest has no reading from it at all -- there's nothing to alert on. ThermalTrace puts a dedicated probe in that space, and if you connect your Nest account (Pro), every freeze alert shows your house's indoor temperature and whether it's actively heating, so you can tell at a glance whether the cold is expected (garage is unconditioned, house is fine) or something's actually wrong.",
    photoId: "crawlspace",
    whenThermalTrace: [
      "You have a garage, crawlspace, basement, or shop that isn't on Nest's heating loop",
      "You want an alert from the specific unconditioned space, not an inference from the thermostat",
      "You already use Nest and want its reading shown alongside freeze alerts, not replaced",
    ],
    whenOther: [
      "You only need the temperature of Nest-conditioned living space",
      "You want to control heating/cooling schedules, not just monitor a cold space",
      "You don't have a separate unconditioned space that needs its own probe",
    ],
    rows: [
      { capability: "Primary job", thermaltrace: "Freeze/leak monitoring for any space", other: "HVAC control for conditioned space" },
      { capability: "Sees an unheated garage/crawlspace", thermaltrace: "Yes: dedicated probe", other: "No: unconditioned spaces aren't on the loop" },
      { capability: "Freeze/leak alerts (SMS, push, email)", thermaltrace: "Yes, plus remaining-hours time-to-freeze", other: "No" },
      { capability: "Shows thermostat reading on freeze alerts", thermaltrace: "Yes, if connected (Pro)", other: "N/A" },
      { capability: "Controls heating schedules", thermaltrace: "No", other: "Yes" },
      { capability: "Complements the other?", thermaltrace: "Yes: connect both", other: "Yes: connect both" },
    ],
    faqs: [
      {
        question: "Does Nest see my unheated garage?",
        answer:
          "Usually no. Nest reports the conditioned space where it (or a Nest Temperature Sensor) is installed. Unheated garages and crawlspaces are off that loop.",
      },
      {
        question: "Can ThermalTrace show Nest readings?",
        answer:
          "Yes on Pro when Nest OAuth is connected: freeze alerts and Overview can show house indoor temp and heating status beside your garage probe.",
      },
      {
        question: "Should I replace Nest with ThermalTrace?",
        answer:
          "No. Nest runs HVAC; ThermalTrace watches unconditioned spaces. Connect both when you want thermostat context on freeze alerts.",
      },
    ],
  },
  {
    slug: "ecobee",
    path: "/compare/ecobee",
    title: "ThermalTrace vs Ecobee Thermostat",
    headline: "ThermalTrace vs an Ecobee Thermostat for freeze protection in unheated spaces",
    description:
      "An Ecobee thermostat has no signal from an unheated garage. ThermalTrace probes that space and can show your Ecobee reading with freeze alerts.",
    competitor: "Ecobee Thermostat",
    summary:
      "Ecobee is excellent at running your HVAC and reporting the temperature where it (or an Ecobee SmartSensor) is installed -- almost never the garage, crawlspace, or shop where pipes actually freeze. ThermalTrace watches that space directly, and if you connect your Ecobee account, pulls its reading and heating status into every freeze alert for context.",
    lede:
      "Ecobee does one job very well: run the furnace and track the temperature of the room it's in. An unheated garage, crawlspace, or workshop is unconditioned by design, so Ecobee has no reading from it at all -- there's nothing to alert on. ThermalTrace puts a dedicated probe in that space, and if you connect your Ecobee account (Pro), every freeze alert shows your house's indoor temperature and whether it's actively heating, so you can tell at a glance whether the cold is expected (garage is unconditioned, house is fine) or something's actually wrong.",
    photoId: "basement-pex-pipes",
    whenThermalTrace: [
      "You have a garage, crawlspace, basement, or shop that isn't on Ecobee's heating loop",
      "You want an alert from the specific unconditioned space, not an inference from the thermostat",
      "You already use Ecobee and want its reading shown alongside freeze alerts, not replaced",
    ],
    whenOther: [
      "You only need the temperature of Ecobee-conditioned living space",
      "You want to control heating/cooling schedules, not just monitor a cold space",
      "You don't have a separate unconditioned space that needs its own probe",
    ],
    rows: [
      { capability: "Primary job", thermaltrace: "Freeze/leak monitoring for any space", other: "HVAC control for conditioned space" },
      { capability: "Sees an unheated garage/crawlspace", thermaltrace: "Yes: dedicated probe", other: "No: unconditioned spaces aren't on the loop" },
      { capability: "Freeze/leak alerts (SMS, push, email)", thermaltrace: "Yes, plus remaining-hours time-to-freeze", other: "No" },
      { capability: "Shows thermostat reading on freeze alerts", thermaltrace: "Yes, if connected (Pro)", other: "N/A" },
      { capability: "Controls heating schedules", thermaltrace: "No", other: "Yes" },
      { capability: "Complements the other?", thermaltrace: "Yes: connect both", other: "Yes: connect both" },
    ],
    faqs: [
      {
        question: "Does Ecobee see my unheated garage?",
        answer:
          "Usually no. Ecobee reports conditioned living space (or SmartSensors on that loop), not a detached garage or crawlspace by default.",
      },
      {
        question: "Can ThermalTrace show Ecobee readings?",
        answer:
          "Yes on Pro when Ecobee OAuth is available and connected. If Ecobee developer signup is closed, use Home Assistant → ingest → Indoor reference instead.",
      },
      {
        question: "Should I replace Ecobee with ThermalTrace?",
        answer:
          "No. Ecobee runs HVAC; ThermalTrace monitors unconditioned spaces. They complement each other.",
      },
    ],
  },
  {
    slug: "tempstick",
    path: "/compare/tempstick",
    title: "ThermalTrace vs TempStick",
    headline: "ThermalTrace vs TempStick Wi‑Fi freeze thermometer",
    description:
      "Compare ThermalTrace DIY freeze and flood monitoring to TempStick sealed Wi‑Fi thermometers for empty houses, cabins, and unheated garages.",
    competitor: "TempStick",
    summary:
      "TempStick is a sealed battery Wi‑Fi thermometer with an app. ThermalTrace is BYO ESP probes, multi-zone freeze and flood contacts, a time-to-freeze clock, and household alerts you control.",
    lede:
      "TempStick (and similar sealed Wi‑Fi freeze thermometers) win when you want zero soldering and a single battery pod with SMS from a vendor app. They are weaker when you need a DS18B20 on a pipe, a wet-contact pad under a water heater, multiple zones, CSV history, or a household that shares one dashboard. ThermalTrace assumes you bring an ESP32 (or similar), then hosts ingest, freeze runway alerts, and flood auto-notify.",
    photoId: "frozen-thermometer",
    whenThermalTrace: [
      "You want pipe-mounted DS18B20 probes, not only ambient air in a battery pod",
      "You need wet/dry flood contacts plus freeze on the same account",
      "Household members need shared alerts, CSV/history, or claims evidence",
      "Detached garage Wi‑Fi works for ESP HTTPS push but Bluetooth pods fail",
    ],
    whenOther: [
      "You refuse DIY hardware and want one sealed pod out of the box",
      "A single ambient reading and vendor app SMS are enough",
      "You do not need multi-zone probes, flood pads, or data export",
    ],
    rows: [
      { capability: "Hardware", thermaltrace: "BYO ESP / Pico / Arduino + probes", other: "Sealed battery Wi‑Fi pod" },
      { capability: "Probe placement", thermaltrace: "Pipe tip, multi-zone, crawlspace", other: "Ambient air at the pod" },
      { capability: "Flood / leak contacts", thermaltrace: "Yes (auto wet notify)", other: "Usually temp-only" },
      { capability: "Time-to-freeze clock", thermaltrace: "Yes (space lag vs outdoor)", other: "Threshold / app push" },
      { capability: "Alert channels", thermaltrace: "Email, SMS, push, chat, webhooks", other: "Vendor app + SMS options" },
      { capability: "Household / export", thermaltrace: "Invites, share links, CSV (paid)", other: "Account sharing varies" },
    ],
    faqs: [
      {
        question: "Is TempStick easier to set up than ThermalTrace?",
        answer:
          "Yes for a single sealed pod: power it, join Wi‑Fi, use the vendor app. ThermalTrace needs a push device and a flashed ESP sketch, then you own placement and multi-sensor wiring.",
      },
      {
        question: "Can ThermalTrace replace TempStick for cabin freeze watch?",
        answer:
          "Yes if you can run Wi‑Fi ESP ingest. You get pipe probes, optional leak pads, a remaining-hours freeze clock, and household channels. Start from the freeze kit BOM and freeze-season checklist.",
      },
      {
        question: "Do I need both?",
        answer:
          "Rarely. Pick TempStick for zero-DIY ambient only. Pick ThermalTrace when pipes, floods, multi-zone, or export matter.",
      },
    ],
  },
];

export function getCompareGuide(slug: string): CompareGuide | undefined {
  return compareGuides.find((g) => g.slug === slug);
}
