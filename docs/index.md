---
layout: home
title: ThermalTrace Docs
hero:
  name: ThermalTrace
  text: Developer documentation
  tagline: Push ingest, HTTP API, sensor sketches, deploy notes, and integrations for the open-source environmental monitoring dashboard.
  image:
    src: https://thermaltrace.dev/og-dashboard.jpg
    alt: ThermalTrace live telemetry graph with humidity and dew point
  actions:
    - theme: brand
      text: Push ingest
      link: /ingest/
    - theme: alt
      text: OpenAPI / API
      link: /api/
    - theme: alt
      text: Live app
      link: https://thermaltrace.dev
features:
  - title: Push ingest
    details: POST JSON from ESP32, Pico W, STM32, CH32V, AVR assembly, Teensy 4.1, PIC18, Particle Boron, Arduino, CircuitPython, or MicroPython. Sensors auto-import on first POST; Reveal ingest key when the operator vault is enabled.
    link: /ingest/
    linkText: Ingest reference
  - title: Pull feeds
    details: HTTPS JSON we fetch on a schedule — Devices Pull tab, Save pull setup, probe auto-discovery.
    link: /ingest/pull-feeds
    linkText: Pull setup
  - title: Sensor sketches
    details: Drop-in samples for DS18B20, MAX31855, and MAX6675 — Arduino, MicroPython, CircuitPython, Zephyr C, WCHNET C, and GNU AVR assembly — already in this repo.
    link: /sketches/
    linkText: Browse sketches
  - title: Home Assistant (HACS)
    details: Official custom integration — share-link sensors, snooze/vacation services, MQTT bridge recipes.
    link: https://thermaltrace.dev/integrations/home-assistant
    linkText: HACS integration
  - title: Matter / Apple Home
    details: Matterbridge plugin — share-link sensors in Apple Home, Google Home, and Alexa (not CSA-certified; LAN host).
    link: https://thermaltrace.dev/integrations/matter
    linkText: Matter bridge
  - title: Node-RED & Influx
    details: MQTT→HTTPS flow JSON and Telegraf scrape into InfluxDB / VictoriaMetrics from Pro Prometheus metrics.
    link: https://thermaltrace.dev/integrations/node-red
    linkText: Node-RED
  - title: Integrations hub
    details: Home Assistant, Matter, SmartThings path, Node-RED, Influx, MQTT, Grafana, webhooks, Nest/Ecobee, Zapier, IFTTT/n8n — entry points on the product site.
    link: https://thermaltrace.dev/integrations
    linkText: All integrations
  - title: Alert webhooks
    details: Pro outbound webhooks with optional HMAC, plus Home Assistant blueprint and Zapier/Make hooks.
    link: /integrations/webhooks
    linkText: Webhook payloads
  - title: Metrics & Grafana
    details: Prometheus scrape endpoint with Bearer API keys and a bundled Grafana dashboard JSON.
    link: /integrations/grafana
    linkText: Grafana setup
  - title: Architecture
    details: Astro SSR on Cloudflare Workers, Supabase, households, cron alerts, Overview Insights, and forecast-backed time-to-freeze.
    link: /guide/architecture
    linkText: How it fits together
  - title: Product guides
    details: Long-form wiring, freeze playbooks, and journeys live on the app site Guides hub (and all articles).
    link: https://thermaltrace.dev/guides
    linkText: thermaltrace.dev/guides
---

## Where to go

| Goal | Start here |
|------|------------|
| Add a push or pull device (UI) | [Adding devices](https://thermaltrace.dev/about/adding-devices) |
| Wire an ESP and see live temps | [Push ingest](/ingest/) → [Sketches](/sketches/) |
| Pull HTTPS JSON instead | [Pull feeds](/ingest/pull-feeds) |
| Automate on freeze alerts | [Home Assistant (HACS)](/integrations/home-assistant) · [Alert webhooks](/integrations/webhooks) |
| Keep Mosquitto / dual-run MQTT | [MQTT bridge](/integrations/mqtt-bridge) |
| ESPHome or Shelly on the LAN | [ESPHome & Shelly](/integrations/esphome-shelly) |
| Backyard weather station | [Ambient & WeatherFlow](/integrations/personal-weather-stations) |
| Scrape metrics | [Grafana / Prometheus](/integrations/grafana) |
| Run the app locally | [Local development](/guide/local-dev) |
| Deploy or check production | [Deploy & ops](/guide/deploy) |
| Read product / DIY guides | [About hub](https://thermaltrace.dev/about) |

::: tip Repo links
Source: [github.com/doodersrage/thermaltrace](https://github.com/doodersrage/thermaltrace) ·  
This docs site: [doodersrage.github.io/thermaltrace](https://doodersrage.github.io/thermaltrace/) ·  
Production app: [thermaltrace.dev](https://thermaltrace.dev)
:::
