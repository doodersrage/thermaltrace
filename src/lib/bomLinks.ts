/**
 * Shared Adafruit / Amazon / McMaster BOM buy links for kit and ingest pages.
 * Prefer Adafruit, manufacturer, and Amazon /dp/{ASIN} product pages.
 * Do not put Amazon /s?k= search URLs on public pages — Amazon 503s crawlers
 * and Ahrefs reports those as External 5XX.
 */

import { affiliateHref } from "./affiliateLinks";

/** Amazon product detail page (Associates-friendly). */
export function amazonDp(asin: string): string {
  return affiliateHref(`https://www.amazon.com/dp/${asin}`);
}

/** Amazon keyword search. Keep off public HTML; crawlers typically get 503. */
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
  adafruitDiffuser: affiliateHref("https://www.adafruit.com/product/4749"),
  adafruitFoamTape: affiliateHref("https://www.adafruit.com/product/5019"),
  pjrcTeensy41: affiliateHref("https://www.pjrc.com/store/teensy41.html"),
  pjrcEthKit: affiliateHref("https://www.pjrc.com/store/ethernet_kit.html"),

  // Hardware-store commodities (stable catalog pages, not Amazon search)
  mcmasterUvZipTies: affiliateHref("https://www.mcmaster.com/7130K32/"),
  mcmasterCableTieMounts: affiliateHref(
    "https://www.mcmaster.com/products/cable-tie-mounts/",
  ),

  // Amazon product pages (verified live; re-check if a listing vanishes)
  amazonDs18b20: amazonDp("B07V2KS43L"), // uxcell waterproof DS18B20 1m
  amazonEsp32DevKit: amazonDp("B08D5ZD528"),
  amazonRp2040Zero: amazonDp("B09MJN9XJN"),
  amazonResistor4k7: amazonDp("B08QRZRRGB"), // Chanzon 4.7kΩ 1/4W pack
  amazonUno: amazonDp("B008GRTSV6"),
  amazonEthShield: amazonDp("B00E5WJDXC"),
  amazonNeopixelStick: amazonDp("B01DC0IOCK"),
} as const;
