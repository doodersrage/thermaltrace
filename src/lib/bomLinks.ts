/**
 * Shared Adafruit / Amazon BOM buy links for kit and ingest pages.
 * Prefer Amazon /dp/{ASIN} product pages for Associates tracking; keep search
 * URLs as fallbacks when ASINs rotate or the part is too niche for a stable listing.
 */

import { affiliateHref } from "./affiliateLinks";

/** Amazon product detail page (Associates-friendly). */
export function amazonDp(asin: string): string {
  return affiliateHref(`https://www.amazon.com/dp/${asin}`);
}

/** Amazon keyword search (fallback when ASINs churn). */
export function amazonSearch(keywords: string): string {
  const k = keywords.trim().replace(/\s+/g, "+");
  return affiliateHref(`https://www.amazon.com/s?k=${k}`);
}

export const BOM = {
  // Adafruit / vendor product pages (primary references)
  adafruitDs18b20: affiliateHref("https://www.adafruit.com/product/381"),
  adafruitDs18b20HighTemp: affiliateHref("https://www.adafruit.com/product/642"),
  adafruitEsp32S3Feather: affiliateHref("https://www.adafruit.com/product/5400"),
  adafruitHuzzah32: affiliateHref("https://www.adafruit.com/product/3591"),
  adafruitUno: affiliateHref("https://www.adafruit.com/product/50"),
  adafruitEthShield: affiliateHref("https://www.adafruit.com/product/201"),
  adafruitPicoW: affiliateHref("https://www.adafruit.com/product/5526"),
  adafruitPico2W: affiliateHref("https://www.adafruit.com/product/6087"),
  adafruitFeatherRp2040Wifi: affiliateHref("https://www.adafruit.com/product/5546"),
  adafruitNeopixelStick: affiliateHref("https://www.adafruit.com/product/1426"),
  adafruitRp2040: affiliateHref("https://www.adafruit.com/product/5698"),
  adafruitReed: affiliateHref("https://www.adafruit.com/product/375"),
  adafruitEsp32: affiliateHref("https://www.adafruit.com/product/3405"),
  adafruitLeak: affiliateHref("https://www.adafruit.com/product/328"),
  adafruitNfc: affiliateHref("https://www.adafruit.com/product/480"),
  adafruitButton: affiliateHref("https://www.adafruit.com/product/1119"),
  pjrcTeensy41: affiliateHref("https://www.pjrc.com/store/teensy41.html"),
  pjrcEthKit: affiliateHref("https://www.pjrc.com/store/ethernet_kit.html"),

  // Amazon product pages (verified live; re-check if a listing vanishes)
  amazonDs18b20: amazonDp("B07V2KS43L"), // uxcell waterproof DS18B20 1m
  amazonEsp32DevKit: amazonDp("B08D5ZD528"),
  amazonPicoW: amazonDp("B0B6FGBYRT"),
  amazonRp2040Zero: amazonDp("B09MJN9XJN"),
  amazonResistor4k7: amazonDp("B08QRZRRGB"), // Chanzon 4.7kΩ 1/4W pack
  amazonTeensy41: amazonDp("B08F5X1J3M"),
  amazonUno: amazonDp("B008GRTSV6"),
  amazonEthShield: amazonDp("B00E5WJDXC"),
  amazonNeopixelStick: amazonDp("B01DC0IOCK"),

  // Amazon searches (niche / commodity / ASIN-unstable)
  amazonDs18b20Search: amazonSearch("waterproof DS18B20 temperature probe 1m"),
  amazonEsp32Search: amazonSearch("ESP32 DevKit C USB-C WiFi"),
  amazonResistor4k7Search: amazonSearch("4.7k ohm resistor through hole"),
  amazonEsp32BundleSearch: amazonSearch("ESP32 DS18B20 waterproof kit"),
  amazonPicoWSearch: amazonSearch("Raspberry Pi Pico W"),
  amazonTeensy41Search: amazonSearch("Teensy 4.1"),
  amazonUnoSearch: amazonSearch("Arduino Uno R3"),
  amazonEthShieldSearch: amazonSearch("W5100 Ethernet shield Arduino"),
  amazonBoronSearch: amazonSearch("Particle Boron LTE"),
  amazonCh32vSearch: amazonSearch("CH32V307V-EVT-R1"),
  amazonPicSearch: amazonSearch("PIC18F67J60 Ethernet"),
  amazonNucleoSearch: amazonSearch("STM32 Nucleo-F767ZI"),
  amazonReedSearch: amazonSearch("magnetic reed switch door"),
  amazonLeakSearch: amazonSearch("water leak sensor probe arduino"),
  amazonZipTiesSearch: amazonSearch("uv resistant zip ties 8 inch"),
  amazonPipeMountSearch: amazonSearch("pipe clamp cable tie mount"),
  amazonVhbSearch: amazonSearch("3M VHB adhesive pads electronics"),
  amazonQrLabelsSearch: amazonSearch("waterproof QR code sticker labels"),
  amazonNtagSearch: amazonSearch("NTAG215 NFC sticker"),
  amazonDiffuserSearch: amazonSearch("LED diffuser sheet acrylic"),
  amazonPowerDetectorSearch: amazonSearch("USB power detector relay module"),
  amazonNeopixelSearch: amazonSearch("WS2812 NeoPixel stick"),
} as const;
