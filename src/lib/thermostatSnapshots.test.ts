import { describe, expect, it } from "vitest";
import { isTransientThermostatCollectError } from "./thermostatSnapshots";

describe("isTransientThermostatCollectError", () => {
  it("soft-skips user Nest/Ecobee issues and upstream blips", () => {
    expect(isTransientThermostatCollectError("network")).toBe(true);
    expect(isTransientThermostatCollectError("api_auth")).toBe(true);
    expect(isTransientThermostatCollectError("no_token")).toBe(true);
    expect(isTransientThermostatCollectError("api_error")).toBe(true);
  });

  it("still fails hard on platform config errors", () => {
    expect(isTransientThermostatCollectError("no_project")).toBe(false);
    expect(isTransientThermostatCollectError("sdm_api_disabled")).toBe(false);
    expect(isTransientThermostatCollectError(null)).toBe(false);
  });
});
