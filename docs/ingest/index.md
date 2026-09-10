# Push ingest

Create a **push** device under **[Dashboard → Devices](https://thermaltrace.dev/dashboard/devices)** on the live app. You receive a per-device ingest key in a **30-minute callout** (survives refresh until dismissed). **Lost it later?** Use **Reveal ingest key** on the device card when key recovery is enabled on the server, or **Rotate key** for a new one.

Full UI walkthrough (push **and** pull): [Adding push and pull devices](https://thermaltrace.dev/about/adding-devices).

```http
POST https://thermaltrace.dev/api/ingest/<device-key>
Content-Type: application/json
```

Optional top-level health fields (any payload style):

| Field | Meaning |
|-------|---------|
| `battery` / `battery_pct` | Battery percent (0–100) |
| `rssi` | Wi-Fi / radio RSSI (dBm) |

## Sensors auto-import on first POST

Sensor keys import automatically from your JSON (flat keys, classic `temp` object, typed `sensors[]`, SenML, or Home Assistant REST). Rename labels on the Devices page afterward. Manual mapping under **Advanced** is optional if you want to pre-map keys before the first POST.

After the first successful POST, open **[Home](https://thermaltrace.dev/)** while signed in to confirm live values. History collects from the **15-minute** background poll and successful ingests.

**No hardware yet?** On **Overview**, use **Try without hardware** to save the public example pull feed in one click.

## Home Assistant

REST sensors, MQTT bridge, and inbound webhook examples: [Home Assistant integration](/ingest/home-assistant).

**Product page:** [thermaltrace.dev/integrations/home-assistant](https://thermaltrace.dev/integrations/home-assistant) · **HACS:** [github.com/doodersrage/thermaltrace-home-assistant](https://github.com/doodersrage/thermaltrace-home-assistant)

## curl smoke test

```bash
curl -X POST "https://thermaltrace.dev/api/ingest/YOUR_DEVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"temp1": 42.5, "door1": false, "battery": 87, "rssi": -62}'
```

Expect HTTP `200` when the key is valid. Keys `temp1` / `door1` appear as sensors after the first POST; rename labels on Devices if needed.

## Payload styles

### Flat keys

Simplest for ESP32 / Pico W sketches. Keys become sensor IDs on first POST.

```json
{
  "temp1": 42.5,
  "humidity1": 41,
  "door1": true,
  "rssi": -62
}
```

### Classic Arduino `temp` object

Matches the Ethernet garage firmware JSON shape. Sample sketch:
[`ethernet_dht22_ingest`](https://github.com/doodersrage/thermaltrace/tree/main/sketches/arduino/ethernet_dht22_ingest)
(Uno + W5100; HTTP only — use [`push_https_forward.py`](https://github.com/doodersrage/thermaltrace/blob/main/sketches/relay/push_https_forward.py) on a LAN host for TLS).

```json
{
  "temp": {
    "0": { "c": 18.5, "f": 65.3, "h": 42 },
    "1": { "c": 19.0, "f": 66.2, "h": 40 },
    "avg": { "f": 37.5, "c": 3.1, "h": 42.2 }
  },
  "battery": 87,
  "rssi": -62
}
```

### Typed `sensors[]`

```json
{
  "sensors": [
    { "key": "garage_temp", "kind": "temperature", "value": 65.3, "unit": "F" },
    { "key": "garage_rh", "kind": "humidity", "value": 42, "unit": "%" },
    { "key": "door1", "kind": "door", "bool": true },
    { "key": "co2", "kind": "co2", "value": 820, "unit": "ppm" },
    { "key": "pm25", "kind": "pm25", "value": 12, "unit": "µg/m³" },
    { "key": "sump", "kind": "level", "value": 22, "unit": "%" }
  ],
  "battery": 87,
  "rssi": -62
}
```

Supported `kind` values: `temperature`, `humidity`, `co2`, `pressure`, `pm25`, `voc`, `level`, `energy`, `door`, `power`, `flood`, `motion`, `generic`.

### SenML (RFC 8428)

SenML JSON arrays are auto-detected when native shapes are absent. Temperature uses unit `Cel` or `degF`; humidity uses `%RH`. Probe keys come from the SenML name (last path segment).

```json
[
  { "bn": "thermaltrace/garage/", "n": "0", "u": "Cel", "v": 18.5 },
  { "n": "0", "u": "%RH", "v": 42 },
  { "n": "door", "vb": true }
]
```

Example feed: `https://thermaltrace.dev/api/feeds/example?format=senml`

### Home Assistant REST sensor

Single-entity REST responses (`state` + `attributes.unit_of_measurement`) are also auto-detected:

```json
{
  "state": "65.3",
  "attributes": {
    "unit_of_measurement": "°F",
    "friendly_name": "Garage temperature"
  }
}
```

Example feed: `https://thermaltrace.dev/api/feeds/example?format=homeassistant`

## MQTT-over-HTTP bridge

Cloudflare Workers are not an MQTT broker. Keep Mosquitto / Home Assistant MQTT on your LAN and mirror readings with:

```http
POST https://thermaltrace.dev/api/ingest/mqtt
X-Ingest-Key: <device-key>
Content-Type: application/json
```

Body may include `topic`, `payload` (JSON string), or `message` (object). The Worker unwraps and forwards into the same ingest path.

Recipes (Home Assistant + Node-RED import): [MQTT bridge](/integrations/mqtt-bridge). Product page: [Adding devices § MQTT](https://thermaltrace.dev/about/adding-devices#mqtt-bridge).

## Common mistakes

| Symptom | Check |
|---------|--------|
| `401` | Wrong or rotated device key |
| Readings missing on Home | First POST not received yet, or device disabled |
| No history | Need successful ingest **and** 15-minute poll / signed-in Home |
| TLS failures on MCU | Use a local HTTPS relay ([python feeds](https://thermaltrace.dev/about/python-feeds)). Uno + W5100: [`ethernet_dht22_ingest`](https://github.com/doodersrage/thermaltrace/tree/main/sketches/arduino/ethernet_dht22_ingest) + [`push_https_forward.py`](https://github.com/doodersrage/thermaltrace/blob/main/sketches/relay/push_https_forward.py) |
| Can't recover key | Operator must set `INGEST_KEY_ENCRYPTION_SECRET`; older devices need one **Rotate key** |

## Related

- [Sensor sketches](/sketches/)
- [Pull feeds](/ingest/pull-feeds) (alternative to push)
- [Home Assistant](/ingest/home-assistant)
- Product: [Adding devices](https://thermaltrace.dev/about/adding-devices) · [ingest & webhooks](https://thermaltrace.dev/about/ingest-and-webhooks) · [Pico W](https://thermaltrace.dev/about/pico-w-ingest) · [STM32 Zephyr](https://thermaltrace.dev/about/stm32-zephyr-ingest) · [CH32V RISC-V](https://thermaltrace.dev/about/ch32v-riscv-ingest) · [AVR assembly](https://thermaltrace.dev/about/avr-asm-ingest) · [Teensy 4.1](https://thermaltrace.dev/about/teensy41-ingest) · [PIC18 Ethernet](https://thermaltrace.dev/about/pic18-ethernet-ingest) · [Cellular](https://thermaltrace.dev/about/cellular-ingest)
