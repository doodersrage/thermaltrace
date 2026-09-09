import { describe, expect, it } from "vitest";
import { REGISTER_ERROR_MESSAGES, getRegisterErrorMessage } from "./registerErrors";

describe("getRegisterErrorMessage", () => {
  it("returns null for a null code", () => {
    expect(getRegisterErrorMessage(null)).toBeNull();
  });

  it("returns the mapped message for a known code", () => {
    expect(getRegisterErrorMessage("weak_password")).toBe(REGISTER_ERROR_MESSAGES.weak_password);
  });

  it("passes through a human-readable Supabase message as-is", () => {
    expect(getRegisterErrorMessage("User already registered")).toBe("User already registered");
  });

  it("returns null for an empty string (falsy, same as no code)", () => {
    expect(getRegisterErrorMessage("")).toBeNull();
  });

  it("falls back to the generic message for an overly long code", () => {
    expect(getRegisterErrorMessage("x".repeat(200))).toBe(REGISTER_ERROR_MESSAGES.generic);
  });

  it("falls back to the generic message for a code containing '<'", () => {
    expect(getRegisterErrorMessage("<script>alert(1)</script>")).toBe(
      REGISTER_ERROR_MESSAGES.generic,
    );
  });
});
