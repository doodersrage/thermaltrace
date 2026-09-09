import { describe, expect, it } from "vitest";
import { getHouseholdErrorMessage } from "./householdErrors";

describe("getHouseholdErrorMessage", () => {
  it("returns null for a null or empty code", () => {
    expect(getHouseholdErrorMessage(null)).toBeNull();
    expect(getHouseholdErrorMessage("")).toBeNull();
  });

  it("returns the mapped message for a known code", () => {
    expect(getHouseholdErrorMessage("expired")).toBe("This invite has expired. Ask for a new one.");
  });

  it("maps the legacy numeric '1' code to a generic action-failed message", () => {
    expect(getHouseholdErrorMessage("1")).toBe(
      "Could not complete that household action. Please try again.",
    );
  });

  it("humanizes an unknown but safe code by replacing underscores with spaces", () => {
    expect(getHouseholdErrorMessage("some_unknown_code")).toBe("some unknown code");
  });

  it("falls back to the generic message for an overly long code", () => {
    expect(getHouseholdErrorMessage("x".repeat(200))).toBe(
      "Could not complete that household action. Please try again.",
    );
  });

  it("falls back to the generic message for a code containing '<'", () => {
    expect(getHouseholdErrorMessage("<script>")).toBe(
      "Could not complete that household action. Please try again.",
    );
  });
});
