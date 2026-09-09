import { describe, expect, it } from "vitest";
import {
  HUMIDITY_OFFSET_MAX,
  TEMP_OFFSET_MAX_F,
  applySensorOffset,
  clampSensorOffset,
  parseOffsetFormValue,
} from "./sensorCalibration";

describe("clampSensorOffset", () => {
  it("returns 0 for a non-finite offset", () => {
    expect(clampSensorOffset(Number.NaN, "temperature")).toBe(0);
    expect(clampSensorOffset(Number.POSITIVE_INFINITY, "temperature")).toBe(0);
  });

  it("clamps a temperature offset to +/-10F", () => {
    expect(clampSensorOffset(50, "temperature")).toBe(TEMP_OFFSET_MAX_F);
    expect(clampSensorOffset(-50, "temperature")).toBe(-TEMP_OFFSET_MAX_F);
    expect(clampSensorOffset(3, "temperature")).toBe(3);
  });

  it("clamps a humidity offset to +/-15", () => {
    expect(clampSensorOffset(50, "humidity")).toBe(HUMIDITY_OFFSET_MAX);
    expect(clampSensorOffset(-50, "humidity")).toBe(-HUMIDITY_OFFSET_MAX);
  });

  it("defaults to a +/-10 clamp for an unrecognized kind", () => {
    expect(clampSensorOffset(50, "pressure")).toBe(10);
    expect(clampSensorOffset(-50, "pressure")).toBe(-10);
  });
});

describe("applySensorOffset", () => {
  it("returns the value unchanged when it isn't finite", () => {
    expect(applySensorOffset(Number.NaN, 5)).toBeNaN();
  });

  it("adds the offset to the value", () => {
    expect(applySensorOffset(70, 2.5)).toBe(72.5);
  });

  it("treats a null, undefined, or non-finite offset as 0", () => {
    expect(applySensorOffset(70, null)).toBe(70);
    expect(applySensorOffset(70, undefined)).toBe(70);
    expect(applySensorOffset(70, Number.NaN)).toBe(70);
  });
});

describe("parseOffsetFormValue", () => {
  it("returns 0 for null or blank input", () => {
    expect(parseOffsetFormValue(null)).toBe(0);
    expect(parseOffsetFormValue("   ")).toBe(0);
  });

  it("parses a valid numeric string", () => {
    expect(parseOffsetFormValue("2.5")).toBe(2.5);
    expect(parseOffsetFormValue("-3")).toBe(-3);
  });

  it("returns 0 for a non-numeric string", () => {
    expect(parseOffsetFormValue("abc")).toBe(0);
  });

  it("handles a File value by returning 0 (never numeric)", () => {
    const file = new File(["x"], "x.txt");
    expect(parseOffsetFormValue(file)).toBe(0);
  });
});
