export type ExpandedAboutPageMeta = {
  slug: string;
  parentSlug: string;
  title: string;
  description: string;
  summary: string;
};

/** Metadata for expanded about guides (content lives in aboutExpandedContent.ts). */
export const expandedAboutPageMeta: ExpandedAboutPageMeta[] = [
  {
    slug: "temperature-probe-case-study",
    parentSlug: "temperature-probes",
    title: "Temperature probe case study",
    description:
      "How two DHT22 probes in a real garage became a reliable monitoring system, from first breadboard to JSON feeds and dashboard charts.",
    summary:
      "Real-world build story: placement decisions, firmware iterations, and what the data showed after deployment.",
  },
  {
    slug: "dht22-sensor-overview",
    parentSlug: "temperature-probes",
    title: "DHT22 sensor overview",
    description: "How the DHT22 humidity–temperature sensor works, its accuracy limits, and why it fits garage, workshop, and attic monitoring.",
    summary: "Single-wire digital sensor, typical accuracy, and minimum read intervals.",
  },
  {
    slug: "probe-mounting-enclosures",
    parentSlug: "temperature-probes",
    title: "Probe mounting and enclosures",
    description: "Mount probes for stable readings in unheated spaces: height, shielding from sun and drafts, and ventilated enclosures.",
    summary: "Shoulder-height placement away from doors and heat sources in breathable housings.",
  },
  {
    slug: "multi-zone-garage-layout",
    parentSlug: "temperature-probes",
    title: "Multi-zone garage layout",
    description: "Plan multiple probe zones to capture floor-to-ceiling gradients, door-adjacent swings, and workbench areas.",
    summary: "Split the garage into meaningful zones instead of averaging away the signal you need.",
  },
  {
    slug: "probe-mapping-labels",
    parentSlug: "temperature-probes",
    title: "Probe mapping and dashboard labels",
    description: "Map JSON probe keys to human-readable names in the dashboard so home page cards match physical locations.",
    summary: "Stable JSON keys, friendly labels, and feed-level organization for multi-probe setups.",
  },
  {
    slug: "garage-door-temperature-swings",
    parentSlug: "temperature-changes",
    title: "Garage door temperature swings",
    description: "Why opening the garage door causes rapid temperature and humidity changes and how to interpret probe spikes.",
    summary: "Infiltration and thermal stratification when the largest wall opening moves.",
  },
  {
    slug: "sun-load-garage-walls",
    parentSlug: "temperature-changes",
    title: "Sun load on garage walls",
    description: "See how solar gain on south- and west-facing garage walls creates afternoon heat lag, probe drift, and false confidence vs outdoor weather.",
    summary: "Opaque wall heating, delayed interior peaks, and why outdoor weather alone misleads.",
  },
  {
    slug: "infiltration-wind-drafts",
    parentSlug: "temperature-changes",
    title: "Infiltration, wind, and drafts",
    description: "Learn how air leaks and wind pressure move garage air, and probe temperatures, even when the main door stays shut on a cold night.",
    summary: "Chronic leaks versus door events, and what probes reveal about draft paths.",
  },
  {
    slug: "seasonal-garage-patterns",
    parentSlug: "temperature-changes",
    title: "Seasonal garage patterns",
    description: "Read multi-month ThermalTrace history for winter floors, summer peaks, and shoulder-season swings so one cold night does not skew decisions.",
    summary: "Long-horizon context so single-day spikes do not drive bad decisions.",
  },
  {
    slug: "history-dashboard-browsing",
    parentSlug: "historical-data",
    title: "History dashboard browsing",
    description: "Navigate paginated ThermalTrace probe history, read feed and probe columns, and spot gaps before you trust a freeze-season CSV export.",
    summary: "Turn stored snapshots into a readable timeline inside the signed-in dashboard.",
  },
  {
    slug: "csv-export-spreadsheet-analysis",
    parentSlug: "historical-data",
    title: "CSV export and spreadsheet analysis",
    description: "Export full history for charts, pivot tables, freeze audits, and seasonal comparisons in Excel or Sheets.",
    summary: "Subscriber and admin CSV workflows for analysis outside the website.",
  },
  {
    slug: "freeze-protection-thresholds",
    parentSlug: "historical-data",
    title: "Freeze protection thresholds",
    description: "Use overnight minimums and zone comparisons to protect plumbing and stored goods before damage occurs.",
    summary: "Define risk temperatures from history instead of guessing from outdoor forecasts.",
  },
  {
    slug: "arduino-ide-setup",
    parentSlug: "arduino-sketches",
    title: "Arduino IDE setup and flashing",
    description: "Install the Arduino IDE, select board and port, install libraries, and flash the probe sketch.",
    summary: "Bench setup before mounting hardware in the space.",
  },
  {
    slug: "sketch-polling-main-loop",
    parentSlug: "arduino-sketches",
    title: "Sketch polling and main loop",
    description: "See how Arduino firmware timers read DHT22 probes, serve HTTP JSON, and refresh the LCD without blocking the controller loop.",
    summary: "Non-blocking loop design for sensors, network, and local display.",
  },
  {
    slug: "json-probe-output-schema",
    parentSlug: "arduino-sketches",
    title: "JSON probe output schema",
    description: "Stable JSON keys, temperature units, humidity fields, and average computation for dashboard consumers.",
    summary: "Contract between firmware and every downstream client including this website.",
  },
  {
    slug: "firmware-watchdog-recovery",
    parentSlug: "arduino-sketches",
    title: "Firmware watchdog and recovery",
    description: "Recover from rare network hangs and sensor bus errors without climbing a ladder to power-cycle the board.",
    summary: "Watchdog timers, retries, and reboot strategies for unattended installs.",
  },
  {
    slug: "breadboard-power-rails",
    parentSlug: "arduino-circuit-wiring",
    title: "Breadboard power rails",
    description: "Distribute USB or barrel power across the breadboard for sensors, LCD, and pull-ups with a shared ground.",
    summary: "Clean power rails reduce noise that shows up as bogus humidity spikes.",
  },
  {
    slug: "ethernet-shield-stacking",
    parentSlug: "arduino-circuit-wiring",
    title: "Ethernet shield stacking",
    description: "Mechanically stack the W5100 shield on the Uno, preserve ICSP clearance, and route cables away from heat.",
    summary: "Physical assembly details before locking the board in an enclosure.",
  },
  {
    slug: "circuit-wiring-troubleshooting",
    parentSlug: "arduino-circuit-wiring",
    title: "Circuit wiring troubleshooting",
    description: "Diagnose blank LCDs, missing DHT22 probes, and intermittent probe reads with a multimeter, serial logs, and a power-to-data checklist.",
    summary: "Systematic checks from power to data lines before replacing parts.",
  },
  {
    slug: "liquid-crystal-gpio-map",
    parentSlug: "arduino-pin-wiring",
    title: "LiquidCrystal GPIO map",
    description: "Match LiquidCrystal RS, E, and D4–D7 pins to your Arduino sketch constructor so the LCD lights up instead of staying blank.",
    summary: "LCD pins must match the sketch exactly or the display stays blank.",
  },
  {
    slug: "dht22-data-line-wiring",
    parentSlug: "arduino-pin-wiring",
    title: "DHT22 data line wiring",
    description: "Wire each DHT22 with its own GPIO, 10 kΩ pull-up, and shared ground, and route cables away from door motors and noisy loads to cut read errors.",
    summary: "One data pin per probe with proper pull-up and length limits.",
  },
  {
    slug: "spi-pins-ethernet-reserved",
    parentSlug: "arduino-pin-wiring",
    title: "SPI pins reserved for Ethernet",
    description: "Which Arduino pins a W5100 Ethernet shield reserves for SPI, and which GPIO stay free for LiquidCrystal and DHT22 probes.",
    summary: "Avoid pin conflicts between the Ethernet stack and local peripherals.",
  },
  {
    slug: "dht22-read-errors-retries",
    parentSlug: "arduino-dht22-lcd",
    title: "DHT22 read errors and retries",
    description: "Handle checksum failures and timing violations with backoff so one bad read does not blank the feed.",
    summary: "Retry logic and minimum intervals keep JSON stable in drafty installs.",
  },
  {
    slug: "lcd-local-display-format",
    parentSlug: "arduino-dht22-lcd",
    title: "LCD local display format",
    description: "Format on-site temperature and humidity LCD lines so you can validate probes on-site without opening a laptop.",
    summary: "Two-line layout conventions for dual-probe controllers.",
  },
  {
    slug: "dual-probe-averaging",
    parentSlug: "arduino-dht22-lcd",
    title: "Dual-probe averaging logic",
    description: "Compute the JSON average across healthy probes while keeping per-zone values on the LCD and in feeds.",
    summary: "When to average, when to exclude a failed read, and how history uses avg.",
  },
  {
    slug: "fastapi-relay-setup",
    parentSlug: "python-feeds",
    title: "FastAPI relay setup",
    description: "Install and run the Python FastAPI relay that polls upstream Arduino JSON and exposes a stable HTTPS feed for ThermalTrace to pull.",
    summary: "Install, configure upstream URL, and verify cached responses with curl.",
  },
  {
    slug: "redis-cache-for-feeds",
    parentSlug: "python-feeds",
    title: "Redis cache for feeds",
    description: "Cache Arduino probe JSON in Redis so every ThermalTrace page view does not hammer your home uplink. TTL, stale-while-revalidate, recovery.",
    summary: "TTL tuning, stale-while-revalidate behavior, and restart recovery.",
  },
  {
    slug: "relay-security-and-access",
    parentSlug: "python-feeds",
    title: "Relay security and access",
    description: "TLS termination, firewall rules, and access control for a residential JSON relay exposed to the web.",
    summary: "Harden the relay without complicating the Arduino firmware.",
  },
  {
    slug: "astro-server-side-rendering",
    parentSlug: "astro-applications",
    title: "Astro server-side rendering",
    description: "How Astro server-side rendering delivers fast first paint on ThermalTrace home, about, and dashboard pages versus static prerender.",
    summary: "SSR pages versus static prerender in this Cloudflare deployment.",
  },
  {
    slug: "astro-islands-and-hydration",
    parentSlug: "astro-applications",
    title: "Astro islands and hydration",
    description: "Client islands for interactive pieces like the contact form and probe demo without shipping a full SPA.",
    summary: "Selective JavaScript where interactivity actually matters.",
  },
  {
    slug: "cloudflare-workers-deployment",
    parentSlug: "astro-applications",
    title: "Cloudflare Workers deployment",
    description: "Build and deploy ThermalTrace to Cloudflare Workers with the Astro adapter, wrangler config, and edge hosting for pages plus APIs.",
    summary: "Edge hosting for pages, API routes, and assets in one pipeline.",
  },
  {
    slug: "nextjs-monitoring-dashboards",
    parentSlug: "nextjs-node-applications",
    title: "Next.js for monitoring dashboards",
    description: "When Next.js App Router and React Server Components fit environmental monitoring UIs versus ThermalTrace’s Astro edge stack.",
    summary: "Strengths of Next for auth-heavy dashboards versus this Astro stack.",
  },
  {
    slug: "node-express-api-patterns",
    parentSlug: "nextjs-node-applications",
    title: "Node and Express API patterns",
    description: "Compare long-running Node/Express APIs with FastAPI relays and Astro edge routes for probe ingest and dashboard data.",
    summary: "Where Express still wins and where Python or edge routes are simpler.",
  },
  {
    slug: "comparing-full-stack-options",
    parentSlug: "nextjs-node-applications",
    title: "Comparing full-stack options",
    description: "Choose among Astro, Next.js, and standalone Node for space monitoring. SSR, auth, billing, and hardware ingest trade-offs explained.",
    summary: "Trade-offs for SSR, auth, billing, and hardware integration.",
  },
  {
    slug: "home-page-probe-fetch",
    parentSlug: "data-flow",
    title: "Home page probe fetch",
    description: "Server code loads configured feed URLs, parses JSON, and renders stat cards on each home page request.",
    summary: "Guest defaults versus signed-in feed mappings from Supabase.",
  },
  {
    slug: "supabase-history-inserts",
    parentSlug: "data-flow",
    title: "Supabase history inserts",
    description: "Understand when signed-in ThermalTrace loads persist probe rows with timestamps, labels, and humidity, and what guests never store.",
    summary: "What triggers a save, what is stored per probe, and guest behavior.",
  },
  {
    slug: "debugging-stale-readings",
    parentSlug: "data-flow",
    title: "Debugging stale readings",
    description: "Trace stale or missing probe readings from firmware through relay cache to ThermalTrace dashboard mapping, with a curl and auth checklist.",
    summary: "Checklist for curl, cache, auth, and key typos in order.",
  },
  {
    slug: "supabase-auth-flow",
    parentSlug: "accounts-and-dashboard",
    title: "Supabase auth flow",
    description: "Email registration, sign-in cookies, default user group membership, and session handling on Cloudflare.",
    summary: "How accounts are created and authenticated end to end.",
  },
  {
    slug: "stripe-csv-subscription",
    parentSlug: "accounts-and-dashboard",
    title: "Stripe CSV subscription",
    description: "Unlock CSV history export with Stripe Checkout, webhooks, and the member group so winter freeze audits leave the dashboard for your spreadsheet.",
    summary: "Billing flow from checkout to unlocked history download.",
  },
  {
    slug: "configuring-temperature-feeds",
    parentSlug: "accounts-and-dashboard",
    title: "Configuring temperature feeds",
    description:
      "Add HTTPS pull-feed URLs, set the JSON root key, map probe labels, and verify Home updates: complement to the adding-devices walkthrough.",
    summary: "Pull-feed URLs, JSON root key, probe labels, and troubleshooting.",
  },
  {
    slug: "admin-dashboard-features",
    parentSlug: "accounts-and-dashboard",
    title: "Admin dashboard features",
    description: "Use admin-only tools for user management, contact triage, and CSV export without a paid subscription when you operate the ThermalTrace site.",
    summary: "Tools gated by the admin group for site operators.",
  },
  {
    slug: "humidity-condensation-basics",
    parentSlug: "temperature-probes",
    title: "Humidity and condensation basics",
    description: "How relative humidity, dew point, and cold surfaces interact in unheated spaces, and what DHT22 probes can and cannot tell you.",
    summary: "Dew point math in plain language and why air temperature alone misses condensation risk.",
  },
  {
    slug: "probe-cable-length-limits",
    parentSlug: "temperature-probes",
    title: "Probe cable length limits",
    description: "How unshielded DHT22 cable runs affect read reliability, timing errors, and when to shorten or reroute sensor wiring.",
    summary: "Keep data lines short, twisted, and away from motor noise for stable JSON feeds.",
  },
  {
    slug: "thermal-mass-concrete-slab",
    parentSlug: "temperature-changes",
    title: "Thermal mass and concrete slabs",
    description: "Why floor slabs lag outdoor swings, store heat, and make probes near the ground read differently from chest-height sensors.",
    summary: "Concrete buffers day-night cycles: expect delayed peaks and cold floors after warm afternoons.",
  },
  {
    slug: "hvac-duct-influence",
    parentSlug: "temperature-changes",
    title: "HVAC duct influence on probes",
    description: "When furnace or AC ducts pass through or near an unheated space, how stray airflow and leakage shift probe readings.",
    summary: "Duct leaks and register proximity create localized heat that outdoor weather cannot explain.",
  },
  {
    slug: "stored-vehicle-heat",
    parentSlug: "temperature-changes",
    title: "Stored vehicle heat in the garage",
    description: "How recently driven cars radiate heat, elevate humidity, and temporarily bias nearby temperature probes.",
    summary: "Hot engines and exhaust surfaces create short-lived microclimates near parked vehicles.",
  },
  {
    slug: "spotting-data-gaps",
    parentSlug: "historical-data",
    title: "Spotting data gaps in history",
    description: "Recognize missing inserts, feed outages, and reboot gaps in dashboard charts before they skew freeze audits.",
    summary: "Flat lines, stair-steps, and empty ranges usually mean collection stopped, not stable weather.",
  },
  {
    slug: "charting-with-spreadsheets",
    parentSlug: "historical-data",
    title: "Charting history with spreadsheets",
    description: "Build pivot charts, overnight rolling minimums, and dual-axis humidity plots from ThermalTrace CSV exports for freeze audits.",
    summary: "Turn raw timestamp rows into freeze audits and seasonal comparisons outside the website UI.",
  },
  {
    slug: "serial-debugging-tips",
    parentSlug: "arduino-sketches",
    title: "Serial debugging tips",
    description: "Use the Arduino serial monitor effectively for DHT22 timing, Ethernet status, and HTTP trace logs during bench bring-up.",
    summary: "Structured serial output accelerates firmware debug before the board moves to the monitored space.",
  },
  {
    slug: "library-dependencies",
    parentSlug: "arduino-sketches",
    title: "Library dependencies for the sketch",
    description: "Which Arduino libraries the probe firmware expects, version pitfalls, and how to reproduce a known-good build.",
    summary: "Pin compatible DHT, LiquidCrystal, and Ethernet stacks prevent compile surprises on fresh laptops.",
  },
  {
    slug: "static-ip-vs-dhcp",
    parentSlug: "arduino-sketches",
    title: "Static IP versus DHCP on the Arduino",
    description: "Choose between DHCP convenience and reserved static IPs for reliable probe JSON endpoints and firewall rules.",
    summary: "Stable addressing simplifies relay configuration, port forwarding, and mental models for curl tests.",
  },
  {
    slug: "ground-loop-avoidance",
    parentSlug: "arduino-circuit-wiring",
    title: "Ground loop avoidance",
    description: "Prevent duplicate ground paths and noisy references when USB bench power meets barrel supply and long sensor cables.",
    summary: "One intentional ground star point beats mysterious DHT22 timeouts from loop currents.",
  },
  {
    slug: "enclosure-ventilation",
    parentSlug: "arduino-circuit-wiring",
    title: "Enclosure ventilation for electronics",
    description: "Ventilate project boxes so the LCD, Ethernet shield, and regulators stay cool without cooking remote probe air samples.",
    summary: "MCU enclosures need airflow; probe boxes need breathable vents: do not treat them the same.",
  },
  {
    slug: "backlight-pwm-options",
    parentSlug: "arduino-pin-wiring",
    title: "LCD backlight PWM options",
    description: "Dim the 16×2 LCD backlight with a transistor, PWM pin, or timed shutdown to reduce glare and power draw overnight.",
    summary: "Backlight control is separate from LiquidCrystal data pins: wire it deliberately.",
  },
  {
    slug: "jumper-wire-standards",
    parentSlug: "arduino-pin-wiring",
    title: "Jumper wire standards for breadboards",
    description: "Pick solid versus stranded jumpers, color conventions, and mechanical strain relief for vibration-prone mounts.",
    summary: "Consistent wire colors and firm seating prevent intermittent probes after the door shakes the wall.",
  },
  {
    slug: "sensor-warm-up-time",
    parentSlug: "arduino-dht22-lcd",
    title: "DHT22 sensor warm-up time",
    description: "Allow stabilization after power-on before trusting humidity readings for condensation or mold decisions.",
    summary: "First reads after boot can lag; warm-up minutes matter for humidity more than temperature.",
  },
  {
    slug: "lcd-i2c-alternative",
    parentSlug: "arduino-dht22-lcd",
    title: "I²C LCD alternative",
    description: "Free GPIO pins by moving from parallel LiquidCrystal to an I²C backpack module when the Ethernet shield consumes the pin budget.",
    summary: "Two-wire I²C LCDs trade pin savings for different library code and address planning.",
  },
  {
    slug: "docker-relay-deployment",
    parentSlug: "python-feeds",
    title: "Docker deployment for the Python relay",
    description: "Run the FastAPI probe relay and Redis in Docker for reproducible upgrades on a home server or small VPS without dependency drift.",
    summary: "Container images pin Python dependencies and simplify restart after power blips.",
  },
  {
    slug: "environment-variables-relay",
    parentSlug: "python-feeds",
    title: "Environment variables for the relay",
    description: "Configure upstream URLs, Redis DSN, TTL seconds, and log levels without editing Python source on the server.",
    summary: "Twelve-factor style config keeps secrets out of git and simplifies Docker restarts.",
  },
  {
    slug: "health-check-endpoints",
    parentSlug: "python-feeds",
    title: "Health check endpoints for relays",
    description: "Expose liveness and readiness routes so Docker, uptime robots, and you know when cache or upstream probes fail.",
    summary: "/health should mean more than 'Python process running': verify Redis and last good upstream fetch.",
  },
  {
    slug: "middleware-auth-patterns",
    parentSlug: "astro-applications",
    title: "Middleware auth patterns in Astro",
    description: "Guard dashboard and API routes with session checks on Cloudflare before rendering protected HTML or mutations.",
    summary: "Server middleware validates Supabase sessions once per request for protected paths.",
  },
  {
    slug: "env-secrets-cloudflare",
    parentSlug: "astro-applications",
    title: "Environment secrets on Cloudflare",
    description: "Store Supabase keys, Stripe secrets, and feed defaults in Cloudflare dashboard vars, not in the git tree.",
    summary: "Wrangler secrets and encrypted vars keep production keys off laptops and out of logs.",
  },
  {
    slug: "tailwind-v4-setup",
    parentSlug: "astro-applications",
    title: "Tailwind CSS v4 setup in Astro",
    description: "How utility-first styling integrates with this Astro build, theme tokens, and component classes like text-link.",
    summary: "Tailwind v4 CSS-first config keeps about prose and dashboard cards consistent.",
  },
  {
    slug: "websocket-live-updates",
    parentSlug: "nextjs-node-applications",
    title: "WebSocket live updates in monitoring UIs",
    description: "When push-based probe updates beat SSR polling for dashboard freshness, and what this Astro site does instead.",
    summary: "WebSockets shine for sub-minute live tiles; HTTP caching fits public home page scale.",
  },
  {
    slug: "hosting-cost-comparison",
    parentSlug: "nextjs-node-applications",
    title: "Hosting cost comparison for monitoring stacks",
    description: "Rough monthly costs for Cloudflare Astro, Vercel Next.js, VPS Node, and home relay power for a hobby space-monitoring stack.",
    summary: "Edge static-first hosting plus a tiny home relay often beats always-on VPS for hobby monitoring.",
  },
  {
    slug: "weather-api-parallel-path",
    parentSlug: "data-flow",
    title: "Weather API parallel data path",
    description: "Fetch outdoor forecast and conditions alongside probe JSON for context on the home page or CSV merges.",
    summary: "External weather data explains garage swings driven by outdoor humidity and wind, not just door events.",
  },
  {
    slug: "cookie-session-lifecycle",
    parentSlug: "data-flow",
    title: "Cookie and session lifecycle",
    description: "How Supabase auth cookies are set, refreshed, and cleared, and why signed-out home loads skip history inserts.",
    summary: "Session cookies tie browser identity to Supabase rows for feeds and saved history.",
  },
  {
    slug: "caching-feed-responses",
    parentSlug: "data-flow",
    title: "Caching feed responses end to end",
    description: "Where Redis, CDN, and in-memory caches sit between Arduino JSON and the browser, and TTL tuning per layer.",
    summary: "Multiple cache layers prevent hammering home uplink while keeping readings fresh enough.",
  },
  {
    slug: "group-membership-model",
    parentSlug: "accounts-and-dashboard",
    title: "Group membership model",
    description: "See how default, member, and admin groups in Supabase gate CSV export, operator tools, and plan feature flags without hard-coding emails.",
    summary: "Groups encode subscription and operator roles without hard-coding emails in source.",
  },
  {
    slug: "contact-form-admin-review",
    parentSlug: "accounts-and-dashboard",
    title: "Contact form admin review",
    description: "How admin users triage contact submissions, mark handled states, and avoid spam in the operator inbox.",
    summary: "Contact submissions land in a review queue gated by admin group membership.",
  },
  {
    slug: "display-preferences-deep-dive",
    parentSlug: "accounts-and-dashboard",
    title: "Display preferences deep dive",
    description: "Choose Fahrenheit or Celsius defaults, stat card ordering, and per-feed visibility on the signed-in home experience.",
    summary: "Display prefs persist per account so shared JSON feeds render in your preferred units.",
  },
  {
    slug: "kit-qr-onboarding",
    parentSlug: "ingest-and-webhooks",
    title: "Kit QR onboarding",
    description:
      "Sticker a QR code on your probe enclosure encoding the ingest URL for one-scan ThermalTrace device setup without typing long keys.",
    summary:
      "Encode the ingest URL on a label so new hardware setup is a single phone scan.",
  },
  {
    slug: "esp32-freeze-kit",
    parentSlug: "adding-devices",
    title: "ESP32 freeze kit parts list",
    description:
      "Buy an ESP32 and waterproof DS18B20 that match ThermalTrace’s push-ingest sketches. Adafruit and Amazon product pages, not a branded drop-ship kit.",
    summary:
      "Verified ESP32 + waterproof DS18B20 BOM with stable Adafruit product links and Amazon /dp/ alternatives.",
  },
  {
    slug: "esp32-ota-firmware",
    parentSlug: "ingest-and-webhooks",
    title: "ESP32 OTA and battery reporting",
    description:
      "Keep ESP32 probe firmware current with LAN OTA while push ingest posts battery and RSSI fields to the ThermalTrace HTTP API.",
    summary:
      "Keep ESP32 firmware current on your LAN while telemetry posts to the ingest API.",
  },
  {
    slug: "esp32-web-flash",
    parentSlug: "adding-devices",
    title: "ESP32 flashing options",
    description:
      "Flash ThermalTrace ESP32 probes with Arduino IDE, PlatformIO, MicroPython, or Espressif’s web esptool, after downloading a pre-filled sketch from Devices.",
    summary:
      "No hosted one-click binary flasher: download a personalized sketch, then flash with IDE, PlatformIO, or esptool-js.",
  },
  {
    slug: "pico-w-ingest",
    parentSlug: "adding-devices",
    title: "Raspberry Pi Pico W ingest",
    description:
      "Push DS18B20 readings from a Pico W or Pico 2 W using CircuitPython, MicroPython, or the Arduino-Pico core. Same ThermalTrace HTTPS ingest as ESP32.",
    summary:
      "RP2040 / RP2350 Wi‑Fi probes: CircuitPython code.py, MicroPython, or Earle Philhower Arduino, DS18B20 on GP4.",
  },
  {
    slug: "stm32-zephyr-ingest",
    parentSlug: "adding-devices",
    title: "STM32 Zephyr ingest",
    description:
      "Push DS18B20 readings from a Nucleo-F767ZI using Zephyr C and onboard Ethernet. west, ST-LINK, and the same LAN HTTPS relay as the Uno.",
    summary:
      "Cortex-M7 Ethernet probe: Zephyr C on Nucleo-F767ZI, DS18B20 on Arduino D4, HTTP to a LAN TLS relay.",
  },
  {
    slug: "ch32v-riscv-ingest",
    parentSlug: "adding-devices",
    title: "CH32V RISC-V ingest",
    description:
      "Push DS18B20 readings from a WCH CH32V307 using WCHNET C and onboard Ethernet. MounRiver Studio and the same LAN HTTPS relay as the Uno.",
    summary:
      "RISC-V Ethernet probe: WCHNET C on CH32V307, DS18B20 on PB12, HTTP to a LAN TLS relay.",
  },
  {
    slug: "avr-asm-ingest",
    parentSlug: "adding-devices",
    title: "AVR assembly ingest",
    description:
      "Push DS18B20 readings from an ATmega328P in GNU AVR assembly with a W5100 shield. avr-gcc, avrdude, and the same LAN HTTPS relay as the Uno.",
    summary:
      "Uno + W5100 in GNU AVR assembly: DS18B20 on D7, HTTP to a LAN TLS relay, not Arduino C.",
  },
  {
    slug: "cellular-ingest",
    parentSlug: "adding-devices",
    title: "Cellular ingest (Particle Boron)",
    description:
      "Push DS18B20 readings from a Particle Boron over LTE via a Console webhook. For remote sites without garage Wi-Fi.",
    summary:
      "LTE freeze probe: Particle Boron + DS18B20 on D2, Particle webhook to HTTPS ingest.",
  },
  {
    slug: "pic18-ethernet-ingest",
    parentSlug: "adding-devices",
    title: "PIC18F67J60 Ethernet ingest",
    description:
      "Push DS18B20 readings from a PIC18F67J60 using Microchip’s TCP/IP Stack in MPLAB X and the same LAN HTTPS relay as the Uno.",
    summary:
      "Microchip Ethernet probe: MLA C on PIC18F67J60, DS18B20 on RD0, HTTP to a LAN TLS relay.",
  },
  {
    slug: "teensy41-ingest",
    parentSlug: "adding-devices",
    title: "Teensy 4.1 Ethernet ingest",
    description:
      "Push DS18B20 readings from a Teensy 4.1 with QNEthernet. Fast i.MX RT1062 garage probe using the same LAN HTTPS relay as the Uno.",
    summary:
      "Teensy 4.1 + QNEthernet: DS18B20 on pin 4, HTTP to a LAN TLS relay.",
  },
  {
    slug: "zapier-make-recipes",
    parentSlug: "ingest-and-webhooks",
    title: "Zapier and Make.com recipes",
    description:
      "Connect ThermalTrace outbound alert webhooks and inbound snooze actions to Zapier or Make.com for no-code freeze, leak, and vacation automations.",
    summary:
      "Route alerts to Zapier/Make and pause notifications from other smart-home flows.",
  },
  {
    slug: "cold-snap-playbook",
    parentSlug: "accounts-and-dashboard",
    title: "Cold-snap alert playbook",
    description:
      "What to do before, during, and after a freeze alert: thresholds, quiet hours, acknowledgement, and escalation.",
    summary:
      "A practical checklist so freeze alerts turn into action instead of noise.",
  },
  {
    slug: "alert-channel-cookbook",
    parentSlug: "accounts-and-dashboard",
    title: "Alert channel cookbook",
    description:
      "Enable email, chat, SMS, push, and webhooks: fill destinations, test delivery, and escalate when unacked.",
    summary:
      "Pick channels that match how your household actually wakes up for cold snaps.",
  },
  {
    slug: "household-sharing-walkthrough",
    parentSlug: "accounts-and-dashboard",
    title: "Household sharing walkthrough",
    description:
      "Invite family by email, set editor vs view-only roles, and share one freeze-risk dashboard without handing out a ThermalTrace password.",
    summary:
      "Keep probes and alerts in one household without sharing a password.",
  },
  {
    slug: "probe-demo",
    parentSlug: "temperature-probes",
    title: "Interactive probe demo",
    description:
      "Simulate multi-zone temperatures with freeze threshold, space status, and push/pull JSON like production Devices and Overview.",
    summary:
      "Garage, workshop, attic, or crawlspace: watch freeze and leak risk and ingest JSON update live.",
  },
  {
    slug: "esphome-shelly-recipes",
    parentSlug: "ingest-and-webhooks",
    title: "ESPHome and Shelly recipes",
    description:
      "Post temperature, humidity, and door contact readings from ESPHome or Shelly firmware to ThermalTrace push ingest without custom Arduino sketches.",
    summary:
      "Copy-paste HTTP POST recipes for common LAN sensors: dual-run with Home Assistant MQTT.",
  },
  {
    slug: "garage-door-cold-playbook",
    parentSlug: "accounts-and-dashboard",
    title: "Garage door + cold alert playbook",
    description:
      "Alert when a bay door stays open while temperatures drop: door contact ingest, combined alert rules, and household response steps.",
    summary:
      "Stop heat loss and freeze risk when a garage door is left open on a cold night.",
  },
  {
    slug: "home-assistant-notify-recipes",
    parentSlug: "ingest-and-webhooks",
    title: "Home Assistant notify recipes",
    description:
      "Route ThermalTrace freeze and leak alerts into Home Assistant notify, TTS, and mobile push: outbound webhooks, HACS services, and inbound snooze.",
    summary:
      "Local voice and phone notify when freeze or leak risk hits: dual-run with ThermalTrace email/SMS.",
  },
  {
    slug: "personal-weather-stations",
    parentSlug: "accounts-and-dashboard",
    title: "Personal weather stations (Ambient & WeatherFlow)",
    description:
      "Use a backyard Ambient Weather or WeatherFlow Tempest station for outdoor context, NWS alerts, and forecast freeze risk.",
    summary:
      "Point ThermalTrace at the station on your property: better yard-level freeze context.",
  },
  {
    slug: "freeze-thaw-flood-playbook",
    parentSlug: "accounts-and-dashboard",
    title: "Freeze → thaw flood playbook",
    description:
      "Place wet contacts for pipe-thaw floods: how auto flood alerts work, why vacation mode still fires, and what to do when a pad goes wet.",
    summary:
      "Companion to cold-snap: catch melt and drip floods under water heaters, laundry, and sumps while freeze season ends.",
  },
  {
    slug: "time-to-freeze",
    parentSlug: "accounts-and-dashboard",
    title: "Time-to-freeze explained",
    description:
      "Threshold alerts vs remaining-hours freeze runway vs Member outdoor forecast vs Pro NWS: what the lag model uses and how to enable time-to-freeze in Alerts.",
    summary:
      "Understand the hours-until-freeze clock so you act before the probe crosses your freeze threshold.",
  },
];
