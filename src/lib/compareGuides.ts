export type CompareGuide = {
  slug: string;
  path: string;
  title: string;
  /** <title> tag, phrased the way people search ("<product> alternative"). Falls back to title. */
  seoTitle?: string;
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
  /** Where competitor facts came from, and when they were last checked. */
  sources?: { checkedOn: string; links: Array<{ label: string; url: string }> };
};

export const compareGuides: CompareGuide[] = [
  {
    slug: "diy-mqtt",
    path: "/compare/diy-mqtt",
    title: "ThermalTrace vs DIY MQTT",
    seoTitle: "Hosted alternative to DIY MQTT freeze alerts",
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
          "No. Push and chat channels are hosted on every plan, and SMS on Pro. DIY MQTT usually means wiring Twilio or email yourself and keeping that stack online.",
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
    seoTitle: "Govee alternative for garage freeze alerts",
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
      { capability: "Price", thermaltrace: "About $25 in parts per probe; Free plan, Member $4/mo, Pro $10/mo", other: "Roughly $35–50 for a Wi-Fi gateway + sensor; no subscription" },
      { capability: "Data export", thermaltrace: "CSV (Member+) and API (Pro)", other: "Export from the app; 2 years of stored data on some models" },
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
          "ThermalTrace: email, push, and chat apps on every plan, SMS and webhooks on Pro, plus a time-to-freeze clock. Govee alerts are app notifications, and you need the Wi-Fi gateway version to get them away from home.",
      },
    ],
    sources: {
      checkedOn: "September 2026",
      links: [
        { label: "GoveeLife Smart Thermometer R1 (gateway + sensor)", url: "https://us.govee.com/products/goveelife-smart-thermometer-r1" },
        { label: "Govee Wi-Fi Thermo-Hygrometer", url: "https://us.govee.com/products/wi-fi-temperature-humidity-sensor" },
      ],
    },
  },
  {
    slug: "tempest",
    path: "/compare/tempest",
    title: "ThermalTrace vs Tempest",
    seoTitle: "Tempest vs indoor probes for pipe freeze alerts",
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
    seoTitle: "Nest thermostat vs a garage freeze sensor",
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
    seoTitle: "Ecobee thermostat vs a garage freeze sensor",
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
    seoTitle: "Temp Stick alternative: DIY freeze sensors",
    headline: "ThermalTrace vs Temp Stick Wi‑Fi sensors",
    description:
      "Temp Stick vs ThermalTrace for freeze alerts: one-time $149–209 sensors with free SMS, or $25 DIY probes with multi-zone, leak contacts, and Home Assistant.",
    competitor: "Temp Stick",
    summary:
      "Temp Stick is the easier choice for one or two spaces: a finished battery sensor, no subscription, and free text, email, and app alerts. ThermalTrace is cheaper per sensor and more flexible (several probes, leak contacts, Home Assistant), but you build the sensor and SMS needs Pro.",
    lede:
      "Temp Stick sells finished Wi‑Fi sensors: $149 for the standard model or about $199 for the PRO with a pipe clamp probe, with free text, email, and app alerts and no subscription. That is hard to beat if you want one sensor with zero setup. ThermalTrace suits people who want several probes, a leak contact under the water heater, or readings inside Home Assistant: an ESP32 and probe cost about $25, email and chat alerts are free, and SMS is on Pro.",
    photoId: "frozen-thermometer",
    whenThermalTrace: [
      "You want probes in several spots (pipes, door side, crawlspace) without buying a $149+ sensor for each",
      "You want wet/dry leak contacts and freeze alerts on one account",
      "You already run Home Assistant, ESPHome, or MQTT and want readings to flow both ways",
      "You want forecast freeze warnings, a time-to-freeze estimate, or open-source software you can inspect",
    ],
    whenOther: [
      "You want a finished sensor with no soldering, flashing, or setup beyond Wi‑Fi",
      "You need battery power where there is no outlet",
      "You want free SMS alerts with no subscription",
      "One or two sensors cover everything you need",
    ],
    rows: [
      { capability: "Hardware", thermaltrace: "DIY: ESP32 / Pico / Arduino + DS18B20 or DHT22", other: "Finished battery or AC sensor" },
      { capability: "Up-front cost", thermaltrace: "About $25 in parts per probe", other: "$149 standard; about $199 PRO with pipe clamp" },
      { capability: "Ongoing cost", thermaltrace: "Free plan; Member $4/mo; Pro $10/mo for SMS", other: "None" },
      { capability: "Pipe-mounted probe", thermaltrace: "Yes (waterproof DS18B20 on the pipe)", other: "Yes on PRO (pipe clamp)" },
      { capability: "Leak / flood contacts", thermaltrace: "Yes, alert automatically when wet", other: "Not listed on the pipe-clamp model" },
      { capability: "Alert channels", thermaltrace: "Email, push, chat apps free; SMS, webhooks on Pro", other: "SMS, email, app, all free" },
      { capability: "Sharing and data", thermaltrace: "Household invites, CSV (Member+), API (Pro)", other: "Up to 10 alert contacts, CSV export, public API" },
      { capability: "Home Assistant", thermaltrace: "Official HACS integration + push from HA", other: "Via their API" },
      { capability: "Forecast warnings", thermaltrace: "Forecast freeze (Member+), NWS alerts (Pro)", other: "Not listed; threshold alerts" },
    ],
    faqs: [
      {
        question: "Is Temp Stick easier to set up than ThermalTrace?",
        answer:
          "Yes. A Temp Stick joins Wi‑Fi and works through its app. ThermalTrace needs an ESP32 or similar board flashed with a pre-filled sketch, or an existing Home Assistant, ESPHome, or MQTT setup.",
      },
      {
        question: "Which is cheaper?",
        answer:
          "For one sensor with SMS, Temp Stick: $149–209 once versus about $25 in parts plus $100/year for ThermalTrace Pro. For several zones or email-only alerts, ThermalTrace: three probes cost about $75 in parts and the Free plan includes email alerts, versus $447+ for three Temp Sticks.",
      },
      {
        question: "Does Temp Stick charge a subscription?",
        answer:
          "No. Temp Stick says monitoring, data logging, and text, email, and app alerts are free for the life of the sensor.",
      },
      {
        question: "Can ThermalTrace watch an empty cabin like a Temp Stick?",
        answer:
          "Yes, if the cabin has Wi‑Fi and power for an ESP32. Put a waterproof probe on the coldest pipe, add a leak contact if you like, and choose email alerts (free) or SMS (Pro).",
      },
    ],
    sources: {
      checkedOn: "September 2026",
      links: [
        { label: "Temp Stick Wi‑Fi sensor ($149)", url: "https://tempstick.com/product/tempstick-wifi-temperature-humidity-sensor/" },
        { label: "Temp Stick PRO with pipe clamp", url: "https://tempstick.com/product/temp-stick-pro-for-frozen-pipe-prevention/" },
        { label: "Temp Stick common questions (fees, contacts, export, API)", url: "https://tempstick.com/common-questions/" },
      ],
    },
  },
  {
    slug: "yolink",
    path: "/compare/yolink",
    title: "ThermalTrace vs YoLink",
    seoTitle: "YoLink alternative for pipe freeze alerts",
    headline: "ThermalTrace vs YoLink temperature sensors",
    description:
      "YoLink vs ThermalTrace for freeze alerts: a $59.99 hub kit with finished battery sensors and SMS, or DIY probes on the pipe with open-source software.",
    competitor: "YoLink",
    summary:
      "YoLink is the easier and often cheaper choice for finished sensors: a hub and two battery sensors cost $59.99 and alert by push, email, and SMS. ThermalTrace fits if you want a probe taped to the pipe, no hub, your own hardware, or readings in an open system.",
    lede:
      "YoLink sells a hub with two battery temperature and humidity sensors for $59.99. The sensors are rated from −22°F to 140°F, run two or more years on a pair of batteries, and send push, email, and SMS alerts. For most people who want a finished product in a cold garage, that is a strong option. ThermalTrace is the better fit when you want a waterproof probe directly on the pipe, leak contacts and freeze alerts in one place, no proprietary hub, or software you can read and self-host: an ESP32 and probe cost about $25, email and chat alerts are free, and SMS is on Pro.",
    whenThermalTrace: [
      "You want a waterproof probe taped to the pipe itself rather than a room sensor on the wall",
      "You already run Home Assistant, ESPHome, or MQTT and want one more destination, not another hub",
      "You want open-source software, an HTTP API you can post to from any board, and no vendor hardware",
      "You want forecast freeze warnings and a time-to-freeze estimate alongside threshold alerts",
    ],
    whenOther: [
      "You want finished battery sensors with no wiring or flashing",
      "There is no outlet where the sensor needs to go",
      "You want push, email, and SMS alerts from one vendor app",
      "The space is far from your Wi‑Fi and a long-range hub suits it better",
    ],
    rows: [
      { capability: "Hardware", thermaltrace: "DIY: ESP32 / Pico / Arduino + DS18B20 or DHT22", other: "Finished battery sensor; YoLink hub required" },
      { capability: "Up-front cost", thermaltrace: "About $25 in parts per probe", other: "$59.99 for a hub and two sensors" },
      { capability: "Ongoing cost", thermaltrace: "Free plan; Member $4/mo; Pro $10/mo for SMS", other: "Not stated on the product page" },
      { capability: "Rated for freezing spaces", thermaltrace: "Yes (DS18B20 probe: −67°F to 257°F)", other: "Yes (−22°F to 140°F)" },
      { capability: "Power", thermaltrace: "USB power at the board", other: "Two batteries, 2+ years expected" },
      { capability: "Pipe-mounted probe", thermaltrace: "Yes (waterproof DS18B20 on the pipe)", other: "Separate outdoor sensor with probe (YS8005)" },
      { capability: "Alert channels", thermaltrace: "Email, push, chat apps free; SMS, webhooks on Pro", other: "Push, email, SMS" },
      { capability: "Data export", thermaltrace: "CSV (Member+), API (Pro)", other: "CSV export" },
      { capability: "Home Assistant", thermaltrace: "Official HACS integration + push from HA", other: "Listed as compatible" },
    ],
    faqs: [
      {
        question: "Is YoLink cheaper than ThermalTrace?",
        answer:
          "For finished sensors, usually yes. YoLink's hub with two sensors is $59.99. Two ThermalTrace probes cost about $50 in parts and the Free plan includes email alerts, but you build them, and SMS needs Pro.",
      },
      {
        question: "Does YoLink need a hub?",
        answer:
          "Yes. YoLink sensors talk to a YoLink hub, which connects to your network. ThermalTrace devices post straight to the internet over Wi‑Fi, Ethernet, or cellular with no hub.",
      },
      {
        question: "Can YoLink sensors work in an unheated garage?",
        answer:
          "Yes. YoLink rates its YS8003 sensor for −22°F to 140°F and lists freezers among its uses.",
      },
      {
        question: "Why choose ThermalTrace over YoLink?",
        answer:
          "For the probe placement and the openness: a waterproof probe on the coldest pipe, several probes on one board, leak contacts on the same account, and open-source software that takes readings from any device that can send an HTTPS request.",
      },
    ],
    sources: {
      checkedOn: "October 2026",
      links: [
        { label: "YoLink hub with two temperature and humidity sensors ($59.99)", url: "https://shop.yosmart.com/products/ys1603-2ys8003" },
        { label: "YoLink YS8003 datasheet (range, battery, alerts)", url: "https://www.yosmart.com/wp-content/uploads/YOLINK-YS8003-TEMPERATURE-HUMIDITY-SENSOR-DATASHEET-091622.pdf" },
      ],
    },
  },
  {
    slug: "sensorpush",
    path: "/compare/sensorpush",
    title: "ThermalTrace vs SensorPush",
    seoTitle: "SensorPush alternative for remote freeze alerts",
    headline: "ThermalTrace vs SensorPush sensors",
    description:
      "SensorPush vs ThermalTrace for freeze alerts: accurate Bluetooth sensors that need a $99.95 gateway for remote alerts, or Wi‑Fi DIY probes on the pipe.",
    competitor: "SensorPush",
    summary:
      "SensorPush makes small, accurate Bluetooth sensors with a polished app and no monthly fee, but alerts away from home need the $99.95 Wi‑Fi gateway. ThermalTrace probes report over Wi‑Fi directly and can sit on the pipe; you build them, and SMS needs Pro.",
    lede:
      "SensorPush sensors are compact and accurate: the HT1 is $54.95 and the water-resistant HT.w is $69.99, both rated from −40°F to 140°F with a year or more of battery life. They are Bluetooth sensors, so your phone has to be in range unless you add the $99.95 G1 Wi‑Fi Gateway, which includes cloud access with no monthly fee and in-app and email alerts. ThermalTrace starts from the other end: an ESP32 with a waterproof probe (about $25 in parts) reports over Wi‑Fi on its own, email and chat alerts are free, and leak contacts, forecast warnings, and Home Assistant are built in. SMS is on Pro.",
    whenThermalTrace: [
      "You want remote alerts without buying a gateway",
      "You want a waterproof probe on the pipe, or several probes from one board",
      "You want SMS, chat-app, or webhook alerts, or a leak contact on the same account",
      "You run Home Assistant, ESPHome, or MQTT and want readings to flow into it",
    ],
    whenOther: [
      "You want a small finished sensor with a year or more of battery life",
      "You are usually home, so Bluetooth range to your phone is enough",
      "You want very accurate air temperature and humidity (a humidor, instrument case, or wine storage)",
      "You prefer a one-time purchase with no plan to think about",
    ],
    rows: [
      { capability: "Hardware", thermaltrace: "DIY: ESP32 / Pico / Arduino + DS18B20 or DHT22", other: "Finished Bluetooth sensor" },
      { capability: "Up-front cost", thermaltrace: "About $25 in parts per probe", other: "$54.95 (HT1) or $69.99 (HT.w) per sensor" },
      { capability: "Alerts away from home", thermaltrace: "Yes, sensors report over Wi‑Fi", other: "Needs the G1 Wi‑Fi Gateway ($99.95)" },
      { capability: "Ongoing cost", thermaltrace: "Free plan; Member $4/mo; Pro $10/mo for SMS", other: "None; gateway cloud has no monthly fee" },
      { capability: "Rated for freezing spaces", thermaltrace: "Yes (DS18B20 probe: −67°F to 257°F)", other: "Yes (−40°F to 140°F)" },
      { capability: "Alert channels", thermaltrace: "Email, push, chat apps free; SMS, webhooks on Pro", other: "In-app and email; SMS not listed" },
      { capability: "Power", thermaltrace: "USB power at the board", other: "Battery: over 1 year (HT1), over 2 years (HT.w)" },
      { capability: "API", thermaltrace: "HTTP ingest on every plan; API keys on Pro", other: "API for the gateway cloud" },
    ],
    faqs: [
      {
        question: "Does SensorPush work without the gateway?",
        answer:
          "Yes, over Bluetooth when your phone is in range (SensorPush lists 325 feet line of sight). To see readings or get alerts when you are away, you need the G1 Wi‑Fi Gateway.",
      },
      {
        question: "Does SensorPush charge a subscription?",
        answer:
          "No. SensorPush says the cloud service included with the G1 Wi‑Fi Gateway has no monthly fee.",
      },
      {
        question: "Which costs less for remote freeze alerts?",
        answer:
          "For one sensor with remote alerts, SensorPush is $154.90 (HT1 plus gateway) once. A ThermalTrace probe is about $25 in parts with free email alerts, or $100 a year more if you want SMS on Pro. Extra SensorPush sensors add $54.95 each; extra ThermalTrace probes add about $25, or less if they share a board.",
      },
      {
        question: "Is SensorPush more accurate?",
        answer:
          "For air temperature, yes: SensorPush lists ±0.5°F typical for the HT1 against about ±1°F for a DS18B20. For a freeze alarm either is ample, since the alert threshold should sit a few degrees above 32°F anyway.",
      },
    ],
    sources: {
      checkedOn: "October 2026",
      links: [
        { label: "SensorPush HT1 sensor ($54.95)", url: "https://www.sensorpush.com/products/p/ht1" },
        { label: "SensorPush HT.w water-resistant sensor ($69.99)", url: "https://www.sensorpush.com/products/p/ht-w" },
        { label: "SensorPush G1 Wi‑Fi Gateway ($99.95; cloud, alerts, API)", url: "https://www.sensorpush.com/products/p/g1-gateway" },
      ],
    },
  },
  {
    slug: "shelly",
    path: "/compare/shelly",
    title: "ThermalTrace vs Shelly H&T",
    seoTitle: "Shelly H&T for freeze alerts: limits and alternatives",
    headline: "ThermalTrace vs Shelly H&T Gen3 for freeze alerts",
    description:
      "Shelly H&T Gen3 is a good $40.99 room sensor, but Shelly rates it for 32–105°F, so it is not built for a freezing garage. How a pipe probe differs.",
    competitor: "Shelly H&T",
    summary:
      "The Shelly H&T Gen3 is a tidy $40.99 Wi‑Fi room sensor with a display, MQTT, and webhooks. Shelly rates it for 32°F to 105°F, though, which rules it out for spaces that actually freeze. ThermalTrace uses a probe rated far below freezing, mounted on the pipe.",
    lede:
      "The Shelly H&T Gen3 costs $40.99, runs about a year on four AA batteries or from USB‑C, shows temperature and humidity on an e-paper display, and speaks Wi‑Fi, MQTT, and webhooks. It is a good sensor for a heated room. Shelly lists its ambient working temperature as 0°C to 40°C (32°F to 105°F) and 30–70% humidity, so an unheated garage or crawlspace in a cold snap is outside what it is rated for. ThermalTrace is built for those spaces: a waterproof DS18B20 probe rated to −67°F on the pipe, with freeze, leak, and outage alerts and forecast warnings. If you already run Shelly gear indoors, its readings can reach ThermalTrace through Home Assistant or MQTT.",
    whenThermalTrace: [
      "The space can drop below 32°F, which is outside the Shelly H&T's rated range",
      "You want the reading at the pipe, under the insulation, not the air in the room",
      "You want freeze, leak, and sensor-offline alerts and a forecast warning without building automations",
      "You want household members to receive alerts through household invites",
    ],
    whenOther: [
      "You are monitoring a heated room: a basement, utility room, or living space",
      "You want a battery sensor with a display and no wiring",
      "You already use the Shelly app, Home Assistant, or MQTT and will build the alert yourself",
      "Humidity in a conditioned space matters more than pipe temperature",
    ],
    rows: [
      { capability: "Hardware", thermaltrace: "DIY: ESP32 / Pico / Arduino + DS18B20 or DHT22", other: "Finished Wi‑Fi sensor with e-paper display" },
      { capability: "Up-front cost", thermaltrace: "About $25 in parts per probe", other: "$40.99" },
      { capability: "Rated working temperature", thermaltrace: "DS18B20 probe: −67°F to 257°F", other: "32°F to 105°F (0°C to 40°C)" },
      { capability: "Pipe-mounted probe", thermaltrace: "Yes (waterproof DS18B20 on the pipe)", other: "No; measures air at the device" },
      { capability: "Power", thermaltrace: "USB power at the board", other: "4 AA batteries (about 1 year) or USB‑C" },
      { capability: "Local integrations", thermaltrace: "Home Assistant (HACS), ESPHome, MQTT bridge", other: "MQTT and webhooks (URL actions)" },
      { capability: "Leak / flood contacts", thermaltrace: "Yes, alert automatically when wet", other: "Not on this device" },
    ],
    faqs: [
      {
        question: "Can a Shelly H&T be used in an unheated garage?",
        answer:
          "Shelly lists the H&T Gen3's ambient working temperature as 0°C to 40°C (32°F to 105°F). A garage that drops below freezing is outside that range, so it is the wrong tool for a freeze alarm there.",
      },
      {
        question: "Can a Shelly device send readings to ThermalTrace?",
        answer:
          "Yes. The simplest route for an H&T is through Home Assistant or MQTT, which ThermalTrace has an integration and a bridge recipe for. The ESPHome and Shelly recipes guide at thermaltrace.dev/about/esphome-shelly-recipes covers posting directly from Shelly Plus and Gen2 modules.",
      },
      {
        question: "Is a Shelly H&T cheaper than a ThermalTrace probe?",
        answer:
          "No. The H&T Gen3 is $40.99; an ESP32 with a waterproof DS18B20 is about $25 in parts. The Shelly is finished and battery powered, which is what the extra money buys.",
      },
    ],
    sources: {
      checkedOn: "October 2026",
      links: [
        { label: "Shelly H&T Gen3 product page and specifications ($40.99)", url: "https://us.shelly.com/products/shelly-h-t-gen3-matte-white" },
        { label: "Waterproof DS18B20 technical specs (Adafruit)", url: "https://www.adafruit.com/product/381" },
      ],
    },
  },
];

export function getCompareGuide(slug: string): CompareGuide | undefined {
  return compareGuides.find((g) => g.slug === slug);
}
