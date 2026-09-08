# ThermalTrace

Open-source dashboard to **track, log, and analyze sensors in garages, workshops, attics, crawlspaces, and shops** — **Astro 6**, **Cloudflare Workers**, **Supabase**, and **Stripe**.

Runs in production at [thermaltrace.dev](https://thermaltrace.dev) with 15-minute history polling, CI, Playwright smoke, and `pnpm ops:smoke`.

[![App](https://img.shields.io/badge/app-thermaltrace.dev-f97316)](https://thermaltrace.dev)
[![Live demo](https://img.shields.io/badge/demo-no%20account-0ea5e9)](https://thermaltrace.dev/demo)
[![Start free](https://img.shields.io/badge/start-free%20(no%20card)-22c55e)](https://thermaltrace.dev/register?next=/dashboard/temperature)
[![Docs](https://img.shields.io/badge/docs-GitHub%20Pages-0ea5e9)](https://doodersrage.github.io/thermaltrace/)
[![CI](https://github.com/doodersrage/thermaltrace/actions/workflows/ci.yml/badge.svg)](https://github.com/doodersrage/thermaltrace/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-slategray)](./LICENSE)

| | |
|---|---|
| **App** | [thermaltrace.dev](https://thermaltrace.dev) |
| **Live demo** | [thermaltrace.dev/demo](https://thermaltrace.dev/demo) — no account |
| **Start free** | [Create account → Devices](https://thermaltrace.dev/register?next=/dashboard/temperature) — no credit card |
| **Developer docs** | [doodersrage.github.io/thermaltrace](https://doodersrage.github.io/thermaltrace/) |
| **Product guides** | [thermaltrace.dev/guides](https://thermaltrace.dev/guides) |
| **OpenAPI** | [thermaltrace.dev/openapi.yaml](https://thermaltrace.dev/openapi.yaml) |
| **Contributing** | [CONTRIBUTING.md](./CONTRIBUTING.md) |

> GitHub **About → Website** points at the live app. Architecture, env vars, cron, and deploy live in the **developer docs**.

---

## What it does

ThermalTrace connects probes in a garage, workshop, attic, or similar space, compares them with outdoor weather, keeps history you can chart and export, and alerts you when something goes wrong — freeze risk, a wet leak sensor, humidity spikes, silent feeds, or a custom rule you define.

**Pull** HTTPS JSON from a local probe server, or **push** from ESP/Arduino to a per-device ingest URL. Households share devices, invite family (including read-only viewers), and publish a free family live share link — Pro adds expanded share scopes, metrics API keys, and automation webhooks.

## Features

- **Live readings** — temperature, humidity, air quality, doors, leaks, power, energy, motion
- **Overview** — Simple or Insights mode: 7-day probe curves with optional humidity/dew overlays, freeze hours and degree-hours, indoor−outdoor ΔT, probe spread, condensation risk, feed health, plus Insights cards for doors, power, motion, battery/RSSI, and air quality
- **Alerts** — freeze and leak alerts on every plan, plus a forecast-backed time-to-freeze clock that can warn on remaining hours before the probe crosses threshold; custom rules for doors, power, air quality, and more; email and chat-style channels (SMS, push, webhooks on Pro)
- **History** — charts, YoY overlay (local probe data, or outdoor Open-Meteo estimate when prior-year probes are missing), Member/Pro CSV export; Pro claims evidence pack
- **Hardware** — push ingest or pull JSON; sketches in [`sketches/`](./sketches)
- **Households** — invites, viewers, multi-property / Portfolio for landlords; free family live share link; Pro expands share scopes and status pages

Plans and limits: [thermaltrace.dev/pricing](https://thermaltrace.dev/pricing) · comparison: [thermaltrace.dev/compare](https://thermaltrace.dev/compare)

## Stack

Astro 6 + Preact islands + Tailwind v4 · Cloudflare Workers · Supabase (Auth, Postgres, RLS) · Stripe · Cloudflare Email · Twilio SMS (Pro) · Web Push (Pro). **Node.js `>=22.12.0`** and **pnpm**.

## Quick start

```bash
pnpm install
cp .env.example .env   # fill in values — see developer docs
pnpm dev               # http://localhost:4321
pnpm test
pnpm typecheck
```

More: [Local development](https://doodersrage.github.io/thermaltrace/guide/local-dev) · [Deploy & ops](https://doodersrage.github.io/thermaltrace/guide/deploy)

```bash
pnpm build && pnpm deploy
pnpm test:e2e
pnpm audit:stripe      # display prices vs live Stripe
pnpm ops:smoke         # public smoke + sitemap ping
```

## Project layout

```
src/pages/          Routes; API under pages/api/
src/lib/            Auth, devices, alerts, Stripe, ingest
src/worker.ts       Cloudflare fetch + scheduled jobs (15-min poll)
src/actions/        Astro Actions (prefs, alerts, invites)
supabase/migrations/
sketches/           Arduino / MicroPython / CircuitPython / Zephyr / WCHNET / AVR assembly ingest samples
docs/               VitePress developer docs (GitHub Pages)
```

## Connecting hardware

1. **[Create a free account](https://thermaltrace.dev/register?next=/dashboard/temperature)** (no credit card)  
2. **Dashboard → Devices** → create a push device and copy the ingest key from the callout  
3. `POST` to `/api/ingest/<key>` — sensor keys **auto-import** on first POST; rename on Devices afterward  
4. **Overview → Try without hardware** saves the demo pull feed if you have no ESP or Pico yet  

Step-by-step: [Adding devices](https://thermaltrace.dev/about/adding-devices) · [ESP32 freeze kit BOM](https://thermaltrace.dev/about/esp32-freeze-kit) · [Accessories](https://thermaltrace.dev/accessories) · [Pico W ingest](https://thermaltrace.dev/about/pico-w-ingest) · [STM32 Zephyr](https://thermaltrace.dev/about/stm32-zephyr-ingest) · [CH32V RISC-V](https://thermaltrace.dev/about/ch32v-riscv-ingest) · [AVR assembly](https://thermaltrace.dev/about/avr-asm-ingest) · [Teensy 4.1](https://thermaltrace.dev/about/teensy41-ingest) · [PIC18 Ethernet](https://thermaltrace.dev/about/pic18-ethernet-ingest) · [Cellular](https://thermaltrace.dev/about/cellular-ingest) · sample sketches in [`sketches/`](./sketches)

Pull feeds (HTTPS JSON we fetch): **Devices → Pull feeds** tab — add URL, **Save pull setup**, probes auto-import from the live feed.

**Integrations:** [Home Assistant (HACS)](https://thermaltrace.dev/integrations/home-assistant) · [Matter / Apple Home](https://thermaltrace.dev/integrations/matter) · [Node-RED](https://thermaltrace.dev/integrations/node-red) · [Influx / Telegraf](https://thermaltrace.dev/integrations/influx) · [IFTTT / n8n](https://thermaltrace.dev/integrations/automation) · [HACS repo](https://github.com/doodersrage/thermaltrace-home-assistant) · [Matterbridge plugin](https://github.com/doodersrage/thermaltrace-matter) · [Developer docs](https://doodersrage.github.io/thermaltrace/)

**Operator launch checklist:** [docs/community/operator-checklist.md](./docs/community/operator-checklist.md) (forum post, thermostat OAuth, HACS default PR status)

```bash
curl -X POST "https://your-domain/api/ingest/YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"door1": true, "temp1": 42.5, "battery": 87, "rssi": -62}'
```

Guides: [Adding devices](https://thermaltrace.dev/about/adding-devices) · [Push ingest](https://doodersrage.github.io/thermaltrace/ingest/) · [Sketches](./sketches) · [Ingest & webhooks](https://thermaltrace.dev/about/ingest-and-webhooks)

Related repos: [arduino JSON probe](https://github.com/doodersrage/arduino-network-json-temperature-sever) · [Python relay](https://github.com/doodersrage/fast-api-relay) · [Home Assistant integration](https://github.com/doodersrage/thermaltrace-home-assistant) · [Matter / Apple Home](https://github.com/doodersrage/thermaltrace-matter) · [ThermalTrace Desktop](https://github.com/doodersrage/thermaltrace-desktop) · [Bay Buddy (mood glance)](https://github.com/doodersrage/thermaltrace-bay-buddy) · [Claim puck (RP2040-Zero)](https://github.com/doodersrage/thermaltrace-claim-puck) · [Android app](https://github.com/doodersrage/thermaltrace-android)

## Contributing

Bugs and feature ideas: [GitHub issues](https://github.com/doodersrage/thermaltrace/issues). Account or billing: [contact form](https://thermaltrace.dev/contact). See [CONTRIBUTING.md](./CONTRIBUTING.md) and the [Code of Conduct](./CODE_OF_CONDUCT.md).

PRs should pass `pnpm test` and `pnpm typecheck`. CI also runs the Astro build and Playwright smoke. An **import-guard** Vitest suite fails the build if a page renders a component it never imports.

## License

[MIT](LICENSE). Contributions and forks welcome.
