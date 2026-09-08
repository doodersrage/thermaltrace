import type { AboutFaqItem } from "./aboutFaqs";
import { BRAND_DESCRIPTION, BRAND_SPACES } from "./brand";
import { FREEZE_MAP_SAMPLE_FLOOR } from "./freezeMapSeed";
import { getFaqPageSchema } from "./schemaMarkup";

export type MarketingFaqItem = AboutFaqItem;

/** High-intent FAQs for marketing pages (FAQPage JSON-LD + on-page AEO). */
export const marketingFaqs = {
  home: [
    {
      question: "What is ThermalTrace?",
      answer:
        `${BRAND_DESCRIPTION} Build with ESP32, Pico W, or Arduino; ThermalTrace handles the hosted dashboard, history, and household alerts.`,
    },
    {
      question: "How do I connect ESP32, Pico W, or Arduino sensors?",
      answer:
        "Create a push device under Dashboard → Devices, copy the ingest key from the callout (or use Reveal ingest key later), POST JSON to /api/ingest/<key>, and sensors auto-import on first POST. ESP32, Pico W, and Arduino Ethernet samples live on thermaltrace.dev/about/adding-devices. No hardware? Try the demo pull quick start on Overview.",
    },
    {
      question: "Does ThermalTrace send freeze alerts?",
      answer:
        "Yes. Set a freeze threshold and enable channels such as email, Discord, Telegram, Slack, or (on Pro) SMS, WhatsApp, and browser push. Remaining-hours time-to-freeze alerts fire before the probe crosses freeze, using this space's lag vs the outdoor forecast (details: thermaltrace.dev/about/time-to-freeze). Predictive outdoor forecast freeze alerts are on Member; official NWS freeze and cold alerts are on Pro. Leak / flood sensors also notify automatically when wet; door, motion, power, and air quality use custom rules. With a Telegram bot webhook, you can reply /status, /snooze, or /vacation from chat.",
    },
    {
      question: "Is ThermalTrace free?",
      answer:
        "Yes, there is a free plan with live curves, 7-day history, threshold freeze and leak alerts, and one family live share link (7-day expiry). Member adds 90-day history, CSV export, more devices, and forecast freeze warnings; Pro adds 1-year+ history, official NWS freeze and cold alerts, SMS, push, unlimited share scopes (history, metrics, never-expire), a printable claims evidence pack, webhooks, and a trial. Annual Member and Pro billing is discounted versus monthly.",
    },
    {
      question: "Why do I need an account?",
      answer:
        "An account links your ingest keys, history, and alerts to your household: it is how we keep your probes private. Registration is free with no credit card. You can try the interactive probe simulator or watch the live demo without signing up; create an account when you are ready to connect your own hardware.",
    },
    {
      question: "Is there a ThermalTrace Android app?",
      answer:
        "A native Android app is available in early access on GitHub while Google Play review finishes. You can also use the full web dashboard or install the Progressive Web App. Companion clients (Android, Desktop, Bay Buddy, PWA) are listed at thermaltrace.dev/apps. The phone and desktop apps do not sense temperature: they connect to your ThermalTrace account.",
    },
    {
      question: "Where is ThermalTrace hosted?",
      answer:
        "On Cloudflare’s edge network (Workers), so the site and ingest APIs run close to visitors without you maintaining a VPS. Live job and ingest health is on thermaltrace.dev/system-status: we publish what we measure, not a marketing uptime percentage.",
    },
  ],
  demo: [
    {
      question: "How is this different from the homepage demo?",
      answer:
        "The homepage points you at the interactive probe simulator first, with a short live-readings teaser. This page keeps both: a prominent simulator promo plus the full live feed (probes + outdoor weather), freeze-alert context, kit steps, and QR onboarding.",
    },
    {
      question: "Live feed vs interactive simulator, which should I try?",
      answer:
        "Start with the interactive probe simulator (/about/probe-demo) when you want to cause a cold snap or door draft and watch multi-zone risk respond. Use the live feed on this page to see real demo probes on the same ingest path your ESP/Arduino will use: observational proof, not a sandbox.",
    },
    {
      question: "What is kit QR onboarding?",
      answer:
        "After you create a push device, ThermalTrace shows a QR code for the full ingest URL (about 30 minutes). Scan it from a phone or print it on a kit label so firmware or Home Assistant can POST without typing the key. Walkthrough: thermaltrace.dev/about/kit-qr-onboarding.",
    },
    {
      question: "Is the live demo fake data?",
      answer:
        "No. Readings come from the public ThermalTrace demo feed over the same HTTPS ingest/pull path production devices use. The interactive simulator is intentionally synthetic so you can manipulate outdoor air, sun, and door state: it reuses the real Overview space-status helper for freeze risk.",
    },
    {
      question: "Do I need an account to try this?",
      answer:
        "No for this page or the probe simulator. You need a free account (no credit card) to create your own device key, keep history, and set freeze alerts. Plan details: thermaltrace.dev/pricing.",
    },
  ],
  pricing: [
    {
      question: "What is included on the Free plan?",
      answer:
        `Live readings for temperature, humidity, air quality, doors, leaks, energy, and motion across ${BRAND_SPACES}; 7 days of history; threshold freeze and leak alerts plus a time-to-freeze clock; email and chat-style channels; a limited number of devices; one family live share link; and household sharing so family can watch the same sensors.`,
    },
    {
      question: "When should I upgrade to Member or Pro?",
      answer:
        "Choose Member for 90-day history, CSV export, more devices, and predictive forecast freeze warnings. Choose Pro for 1-year+ history, official NWS freeze and cold alerts, Nest/Ecobee (or indoor reference) house context, SMS/WhatsApp, browser push, unlimited share links (history, metrics, embeds, never-expire), a printable claims / insurance evidence pack, inbound/outbound webhooks, Prometheus metrics, up to 50 owned properties, and a 14-day trial. Free already includes one family live share link. Annual billing is discounted versus paying monthly.",
    },
    {
      question: "When do I need Portfolio instead of Pro?",
      answer:
        "Pro already covers up to 50 owned properties, enough for a vacation home, a few rentals, or a workshop plus house. Portfolio raises that ceiling to 500 and adds property-manager logins so on-site staff can manage devices and alerts for assigned properties without seeing billing or other sites. See thermaltrace.dev/property-management.",
    },
    {
      question: "What is the claims / insurance evidence pack?",
      answer:
        "On Pro, History can export a PDF claims summary for a date range you choose: freeze exposure, devices, and alert timeline, with matching readings and alert-event CSVs. It is monitoring evidence for your own use, not a legal or insurance determination. An HTML version is also available if you need to edit or re-print.",
    },
    {
      question: "Can I cancel or change plans anytime?",
      answer:
        "Paid plans bill through Stripe. You can manage or cancel from the customer portal; missing payment may return the account to Free limits. Charts and CSV immediately follow the current plan window (7 days on Free). Older readings are not wiped on downgrade: they stay stored on the usual retention schedule and become visible again if you re-upgrade before they expire.",
    },
    {
      question: "What is the refund policy for the Pro trial?",
      answer:
        "The Pro trial is free. Cancel before it ends and you are not charged. After a trial converts to a paid plan, the current billing period is generally non-refundable. Contact us if a charge looks wrong and we will review it.",
    },
    {
      question: "How reliable is ThermalTrace hosting?",
      answer:
        "The app runs on Cloudflare Workers at the edge. Check thermaltrace.dev/system-status for live cron and ingest health, and subscribe there for degradation notices. We do not quote Cloudflare’s platform SLA as our own uptime percentage.",
    },
  ],
  compare: [
    {
      question: "How is ThermalTrace different from a DIY script?",
      answer:
        "ThermalTrace hosts ingest, history, households, and multi-channel freeze and leak alerts for you. A DIY cron script requires you to run servers, databases, Twilio wiring, and uptime yourself.",
    },
    {
      question: "How does ThermalTrace compare to Govee or SmartThings?",
      answer:
        `Govee and SmartThings are general consumer/smart-home apps. ThermalTrace is purpose-built for ${BRAND_SPACES}: ESP/Arduino or JSON ingest, freeze workflows, air quality, doors, leaks, energy, and CSV history, rather than a catch-all device dashboard.`,
    },
    {
      question: "Do I need a public IP for my Arduino?",
      answer:
        "No for push ingest: the device POSTs outbound to ThermalTrace. Pull feeds need a reachable HTTPS JSON URL if you use that path instead.",
    },
    {
      question: "Can I keep Home Assistant or MQTT and still use ThermalTrace?",
      answer:
        "Yes. Install the official HACS integration (github.com/doodersrage/thermaltrace-home-assistant) for automatic entities from a share link, or keep MQTT on your LAN and mirror with POST /api/ingest/mqtt. Many people dual-run: HA locally, ThermalTrace for household freeze and leak SMS and history. See thermaltrace.dev/integrations/home-assistant.",
    },
    {
      question: "Why does ThermalTrace require an account?",
      answer:
        "ThermalTrace is hosted so you do not run databases or SMS wiring yourself. A free account (no credit card) attaches your ingest key to your household. You can still dual-run with Home Assistant or MQTT on the LAN. ThermalTrace is the off-site alerts and history layer.",
    },
    {
      question: "Do I need to keep a home server online?",
      answer:
        "No. ThermalTrace runs on Cloudflare’s edge; your probes only need outbound HTTPS (push) or a reachable pull URL. Live service health is at thermaltrace.dev/system-status.",
    },
    {
      question: "I already have Govee or a Tempest: do I still need this?",
      answer:
        `Govee is a consumer room sensor; Tempest is outdoor weather. ThermalTrace watches probe curves in ${BRAND_SPACES} on hardware you control. They can coexist: see the Govee and Tempest comparison pages for when each tool is the better fit.`,
    },
  ],
  "freeze-map": [
    {
      question: "What is the ThermalTrace freeze map?",
      answer:
        "An opt-in, city-level aggregate of anonymized probe temperature samples from contributing households: useful for seeing regional freeze risk, not a personal live feed. Embed it or use the Markdown badge once your metro is live.",
    },
    {
      question: "Is freeze-map data personally identifiable?",
      answer:
        "No. Contributions are aggregated at city level for public display. No addresses, device names, or household IDs appear on the map. Your account dashboard remains private to your household.",
    },
    {
      question: "Can I remove my household’s contribution after opting in?",
      answer:
        "Yes. Turn off freeze-map opt-in under Dashboard → Household anytime. Your probes stop contributing to the next hourly snapshot; prior city aggregates stay anonymized (they never named you).",
    },
    {
      question: "How many households does it take before my city shows real data?",
      answer:
        `A city appears on the default map once at least ${FREEZE_MAP_SAMPLE_FLOOR} opted-in households with a live temperature probe contribute in the same snapshot window. Sparse cities (below that floor) are hidden by default but can be shown with the sparse toggle. Until any city meets the floor, the page shows a clearly labeled sample preview.`,
    },
    {
      question: "What if I only have one probe: does that count?",
      answer:
        "Yes. Each opted-in household contributes one sample for its city (the average of that household’s temperature probes, with freeze-risk based on the coldest). One probe is enough.",
    },
    {
      question: "What does freeze-risk share mean?",
      answer:
        "For each city, Samples is the number of opted-in households in that snapshot. Freeze-risk share is the percent (and count) of those households whose coldest probe was at or below 34°F at capture time.",
    },
  ],
  contact: [
    {
      question: "What should I ask about before contacting support?",
      answer:
        "Probe wiring, ingest payloads, freeze and leak alerts, and dashboard setup are covered in the guides hub and all articles library. Use this form for account, billing, Android launch notes, or questions the docs do not answer.",
    },
    {
      question: "Should I use the form or GitHub?",
      answer:
        "Account, billing, and household questions belong on this form. Bugs, firmware patches, and feature ideas belong in GitHub issues so other builders can follow along.",
    },
    {
      question: "How soon will I get a reply?",
      answer:
        "We usually reply within 1–2 business days. The form is protected by Cloudflare Turnstile; we do not publish a support inbox so that mailbox stays off spam lists.",
    },
  ],
  docsApi: [
    {
      question: "Where is the ThermalTrace OpenAPI spec?",
      answer:
        "Download openapi.yaml from /openapi.yaml on thermaltrace.dev (also mirrored on the GitHub Pages developer docs). The in-app page at /docs/api is the human quick reference with curl examples, rate limits, and error codes.",
    },
    {
      question: "How do I authenticate to the HTTP API?",
      answer:
        "Device firmware uses a per-device ingest key in the URL (or X-Ingest-Key for the MQTT bridge). Pro integrations use a Bearer API key from Dashboard → Share. The browser dashboard uses session cookies, not for third-party clients. Share and inbound routes use opaque tokens in the path.",
    },
    {
      question: "What are the ingest rate limits?",
      answer:
        "Push ingest accepts about 64KB max body and about 60 requests per minute per device key (per Worker isolate). Oversized bodies return 413; rate limit returns 429. Keep firmware under those ceilings: typical garage probes POST every 1–5 minutes.",
    },
    {
      question: "What does “encrypted vault” mean for reveal-ingest-key?",
      answer:
        "When the deployment sets INGEST_KEY_ENCRYPTION_SECRET, new push keys are stored encrypted so owners can Reveal ingest key later from Devices (rate-limited and audited). On thermaltrace.dev this is enabled. If the vault secret is missing, create/rotate a key and copy it from the 30-minute callout, there is nothing to decrypt later.",
    },
    {
      question: "Where do I find full request/response schemas?",
      answer:
        "openapi.yaml is the source of truth. Longer walkthroughs live at doodersrage.github.io/thermaltrace (ingest, Grafana, webhooks). Product how-tos: thermaltrace.dev/about/ingest-and-webhooks and /about/adding-devices.",
    },
    {
      question: "What is the claim puck API?",
      answer:
        "Companion-session endpoints under /api/pucks (register, claim/start, claim/finish) plus GET/PUT /api/bays/{bay}/mood. Used by the RP2040-Zero claim puck and Bay Buddy. Setup: thermaltrace.dev/claim-puck. Details on /docs/api#claim-puck.",
    },
  ],
  claimPuck: [
    {
      question: "What is a ThermalTrace claim puck?",
      answer:
        "A Waveshare RP2040-Zero running claim-puck firmware. It proves physical presence when you claim a bay (button on GP4), then shows Bay Buddy freeze/flood moods on its LED. It is not a temperature probe. For a Wi‑Fi DS18B20 on Pico W / Pico 2 W, see thermaltrace.dev/about/pico-w-ingest.",
    },
    {
      question: "Do I need Bay Buddy?",
      answer:
        "Bay Buddy is the easiest way to claim and drive the puck after you sign in. You can also use the host CLI in the thermaltrace-claim-puck repo with companion access and refresh tokens.",
    },
    {
      question: "Is this the same as the Claims pack?",
      answer:
        "No. Claims pack is a printable insurance evidence PDF on thermaltrace.dev/claims-pack. Claim puck is a hardware presence key and mood light.",
    },
    {
      question: "Where are other accessories?",
      answer:
        "Alert beacon, door/leak/power contacts, kit labels, probe mount kit, and puck case: thermaltrace.dev/accessories.",
    },
  ],
  accessories: [
    {
      question: "Do accessories replace a freeze probe?",
      answer:
        "No. Accessories are companions (mood lights, claim presence) or contact sensors (door, leak, power) and kit pieces (labels, mounts, cases). Temperature still needs a DS18B20 path such as the ESP32 freeze kit.",
    },
    {
      question: "Which accessory should I buy first?",
      answer:
        "After a working freeze probe: claim puck + Bay Buddy for desk moods, or leak puck under a water heater. Kit labels and the probe mount kit help any install.",
    },
    {
      question: "Where is the freeze kit parts list?",
      answer:
        "ESP32 + waterproof DS18B20 BOM with Adafruit and Amazon buy links: thermaltrace.dev/about/esp32-freeze-kit. Accessory catalog: thermaltrace.dev/accessories.",
    },
    {
      question: "Do Amazon buy links include affiliate tags?",
      answer:
        "When configured, Amazon URLs may include an Associates tag. Adafruit links stay direct. ThermalTrace may earn a commission from qualifying Amazon purchases at no extra cost to you.",
    },
  ],
  apps: [
    {
      question: "Do companion apps measure temperature?",
      answer:
        "No. Android, Desktop, Bay Buddy, and the PWA are clients for your ThermalTrace account. ESP/Arduino probes (or HTTPS feeds) push readings; apps sign in and display them.",
    },
    {
      question: "Which app should I install first?",
      answer:
        "Phone: Android companion or the PWA. Desk full dashboard: ThermalTrace Desktop. Glanceable freeze/flood mood on a second monitor: Bay Buddy. Catalog: thermaltrace.dev/apps.",
    },
    {
      question: "Where are hardware accessories?",
      answer:
        "Claim puck, leak pads, door contacts, and mounts live under thermaltrace.dev/accessories — separate from companion apps.",
    },
  ],
  alertBeacon: [
    {
      question: "What is an alert beacon?",
      answer:
        "A brighter NeoPixel mood light driven by the same Bay Buddy bay-mood API as the claim puck. It does not sense temperature. Setup: thermaltrace.dev/alert-beacon.",
    },
    {
      question: "Do I still need a claim puck?",
      answer:
        "Use a claim puck (or CLI) once to bind the bay. The beacon can share the mood-drive serial path afterward.",
    },
    {
      question: "Can the beacon replace Alerts SMS or email?",
      answer:
        "No. It is a glanceable mood light. Freeze and flood notifications still come from Dashboard → Alerts channels.",
    },
  ],
  doorPuck: [
    {
      question: "What does the door contact puck post?",
      answer:
        "JSON like {\"door1\":true} when open. Sketch: sketches/arduino/door_contact_ingest. Guide: thermaltrace.dev/door-puck.",
    },
    {
      question: "Will an open door trigger freeze SMS by itself?",
      answer:
        "No. Door sensors feed drafty mood and optional custom alert rules. Freeze SMS still comes from temperature thresholds on a probe.",
    },
    {
      question: "Which MCU does the sample use?",
      answer:
        "ESP32 with Wi‑Fi HTTPS POST, same path as the freeze kit. Wire a magnetic reed to GPIO4 with the board’s pull-up.",
    },
  ],
  leakPuck: [
    {
      question: "What does the leak contact puck post?",
      answer:
        "JSON like {\"leak1\":true} when wet. Flood/leak keys auto-alert when wet once alerts are on. Guide: thermaltrace.dev/leak-puck.",
    },
    {
      question: "Can leak and temperature share one device key?",
      answer:
        "Yes. POST both temp1 and leak1 on the same ingest URL, or use separate push devices per zone.",
    },
    {
      question: "Where should I place the pads?",
      answer:
        "Under water heaters, softeners, or laundry pans. Keep the ESP32 dry and elevated; only the contact pads belong on the floor.",
    },
  ],
  powerNudge: [
    {
      question: "What does the power outage nudge post?",
      answer:
        "JSON like {\"power1\":false} when sensed mains/USB is lost. The reporting ESP32 should stay on a UPS. Guide: thermaltrace.dev/power-nudge.",
    },
    {
      question: "What if the freeze probe loses power too?",
      answer:
        "Stale-reading detection covers silence. The power nudge is for an explicit power1 event when the reporter stays online.",
    },
    {
      question: "Do I need a custom alert rule?",
      answer:
        "Optional. Power sensors can drive custom Alerts rules; otherwise use Overview energy cards and stale probe warnings.",
    },
  ],
  kitLabels: [
    {
      question: "Does ThermalTrace sell QR stickers?",
      answer:
        "No. Download the SVG from Devices after create/rotate, print on waterproof labels, or write the ingest URL to an NFC tag. Guide: thermaltrace.dev/kit-labels.",
    },
    {
      question: "Is NFC safe on a public door?",
      answer:
        "No. The tag holds the ingest URL. Keep labels with the kit or inside the utility room; rotate the key if one is lost.",
    },
    {
      question: "How long does the on-screen QR last?",
      answer:
        "About 30 minutes after create/rotate on Devices. Re-open the callout or download the SVG if it expires. Walkthrough: thermaltrace.dev/about/kit-qr-onboarding.",
    },
  ],
  probeMountKit: [
    {
      question: "What is the probe mount kit?",
      answer:
        "A BOM for zip-ties, pipe clips, adhesive pads, 4.7k pull-up, and waterproof DS18B20 mounting — not a branded drop-ship kit. thermaltrace.dev/probe-mount-kit.",
    },
    {
      question: "Do I still need the ESP32 freeze kit page?",
      answer:
        "Yes for board + probe wiring and sketch download. The mount kit is the physical install BOM; the freeze kit is the electronics path: thermaltrace.dev/about/esp32-freeze-kit.",
    },
    {
      question: "Where should the probe tip sit?",
      answer:
        "Prefer pipe metal or insulated tip contact over dangling in a sunny doorway. Keep the MCU dry; only the stainless tip belongs in damp crawlspaces.",
    },
  ],
  claimPuckCase: [
    {
      question: "Do I need a case for the claim puck?",
      answer:
        "Optional. A printed enclosure, tactile button, and LED diffuser make the RP2040-Zero desk-safe. Firmware and claim API stay the same. thermaltrace.dev/claim-puck-case.",
    },
    {
      question: "Does a case change the claim API?",
      answer:
        "No. Same Bay Buddy claim flow and /api/pucks endpoints. The case only changes mechanical finish and LED diffusion.",
    },
    {
      question: "What if I want a brighter hallway light?",
      answer:
        "Use an alert beacon NeoPixel stick instead of overdriving the Zero’s tiny LED: thermaltrace.dev/alert-beacon.",
    },
  ],
  homeAssistant: [
    {
      question: "Is there an official Home Assistant integration?",
      answer:
        "Yes: a HACS custom integration at github.com/doodersrage/thermaltrace-home-assistant. It polls a share link and creates sensors/binary sensors automatically. Free includes one family live link; Pro adds history/metrics scopes and inbound snooze webhooks. Install guide: thermaltrace.dev/integrations/home-assistant.",
    },
    {
      question: "Do I need Pro for the HACS integration?",
      answer:
        "A live share link works for sensor polling. Free includes one family live link. Pro unlocks history/metrics scopes, never-expire links, and inbound webhook services (snooze, vacation, status) from Dashboard → Share. Push via thermaltrace.push uses any push device ingest key.",
    },
    {
      question: "Will HACS polling delay freeze or leak alerts?",
      answer:
        "HACS defaults to polling the share link every 5 minutes (configurable). ThermalTrace freeze and leak SMS/email/push still fire from your probe’s push ingest path immediately. Use native ESP/Arduino push (or MQTT→HTTPS bridge) for time-critical thresholds and wet contacts; keep HACS for local entities and automations.",
    },
    {
      question: "Does Nest or Ecobee OAuth work for indoor context?",
      answer:
        "On thermaltrace.dev, Pro households can connect Nest from Dashboard → Temperature when Nest OAuth is configured. Ecobee developer signups are often closed: use the HA Plan B (thermaltrace.push of climate current_temperature + Indoor reference) instead. Self-hosted operators: thermaltrace.dev/about/thermostat-oauth.",
    },
    {
      question: "Can I push HA REST sensor JSON without the HACS integration?",
      answer:
        "Yes. ThermalTrace auto-detects Home Assistant REST responses ({ state, attributes }) on POST /api/ingest/<key> and on pull feeds. Map probe key state on Devices. SenML JSON arrays are also supported. Samples: thermaltrace.dev/api/feeds/example?format=homeassistant",
    },
    {
      question: "Can I use ThermalTrace with MQTT and Home Assistant together?",
      answer:
        "Yes: the usual pattern keeps Mosquitto/ESPHome on your LAN and mirrors selected topics to ThermalTrace over HTTPS (POST /api/ingest/mqtt). ThermalTrace handles off-site freeze and leak SMS/email and history; HA keeps local automations. Recipe: thermaltrace.dev/about/mqtt-bridge.",
    },
    {
      question: "How do freeze and leak alerts reach Home Assistant?",
      answer:
        "Configure a Pro outbound webhook in ThermalTrace pointing at your HA webhook URL, or import the thermaltrace_webhook.yaml blueprint from thermaltrace.dev/ha/thermaltrace_webhook.yaml. When you set a webhook signing secret, verify the X-Signature HMAC header before acting on the payload.",
    },
  ],
  matter: [
    {
      question: "Is this an official Apple Home / Matter product?",
      answer:
        "No. thermaltrace-matter is a DIY Matterbridge plugin and is not CSA-certified. It is fine for household use; say so when pairing. Guide: thermaltrace.dev/integrations/matter.",
    },
    {
      question: "Do I need an iPhone app?",
      answer:
        "No. Pair Matterbridge once, then Apple Home (and Google Home / Alexa) show the sensors. The bridge runs on a Pi, NAS, or always-on PC on your LAN — not on Cloudflare Workers.",
    },
    {
      question: "Do I need Pro?",
      answer:
        "A Free family live share link is enough for temperature, humidity, leak, door, power, and motion. Pro adds the optional Matter snooze switch (inbound webhook) plus history/metrics share scopes.",
    },
    {
      question: "Will Matter polling delay freeze SMS?",
      answer:
        "No. Freeze and leak SMS/email/push still fire from ThermalTrace push ingest. The Matter bridge polls the share link every 1–5 minutes for Home glance and automations, same idea as the HACS integration.",
    },
    {
      question: "Can I run Matter and Home Assistant together?",
      answer:
        "Yes. Both can poll the same share link. Use HACS for HA entities and the Matterbridge plugin for Apple Home: thermaltrace.dev/integrations/home-assistant and thermaltrace.dev/integrations/matter.",
    },
  ],
  android: [
    {
      question: "Does the Android app measure probe temperature?",
      answer:
        "No. The phone is a companion client. ESP/Arduino sensors (or HTTPS JSON feeds) push readings to ThermalTrace; the app signs in and displays that account data.",
    },
    {
      question: "When will ThermalTrace be on Google Play?",
      answer:
        "Google Play listing is in review. Build or sideload from github.com/doodersrage/thermaltrace-android, or use the web dashboard / PWA from Chrome on Android until the store link goes live.",
    },
    {
      question: "Will my web account work in the Android app?",
      answer:
        "Yes. The same ThermalTrace login, households, devices, and alert settings apply. Pro push on Android uses Firebase Cloud Messaging in addition to browser Web Push.",
    },
    {
      question: "How do I get notified when the app launches?",
      answer:
        "Use the Contact form with topic=android (linked from /android) and ask for a launch note. We also announce updates on the site and GitHub repos.",
    },
  ],
  bayBuddy: [
    {
      question: "What is Bay Buddy?",
      answer:
        "Bay Buddy is the ThermalTrace desktop companion (Windows, macOS, Linux). It shows glanceable freeze and flood moods for one space after you sign in with your ThermalTrace account. It is not a second full dashboard.",
    },
    {
      question: "Where do I download Bay Buddy?",
      answer:
        "GitHub Releases for thermaltrace-bay-buddy: Linux AppImage/deb/rpm, Windows MSI, and macOS DMG. Start at thermaltrace.dev/bay-buddy.",
    },
    {
      question: "Does Bay Buddy replace the web dashboard?",
      answer:
        "No. Devices, alerts, history, claims, and household settings stay on thermaltrace.dev, the Android app / PWA, or ThermalTrace Desktop (thermaltrace.dev/desktop). Bay Buddy is a mood glance for the bay you already monitor.",
    },
    {
      question: "Can Bay Buddy drive a claim puck?",
      answer:
        "Yes. After you connect, the Claim puck panel can register and claim an RP2040-Zero, then drive its LED from /api/bays/{bay}/mood. Setup: thermaltrace.dev/claim-puck.",
    },
  ],
  desktop: [
    {
      question: "What is ThermalTrace Desktop?",
      answer:
        "ThermalTrace Desktop is the native Windows, macOS, and Linux companion dashboard for your ThermalTrace account. It covers live readings, history, alerts, devices, household, share, and portfolio — the same account as the web and Android apps. The PC is not a sensor.",
    },
    {
      question: "Where do I download ThermalTrace Desktop?",
      answer:
        "GitHub Releases for thermaltrace-desktop: Linux AppImage/deb/rpm, Windows MSI, and macOS DMG. Start at thermaltrace.dev/desktop.",
    },
    {
      question: "How is Desktop different from Bay Buddy?",
      answer:
        "Bay Buddy is a glanceable freeze/flood mood for one space (and claim puck). ThermalTrace Desktop is the full dashboard client. Keep both if you want a mood glance plus a native dashboard.",
    },
    {
      question: "Will my web account work in ThermalTrace Desktop?",
      answer:
        "Yes. Connect opens thermaltrace.dev in your browser, including MFA if enabled, then hands the session back to the app over a localhost callback.",
    },
    {
      question: "Does Desktop support notifications and kiosk mode?",
      answer:
        "Yes. On Pro, Desktop can raise OS notifications for new alert events while the app is open (Account → Desktop notifications). Kiosk mode fullscreen live readings is available from the top bar for shop displays.",
    },
  ],
} as const satisfies Record<string, MarketingFaqItem[]>;

export type MarketingFaqKey = keyof typeof marketingFaqs;

export function getMarketingFaqs(key: MarketingFaqKey): MarketingFaqItem[] {
  return [...marketingFaqs[key]];
}

export function getMarketingFaqSchema(pageUrl: string, key: MarketingFaqKey) {
  return getFaqPageSchema(pageUrl, getMarketingFaqs(key));
}
