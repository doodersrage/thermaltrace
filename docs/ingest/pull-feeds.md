# Pull feeds

If your probe already serves HTTPS JSON (Arduino Ethernet server, FastAPI relay, etc.), use a **pull feed** instead of push ingest.

Product walkthrough (UI steps): [Adding push and pull devices](https://thermaltrace.dev/about/adding-devices).

**No hardware?** On **Overview**, use **Try without hardware** to save the public [example feed](https://thermaltrace.dev/api/feeds/example) in one click.

## Setup

1. Open **[Dashboard → Devices → Pull feeds](https://thermaltrace.dev/dashboard/devices?tab=pull)**
2. Add an HTTPS URL and set **JSON root key** (default `temp`)
3. Click **Test feed URL**, then **Save pull setup** — probe keys auto-import from the live feed
4. Rename labels on the same page, or click **Accept suggested names**
5. Click **Fetch now** for an immediate pull, or wait for the **15-minute** cron and refresh Home while signed in

## Expected shape

Pull feeds expect nested probe objects under the configured root—not flat push keys or `sensors[]`.

```json
{
  "temp": {
    "0": { "c": 18.5, "f": 65.3, "h": 42 },
    "1": { "c": 19.0, "f": 66.2, "h": 40 },
    "avg": { "f": 65.75, "c": 18.75, "h": 41 }
  },
  "battery_pct": 87,
  "rssi": -62
}
```

If probes live under another top-level key (for example `readings`), set **JSON root key** to that name. Optional top-level `battery_pct` / `rssi` (or nested `meta`) update device health.

## Alternate JSON shapes (auto-detected)

If the configured root is missing, ThermalTrace also accepts:

- **SenML JSON** (RFC 8428 array) — probe keys from SenML names; `Cel` / `degF` for temperature, `%RH` for humidity
- **Home Assistant REST** — `{ "state": "65.3", "attributes": { "unit_of_measurement": "°F" } }`

Try the public example: `https://thermaltrace.dev/api/feeds/example?format=senml` or `?format=homeassistant`.

## Relay pattern

When the MCU cannot do TLS:

```
[Probe HTTP] → [local FastAPI / nginx TLS] → [ThermalTrace pull URL]
```

See [python feeds](https://thermaltrace.dev/about/python-feeds) and the [fast-api-relay](https://github.com/doodersrage/fast-api-relay) repo.

## Push vs pull

| | Push | Pull |
|---|------|------|
| Who initiates | Your device | ThermalTrace |
| Firewall | Device needs outbound HTTPS | Feed URL must be publicly reachable |
| Auth | Per-device key in path | HTTPS URL |
| JSON shape | Flat keys, `temp` object, or `sensors[]` | Nested probes under configurable root (default `temp`); SenML or HA REST auto-detected |
| Best for | ESP32 / battery nodes | Always-on LAN servers with a public tunnel or relay |

## Related

- [Push ingest](/ingest/)
- Product: [Adding devices](https://thermaltrace.dev/about/adding-devices) · [Configuring temperature feeds](https://thermaltrace.dev/about/configuring-temperature-feeds)
