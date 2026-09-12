import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { BOM, amazonDp, amazonSearch } from "./bomLinks";

describe("bomLinks", () => {
  const env = import.meta.env as Record<string, string | undefined>;
  let prevAmazon: string | undefined;

  beforeEach(() => {
    prevAmazon = env.PUBLIC_AMAZON_ASSOCIATE_TAG;
    env.PUBLIC_AMAZON_ASSOCIATE_TAG = "thermaltraced-20";
  });

  afterEach(() => {
    if (prevAmazon == null) delete env.PUBLIC_AMAZON_ASSOCIATE_TAG;
    else env.PUBLIC_AMAZON_ASSOCIATE_TAG = prevAmazon;
    vi.unstubAllGlobals();
  });

  it("builds tagged Amazon product and search URLs", () => {
    expect(amazonDp("B07V2KS43L")).toContain("/dp/B07V2KS43L");
    expect(amazonDp("B07V2KS43L")).toContain("tag=thermaltraced-20");
    expect(amazonSearch("waterproof DS18B20")).toContain("/s?k=waterproof+DS18B20");
    expect(amazonSearch("waterproof DS18B20")).toContain("tag=thermaltraced-20");
  });

  it("leaves Adafruit URLs untagged", () => {
    expect(BOM.adafruitDs18b20).toBe("https://www.adafruit.com/product/381");
  });

  it("exposes shared DS18B20 and resistor product links", () => {
    expect(BOM.amazonDs18b20).toContain("/dp/B07V2KS43L");
    expect(BOM.amazonResistor4k7).toContain("/dp/B08QRZRRGB");
    expect(BOM.amazonEsp32DevKit).toContain("/dp/B08D5ZD528");
  });
});
