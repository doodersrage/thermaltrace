import type { AboutContentBlock } from "./aboutExpandedContent";

export type AboutFaqItem = {
  question: string;
  answer: string;
};

/** FAQ copy for high-intent guides (FAQPage JSON-LD + optional on-page list). */
export const aboutFaqsBySlug: Record<string, AboutFaqItem[]> = {
  "temperature-probes": [
    {
      question: "What temperature probes work with ThermalTrace?",
      answer:
        "Any sensor that can publish temperature (and optional humidity) as JSON: commonly DHT22, DS18B20, or similar on Arduino/ESP32. Map probe indexes in the dashboard after ingest.",
    },
    {
      question: "How many probes do I need in a garage, workshop, or similar space?",
      answer:
        "One probe is a start; two or three zones (door bay, north wall, workbench) catch freeze risk that a single average misses.",
    },
  ],
  "temperature-changes": [
    {
      question: "Why does temperature in an unheated space swing so fast?",
      answer:
        "Door openings, sun load on walls, wind infiltration, and vehicle heat move indoor air quickly. Chart history overnight to separate weather from sensor noise.",
    },
  ],
  "historical-data": [
    {
      question: "How long does ThermalTrace keep history?",
      answer:
        "Retention depends on plan and your Settings retention window. Free keeps shorter windows; paid tiers keep more history for charts and CSV export.",
    },
    {
      question: "Can I export readings to a spreadsheet?",
      answer:
        "Yes on Member and Pro: download CSV from History and open it in Excel or Google Sheets for freeze audits and seasonal comparisons.",
    },
  ],
  "arduino-sketches": [
    {
      question: "Where are sample Arduino sketches?",
      answer:
        "In the thermaltrace GitHub repo under sketches/, plus the Arduino guides in About. ESP32 samples POST HTTPS directly. Uno + W5100 Ethernet uses ethernet_dht22_ingest (classic temp JSON on A4/A5) plus a LAN HTTP→HTTPS relay: the shield cannot TLS to thermaltrace.dev.",
    },
  ],
  "arduino-pin-wiring": [
    {
      question: "Which pins should I use for a DHT22?",
      answer:
        "Use a free digital GPIO for the data line, 3.3V or 5V per your board and sensor rating, and a shared ground. Avoid pins reserved by Ethernet/SPI shields.",
    },
  ],
  "arduino-dht22-lcd": [
    {
      question: "Do I need an LCD if I use ThermalTrace?",
      answer:
        "No: the cloud dashboard is enough. A local LCD is optional for workshop visibility when Wi‑Fi is down.",
    },
  ],
  "dht22-sensor-overview": [
    {
      question: "How accurate is a DHT22 in a garage or workshop?",
      answer:
        "Roughly ±0.5 °C and a few percent RH in stable air. Drafts and door openings create real spikes, not always sensor error. Compare zones before replacing hardware.",
    },
    {
      question: "How often should firmware poll the DHT22?",
      answer:
        "Respect at least a two-second gap between reads. Overlapping requests return stale or error values; sketches use timers and retries for that reason.",
    },
    {
      question: "Can one DHT22 cover a whole garage, attic, or shop?",
      answer:
        "One sensor hides gradients. Door bays, north walls, and workbenches often differ by several degrees, use multiple probes when freeze risk or tools matter.",
    },
  ],
  "dht22-data-line-wiring": [
    {
      question: "Why do DHT22 reads fail intermittently?",
      answer:
        "Long cables, missing pull-ups, shared power noise, and reading too often are common causes. Shorten the run, verify wiring, and add retries with backoff.",
    },
  ],
  "freeze-protection-thresholds": [
    {
      question: "What freeze threshold should I start with?",
      answer:
        "Many unheated spaces (garages, shops, crawlspaces) start near 35–38 °F so you get warning before pipes are at hard freeze. Tune after you see overnight lows in your coldest zone.",
    },
    {
      question: "Should I alert on outdoor forecast or indoor probes?",
      answer:
        "Use both when you can: probes catch your space; forecast and NWS alerts catch regional cold snaps before indoor air has dropped.",
    },
  ],
  "cold-snap-playbook": [
    {
      question: "What should I do when a freeze alert fires?",
      answer:
        "Acknowledge it, check the coldest zone and door state, open quiet-hour bypass if needed, and escalate channels if nobody responds within your playbook window.",
    },
    {
      question: "How do quiet hours interact with freeze alerts?",
      answer:
        "You can suppress routine noise overnight while still delivering freeze, flood, and forecast alerts, keep bypass enabled for critical kinds.",
    },
  ],
  "freeze-thaw-flood-playbook": [
    {
      question: "Do I need a custom rule for leak pads?",
      answer:
        "No. Once alerts are enabled, wet flood/leak contacts notify automatically. Use Rules → flood only to combine wet with door, temperature, or duration conditions.",
    },
    {
      question: "Does vacation mode mute flood alerts?",
      answer:
        "No. Flood alerts always deliver. Vacation mode also lets freeze threshold and forecast/NWS alerts through, so an empty house still warns you; a short snooze pauses freeze threshold alerts but not flood.",
    },
    {
      question: "Where should I place wet contacts for thaw floods?",
      answer:
        "Water heater pans, laundry/utility low spots, sump rims, and crawlspace pools where melt water gathers first—not on a dry shelf. See the leak-puck accessory page for the pad BOM pattern.",
    },
  ],
  "time-to-freeze": [
    {
      question: "How is time-to-freeze different from a threshold alert?",
      answer:
        "A threshold fires when the probe is already at or below your freeze °F. Time-to-freeze estimates remaining hours until that crossing using this space’s lag versus outdoor air.",
    },
    {
      question: "What do Member forecast and Pro NWS add?",
      answer:
        "Every plan gets threshold plus the indoor time-to-freeze clock. Member adds outdoor forecast freeze warnings; Pro adds official NWS freeze and cold alerts.",
    },
    {
      question: "Where do I turn time-to-freeze on?",
      answer:
        "Dashboard → Alerts → Essentials: set a freeze threshold, enable alerts and a delivery channel, then keep alerts on so remaining-hours warnings can fire. Send a test alert while awake.",
    },
  ],
  "alert-channel-cookbook": [
    {
      question: "Which channels work on the free plan?",
      answer:
        "Email plus chat-style destinations (Discord, Telegram, Slack, Teams, ntfy, Pushover). SMS, WhatsApp, browser push, and outbound webhooks need Pro.",
    },
    {
      question: "Why did a channel get skipped?",
      answer:
        "A checked channel without a destination (phone, webhook URL, chat id) is skipped at send time. Fill destinations, save, then send a test alert.",
    },
  ],
  "household-sharing-walkthrough": [
    {
      question: "Can household members change alert settings?",
      answer:
        "Editors and owners can; view-only members see live data without changing devices, alerts, or sharing.",
    },
    {
      question: "Do invites require a paid plan?",
      answer:
        "Household sharing is available on free accounts so family can watch the same probes and alerts together.",
    },
  ],
  "accounts-and-dashboard": [
    {
      question: "What should I configure after creating an account?",
      answer:
        "Create a push device (Workshop probe by default), POST so sensors auto-import, set freeze °F + email under Alerts → Essentials (or inline on Devices after first ingest), invite household members, and optionally share a free family live link. Start a Pro trial when you need SMS, push, or expanded share scopes.",
    },
  ],
  "ingest-and-webhooks": [
    {
      question: "Do I need a public IP on the Arduino?",
      answer:
        "No. Push ingest posts outbound to ThermalTrace with a device key. Pull feeds need a reachable HTTPS JSON URL if you use that path instead.",
    },
    {
      question: "What belongs in an ingest payload?",
      answer:
        "Temperature (and humidity) keyed by probe index, plus optional door/power fields, battery, and RSSI. Native shapes are flat keys, a temp object, or sensors[]. SenML (RFC 8428) arrays and Home Assistant REST state JSON are also auto-detected. Keep keys stable so dashboard mappings stay valid.",
    },
  ],
  "adding-devices": [
    {
      question: "Should I use push or pull?",
      answer:
        "Use push for ESP/Arduino nodes that can POST outbound HTTPS. Use pull when you already have a public HTTPS JSON feed (or a TLS relay) that ThermalTrace can fetch on a schedule.",
    },
    {
      question: "Why don’t readings show on Home after ingest succeeds?",
      answer:
        "POST JSON first: sensor keys auto-import on Devices. If Home is still empty, confirm the device received a POST and check Devices → Device health. Pull feeds: correct JSON root (default temp) unless the URL returns SenML or Home Assistant REST JSON, which auto-detect.",
    },
  ],
  "json-probe-output-schema": [
    {
      question: "What JSON shape does ThermalTrace expect?",
      answer:
        "Default pull shape is a temp object with probe keys (f, c, h). Push also accepts flat keys, sensors[], SenML JSON arrays, and Home Assistant REST state objects. Optional battery_pct and rssi help diagnose weak devices. See /about/ingest-and-webhooks or the example feed at /api/feeds/example?format=document.",
    },
  ],
  "kit-qr-onboarding": [
    {
      question: "What does a kit QR code contain?",
      answer:
        "Usually the ingest URL or onboarding deep link for that device so a phone scan finishes setup without typing long keys.",
    },
  ],
  "esp32-freeze-kit": [
    {
      question: "Does ThermalTrace sell an ESP32 kit?",
      answer:
        "No. ThermalTrace is software. Buy an ESP32 and a waterproof DS18B20 from Adafruit or Amazon, then download a pre-filled ingest sketch from Dashboard → Devices. Parts list: thermaltrace.dev/about/esp32-freeze-kit.",
    },
    {
      question: "Is a DHT11 starter kit enough for pipe freeze?",
      answer:
        "Not by itself. DHT11 is weak below freezing and usually not waterproof. Use a waterproof DS18B20 for pipes; keep DHT22 for shop air and humidity if you want RH.",
    },
    {
      question: "Do I need the Adafruit board specifically?",
      answer:
        "No. Any ESP32 DevKit that runs Arduino IDE or MicroPython works with the ThermalTrace sketches. Adafruit links are stable reference SKUs; Amazon DevKit searches are fine for cost.",
    },
  ],
  "esp32-ota-firmware": [
    {
      question: "Can ESP32 devices update firmware while posting to ThermalTrace?",
      answer:
        "Yes: run OTA on your LAN for firmware, and keep push ingest posting readings to the cloud API. Battery and RSSI fields are optional in the payload. Download a pre-filled sketch from Dashboard → Devices for the first USB flash.",
    },
    {
      question: "Do I need to recompile when my Wi‑Fi password changes?",
      answer:
        "Not if you use the WiFiManager sample (captive portal). Otherwise edit WIFI_SSID / WIFI_PASS and flash again. Ingest URL still comes from Devices.",
    },
  ],
  "esp32-web-flash": [
    {
      question: "Is there a browser flasher built into ThermalTrace?",
      answer:
        "Yes, in beta: thermaltrace.dev/flash installs prebuilt firmware on an ESP32, ESP32-S3, or ESP32-C3 from Chrome or Edge, then sends the board your Wi‑Fi and device key over USB. To edit the code instead, download a pre-filled .ino/.py from Devices and flash with Arduino IDE, PlatformIO, or Thonny. Guide: thermaltrace.dev/about/esp32-web-flash.",
    },
  ],
  "pico-w-ingest": [
    {
      question: "Can a Raspberry Pi Pico W post to ThermalTrace?",
      answer:
        "Yes. Pico W and Pico 2 W speak HTTPS on-chip. Download CircuitPython code.py (or the MicroPython / Arduino sketch) from Dashboard → Devices, put a DS18B20 on GP4 with a 4.7k pull-up to 3.3V, and watch Serial for POST 200. Guide: thermaltrace.dev/about/pico-w-ingest.",
    },
    {
      question: "Is a Pico W the same as the claim puck?",
      answer:
        "No. The claim puck is a Waveshare RP2040-Zero over USB for bay presence and mood LEDs. Pico W is a Wi‑Fi temperature probe. Do not flash claim-puck firmware onto a freeze probe or the reverse.",
    },
    {
      question: "Should I buy Pico W or ESP32?",
      answer:
        "ESP32 remains the default freeze kit (cheaper DevKits, ESPHome, OTA samples). Choose Pico W if you already have one, prefer CircuitPython drag-and-drop, or want RP2040/RP2350. Both POST the same ingest JSON.",
    },
  ],
  "stm32-zephyr-ingest": [
    {
      question: "Can an STM32 post to ThermalTrace without Arduino or Python?",
      answer:
        "Yes. The Nucleo-F767ZI sample is Zephyr C: west build, ST-LINK flash, onboard Ethernet. DS18B20 on Arduino D4 (PF14). HTTP to the LAN TLS relay, same as the Uno W5100 path. Guide: thermaltrace.dev/about/stm32-zephyr-ingest.",
    },
    {
      question: "Why not HTTPS straight from the Nucleo?",
      answer:
        "You can, with Zephyr mbedTLS and a baked-in CA. ThermalTrace sits behind Cloudflare, so that CA can change. The LAN relay keeps the MCU on HTTP and lets the Pi/NAS handle TLS, which is the same pattern as Uno Ethernet.",
    },
    {
      question: "Is the Arduino header running Arduino firmware?",
      answer:
        "No. D4 is only the Nucleo’s Arduino-layout pin (PF14). The firmware is Zephyr C, not an .ino.",
    },
  ],
  "ch32v-riscv-ingest": [
    {
      question: "Can a CH32V post to ThermalTrace without Arduino or Python?",
      answer:
        "Yes. The CH32V307V-EVT sample is WCHNET C in MounRiver Studio: drop-in User/main.c on the official ETH/DHCP project, WCH-Link flash, onboard 10M Ethernet. DS18B20 on PB12. HTTP to the LAN TLS relay, same as Uno W5100 and STM32 Zephyr. Guide: thermaltrace.dev/about/ch32v-riscv-ingest.",
    },
    {
      question: "Why not HTTPS straight from the CH32V?",
      answer:
        "WCHNET is IPv4 TCP/UDP without a maintained TLS client. ThermalTrace ingest is HTTPS. The LAN relay keeps the MCU on HTTP and lets a Pi/NAS handle TLS, which is the same pattern as Uno Ethernet and STM32 Zephyr.",
    },
    {
      question: "Is this Arduino-CH32 or PlatformIO Arduino?",
      answer:
        "No. Some community cores wrap CH32V for Arduino IDE. This sample is vendor C (QingKe RISC-V, WCHNET), not an .ino.",
    },
  ],
  "avr-asm-ingest": [
    {
      question: "Do any ThermalTrace boards require assembly language?",
      answer:
        "No Ethernet freeze probe requires assembly. PADAUK and PIC10F are assembly-first but cannot POST HTTP. The supported assembly path is GNU AVR on an Uno + W5100: avr-gcc, no Arduino C, DS18B20 on D7, HTTP to the LAN TLS relay. Guide: thermaltrace.dev/about/avr-asm-ingest.",
    },
    {
      question: "Why not put the DS18B20 on D4 like the ESP32 sample?",
      answer:
        "The W5100 Ethernet shield uses D4 as SD card chip-select. This firmware holds D4 high and reads the probe on D7.",
    },
    {
      question: "Can I keep using the Arduino Ethernet C sketch instead?",
      answer:
        "Yes. sketches/arduino/ethernet_dht22_ingest is the C path on the same shield (DHT22 on A4/A5). Use assembly only if you want to program the 328P without Arduino C.",
    },
  ],
  "cellular-ingest": [
    {
      question: "Can a cellular board post to ThermalTrace without Wi‑Fi?",
      answer:
        "Yes. The Particle Boron sample publishes JSON on event thermaltrace_ingest; a Particle Console webhook POSTs that body to your HTTPS ingest URL. DS18B20 on D2. Guide: thermaltrace.dev/about/cellular-ingest.",
    },
    {
      question: "What happens when LTE drops?",
      answer:
        "Missed intervals are expected. ThermalTrace flags stale probes when posts stop, and freeze alerts still fire on the last known cold reading plus silence. Avoid tight reconnect loops that drain the battery.",
    },
    {
      question: "Is Blues Notecard supported?",
      answer:
        "As an alternate path: route Notehub to the same ingest URL. Devices downloads first-class Particle Boron firmware and webhook JSON.",
    },
  ],
  "pic18-ethernet-ingest": [
    {
      question: "Can a PIC18F67J60 post to ThermalTrace?",
      answer:
        "Yes. Drop-in MLA TCP/IP Stack C in MPLAB X: onboard Ethernet MAC/PHY, DS18B20 on RD0, HTTP to the LAN TLS relay. Guide: thermaltrace.dev/about/pic18-ethernet-ingest.",
    },
    {
      question: "Why not HTTPS from the PIC?",
      answer:
        "The classic Microchip TCP/IP Stack does not ship a maintained HTTPS client for Cloudflare. The LAN relay keeps the MCU on HTTP, same as Uno W5100 and STM32 Zephyr.",
    },
    {
      question: "Is this Arduino or XC8?",
      answer:
        "XC8 / MPLAB X on the MLA Ethernet demo. Not an Arduino .ino.",
    },
  ],
  "teensy41-ingest": [
    {
      question: "Can a Teensy 4.1 post to ThermalTrace?",
      answer:
        "Yes. Teensyduino + QNEthernet on Teensy 4.1 with the Ethernet kit: DS18B20 on pin 4, HTTP to the LAN TLS relay. Guide: thermaltrace.dev/about/teensy41-ingest.",
    },
    {
      question: "Why not HTTPS straight from the Teensy?",
      answer:
        "You can add TLS libraries, but Cloudflare CAs can change. The LAN relay matches Uno / STM32 / CH32V and avoids baking CAs into the MCU.",
    },
    {
      question: "Do I need the PJRC Ethernet kit?",
      answer:
        "Yes for this sample. The Teensy 4.1 has the MAC on-chip; the kit (or equivalent MagJack wiring) provides magnetics and RJ45.",
    },
  ],
  "install-pwa": [
    {
      question: "Does the PWA support freeze push alerts?",
      answer:
        "Push is a Pro channel for the browser (PWA) and the ThermalTrace Android app. Install the PWA or Android app, enable Push under Alerts, and allow notifications where the OS requires it (iOS Safari has extra limits for web push).",
    },
  ],
  "data-flow": [
    {
      question: "How do readings reach the dashboard?",
      answer:
        "Devices push or feeds are pulled, readings land in storage, charts poll or stream updates, and alert jobs evaluate thresholds on a schedule.",
    },
  ],
  "debugging-stale-readings": [
    {
      question: "Why are my probe readings stale?",
      answer:
        "Check device power and Wi‑Fi, verify the ingest key, confirm cron/history jobs on System status, and look for gaps in History before replacing sensors.",
    },
  ],
  "group-membership-model": [
    {
      question: "What is the difference between editor and view-only?",
      answer:
        "Editors can change devices, alerts, and sharing. View-only members watch live data and history without changing household configuration.",
    },
  ],
  "temperature-probe-case-study": [
    {
      question: "What did the probe case study conclude?",
      answer:
        "Multi-zone probes plus freeze thresholds catch cold events single sensors miss, especially near doors and uninsulated walls during polar snaps.",
    },
  ],
  "multi-zone-garage-layout": [
    {
      question: "Where should I place probes for freeze risk?",
      answer:
        "Prioritize the coldest expected zones: north walls, door tracks, and exterior corners, not only the workbench where you stand.",
    },
  ],
  "probe-demo": [
    {
      question: "Is the probe demo real hardware?",
      answer:
        "No: it simulates three zones so you can see how outdoor air, sun load, door state, and freeze threshold change readings and JSON, the same shapes Devices and Overview use.",
    },
    {
      question: "Does switching Garage / Workshop / Attic / Crawlspace change the model?",
      answer:
        "Yes. Each space has its own baseline offset, sun sensitivity (attics amplify heat load; crawlspaces mute it), door-mix strength, and zone labels. It is not a label-only swap, try Sun load on Attic vs Crawlspace to feel the difference.",
    },
    {
      question: "What is the difference between push and pull JSON?",
      answer:
        "Push ingest is a flat object ESP/Arduino POSTs to /api/ingest/<key>. Pull feed nests the same named probes under temp (for example north_wall, door_zone, workbench, plus avg) for scheduled HTTPS JSON.",
    },
    {
      question: "Does space status match the dashboard?",
      answer:
        "Yes for freeze risk and near-threshold watch. The simulator reuses the same Overview space-status helper with your chosen freeze °F and the coldest simulated probe.",
    },
  ],
  "zapier-make-recipes": [
    {
      question: "Can I connect ThermalTrace to Zapier or Make?",
      answer:
        "Yes on Pro via outbound webhooks for alerts and inbound tokens for actions like snooze. Recipes live in the Zapier/Make guides under About.",
    },
  ],
  "csv-export-spreadsheet-analysis": [
    {
      question: "What can I do with CSV exports?",
      answer:
        "Audit overnight lows, compare seasons, and document freeze near-misses for insurance or workshop planning in any spreadsheet tool.",
    },
  ],
  "esphome-shelly-recipes": [
    {
      question: "Do I need to stop using Home Assistant MQTT?",
      answer:
        "No. Many households dual-run: Mosquitto locally for automations, plus HTTPS push ingest for ThermalTrace freeze and leak SMS and history.",
    },
    {
      question: "Which Shelly models work?",
      answer:
        "Any Shelly that can send an HTTP POST (Plus / Gen2 scripting or webhook actions). Map the door key under Dashboard → Devices after the first POST.",
    },
  ],
  "garage-door-cold-playbook": [
    {
      question: "Can I alert on door open alone?",
      answer:
        "Yes with a door-open rule, but pairing door + temperature below threshold reduces false alarms when you are working in a warm bay or shop.",
    },
    {
      question: "Where do I create the combined rule?",
      answer:
        "Dashboard → Alerts → Rules. Add conditions for door open (or door open duration) AND temperature below your freeze threshold, then save and send a test alert.",
    },
  ],
  "personal-weather-stations": [
    {
      question: "Do I still need OpenWeather?",
      answer:
        "OpenWeather is the default and fallback. Personal stations replace the outdoor card and improve NWS/forecast context at your yard.",
    },
    {
      question: "Where are my Ambient/WeatherFlow keys stored?",
      answer:
        "In your account metadata (Dashboard → Settings), same as display preferences, not in the public git repo.",
    },
  ],
  "astro-server-side-rendering": [
    {
      question: "Does ThermalTrace use Astro SSR?",
      answer:
        "Yes. Marketing, about, and dashboard shells render on the Cloudflare Workers edge via the Astro adapter for fast first paint.",
    },
    {
      question: "Is everything static HTML?",
      answer:
        "No. Many routes are SSR. Interactive pieces hydrate as islands; see thermaltrace.dev/about/astro-islands-and-hydration.",
    },
  ],
  "astro-islands-and-hydration": [
    {
      question: "What is an Astro island on ThermalTrace?",
      answer:
        "A small client component (charts, contact form, probe demo) hydrated only where needed, while the surrounding page stays server-rendered.",
    },
    {
      question: "Do I need a full React SPA for monitoring?",
      answer:
        "ThermalTrace does not. Prefer SSR + islands for public pages; keep interactivity local. Product home: thermaltrace.dev.",
    },
  ],
  "nextjs-monitoring-dashboards": [
    {
      question: "Why is ThermalTrace not built on Next.js?",
      answer:
        "Astro on Cloudflare Workers fits edge SSR and light islands for this product. Next.js App Router is a strong alternative for auth-heavy React dashboards — see the comparison notes on this page.",
    },
    {
      question: "Can I still use ThermalTrace with a Next.js site?",
      answer:
        "Yes as a customer: probes POST to ThermalTrace ingest regardless of your other apps. ThermalTrace remains the hosted alerts and history layer.",
    },
  ],
  "node-express-api-patterns": [
    {
      question: "Does ThermalTrace run Express?",
      answer:
        "No. Public APIs and pages run on Cloudflare Workers with Astro routes. Express is discussed here for comparison with long-running Node APIs.",
    },
    {
      question: "Where is the HTTP API?",
      answer:
        "thermaltrace.dev/docs/api and openapi.yaml — ingest, metrics, webhooks, and claim-puck endpoints.",
    },
  ],
  "comparing-full-stack-options": [
    {
      question: "Which stack does ThermalTrace use?",
      answer:
        "Astro SSR on Cloudflare Workers, Supabase for data, and probe ingest over HTTPS. Alternatives (Next, Express) are compared on this page.",
    },
    {
      question: "Should I rebuild ThermalTrace myself?",
      answer:
        "Only if you want to own ops. Most homeowners use the hosted product: thermaltrace.dev/pricing.",
    },
  ],
  "relay-security-and-access": [
    {
      question: "Do ESP32 freeze probes need a public IP?",
      answer:
        "No for push ingest: the board POSTs outbound HTTPS to ThermalTrace. Pull feeds need a reachable HTTPS JSON URL if you use that path.",
    },
    {
      question: "How should I harden a DIY JSON relay?",
      answer:
        "Terminate TLS, restrict source IPs when possible, and avoid embedding ingest keys in public repos. Prefer ThermalTrace push keys from Dashboard → Devices.",
    },
  ],
  "thermostat-oauth": [
    {
      question: "Which thermostats connect to ThermalTrace?",
      answer:
        "Nest (Google Device Access / SDM) when Worker secrets are set, and Ecobee when developer signup is open. Guide: thermaltrace.dev/about/thermostat-oauth.",
    },
    {
      question: "Is Nest required for freeze alerts?",
      answer:
        "No. Freeze alerts use your probes. Nest/Ecobee add indoor house context on Overview when entitled (Pro).",
    },
    {
      question: "What if Ecobee developer signup is closed?",
      answer:
        "Use Home Assistant → ingest → Indoor reference on Dashboard → Devices so house ambient still overlays your week chart.",
    },
  ],
  "mqtt-bridge": [
    {
      question: "Do I have to abandon MQTT for ThermalTrace?",
      answer:
        "No. Keep Mosquitto/Home Assistant for local automations and POST HTTPS ingest for ThermalTrace freeze/leak alerts and history.",
    },
    {
      question: "What does the MQTT bridge publish?",
      answer:
        "It maps broker topics into ThermalTrace ingest JSON (temps, doors, leaks). Details: thermaltrace.dev/about/mqtt-bridge.",
    },
    {
      question: "Is TLS required to thermaltrace.dev?",
      answer:
        "Yes for cloud ingest. Local MQTT can stay on your LAN; the bridge or device must HTTPS POST to your ingest URL.",
    },
  ],
  "probe-mounting-enclosures": [
    {
      question: "Where should I mount a waterproof DS18B20?",
      answer:
        "On pipe metal or in still air away from sunny doors. Leave the epoxy bead uncrushed. Guide: thermaltrace.dev/about/probe-mounting-enclosures.",
    },
    {
      question: "Can the ESP32 live in the crawlspace with the probe?",
      answer:
        "Prefer a dry enclosure for the MCU and only run the probe tip into damp areas. Moisture kills boards faster than sensors.",
    },
    {
      question: "Is there a parts list for mounts?",
      answer:
        "Yes: zip-ties, clips, pads, and 4.7k notes on thermaltrace.dev/probe-mount-kit, plus the ESP32 freeze kit BOM.",
    },
  ],
};

export function getAboutFaqs(slug: string): AboutFaqItem[] {
  return aboutFaqsBySlug[slug] ?? [];
}

/** Convert FAQ items into AboutContentBlock list for article footers. */
export function aboutFaqsToBlocks(faqs: AboutFaqItem[]): AboutContentBlock[] {
  if (faqs.length === 0) return [];
  return [
    { type: "h2", text: "FAQ" },
    ...faqs.flatMap((faq) => [
      {
        type: "p" as const,
        html: `<strong>${faq.question}</strong><br />${faq.answer}`,
      },
    ]),
  ];
}
