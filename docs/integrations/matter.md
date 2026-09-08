# Matter / Apple Home

ThermalTrace ships a **[Matterbridge plugin](https://github.com/doodersrage/thermaltrace-matter)** that polls a family live share link and exposes sensors to Apple Home, Google Home, Alexa, and other Matter controllers.

Product landing page: [thermaltrace.dev/integrations/matter](https://thermaltrace.dev/integrations/matter).

## Important constraints

- **Not CSA-certified.** DIY companion for households that already use ThermalTrace.
- **Runs on a LAN host** (Raspberry Pi, NAS, always-on PC). Matter pairing needs mDNS; this does **not** run on Cloudflare Workers.
- **Not a probe.** ESP/Arduino (or HTTPS feeds) push readings; the plugin only mirrors the share JSON.

## Install

1. Install [Matterbridge](https://matterbridge.io/)
2. Clone `https://github.com/doodersrage/thermaltrace-matter`, `npm install && npm run build`, then `matterbridge --add .`
3. Create a **family live** share link under Dashboard → Share (Free includes one)
4. Paste the token into plugin config (`host` defaults to `https://thermaltrace.dev`)
5. Pair the Matterbridge QR code in Apple Home / Google Home / Alexa

## API contract

| Direction | Endpoint | Notes |
| --- | --- | --- |
| Poll | `GET /api/share/{token}/readings` | Same JSON as HACS |
| Optional snooze | `POST /api/inbound/{token}` with `{"action":"snooze","hours":N}` | Pro; HMAC via `X-ThermalTrace-Signature` |

Poll every 60–3600 seconds (default 120). Share readings allow ~60 req/min.

## Sensor map

| ThermalTrace `kind` | Matter device |
| --- | --- |
| `temperature` | Temperature Sensor (°F → °C hundredths) |
| `humidity` | Humidity Sensor |
| `flood` | Water Leak Detector |
| `door` | Contact Sensor (open inverted to Matter closed semantics) |
| `power` | Contact Sensor |
| `motion` | Occupancy Sensor |

Skipped in v1: energy, level, air quality, time-to-freeze.

## Related

- [Home Assistant (HACS)](/integrations/home-assistant) — same share link, HA entities
- [Webhooks](/integrations/webhooks) — inbound signing details
- Plugin README: [thermaltrace-matter](https://github.com/doodersrage/thermaltrace-matter)
