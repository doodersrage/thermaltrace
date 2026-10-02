# ThermalTrace probe firmware

`thermaltrace-probe/` is the generic firmware behind the browser flasher at
[thermaltrace.dev/flash](https://thermaltrace.dev/flash). Unlike the samples in
[`sketches/`](../sketches/), nothing is compiled in: Wi‑Fi and the device key
are set after flashing.

| | |
|---|---|
| Boards | ESP32, ESP32-S3, ESP32-C3 (one image per chip family) |
| Sensor | DS18B20 on GPIO 4 with a 4.7kΩ pull-up; up to four probes → `temp1`…`temp4` |
| Interval | One POST a minute to `/api/ingest/<device key>` |

## Setup after flashing

- **USB:** the flasher page sends `TTCFG<TAB>ssid<TAB>password<TAB>key` at 115200 baud.
- **Phone:** join the `ThermalTrace-Setup` Wi‑Fi network and fill in the portal.
- **Reset:** hold BOOT for five seconds to erase Wi‑Fi and the key.

Lines the device prints for the flasher page start with `TT ` (`TT wifi ok`,
`TT post 200 probes=1`, `TT key rejected…`).

## Building

```bash
pip install platformio
pnpm firmware:build        # compile, merge, and write public/firmware/
pnpm firmware:build --check  # compile only (what CI runs)
```

The merged images and `manifest.json` in `public/firmware/` are committed so
deploys do not need the ESP32 toolchain. Bump `FIRMWARE_VERSION` in
`src/main.cpp` when behaviour changes, rebuild, and commit the new images.

Test on real hardware before publishing new images: CI only proves they compile.
