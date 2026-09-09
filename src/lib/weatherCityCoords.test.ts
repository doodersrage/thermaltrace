import { describe, expect, it } from "vitest";
import { WEATHER_CITY_COORDS, getWeatherPresetCoords } from "./weatherCityCoords";

describe("getWeatherPresetCoords", () => {
  it("returns null for a null, undefined, or non-numeric cityId", () => {
    expect(getWeatherPresetCoords(null)).toBeNull();
    expect(getWeatherPresetCoords(undefined)).toBeNull();
    expect(getWeatherPresetCoords("not-a-number")).toBeNull();
    expect(getWeatherPresetCoords("")).toBeNull();
  });

  it("returns null for a numeric id with no preset entry", () => {
    expect(getWeatherPresetCoords("0000000")).toBeNull();
  });

  it("returns the preset coords for a known city id", () => {
    expect(getWeatherPresetCoords("5128581")).toEqual(WEATHER_CITY_COORDS["5128581"]);
  });
});
