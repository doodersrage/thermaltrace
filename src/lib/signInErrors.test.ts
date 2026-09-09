import { describe, expect, it } from "vitest";
import {
  SIGNIN_ERROR_MESSAGES,
  buildSignInRedirectUrl,
  getSignInErrorMessage,
  mapSignInError,
} from "./signInErrors";

describe("getSignInErrorMessage", () => {
  it("returns null for a null code", () => {
    expect(getSignInErrorMessage(null)).toBeNull();
  });

  it("returns the mapped message for a known code", () => {
    expect(getSignInErrorMessage("oauth_denied")).toBe(SIGNIN_ERROR_MESSAGES.oauth_denied);
  });

  it("falls back to the generic message for an unknown code", () => {
    expect(getSignInErrorMessage("totally_bogus")).toBe(SIGNIN_ERROR_MESSAGES.generic);
  });
});

describe("mapSignInError", () => {
  it("maps invalid login credentials (case-insensitively)", () => {
    expect(mapSignInError({ message: "Invalid login credentials" })).toBe("invalid_credentials");
    expect(mapSignInError({ message: "INVALID LOGIN CREDENTIALS" })).toBe("invalid_credentials");
  });

  it("maps email not confirmed", () => {
    expect(mapSignInError({ message: "Email not confirmed" })).toBe("email_not_confirmed");
  });

  it("falls back to generic for anything else", () => {
    expect(mapSignInError({ message: "some other supabase error" })).toBe("generic");
  });
});

describe("buildSignInRedirectUrl", () => {
  it("builds a url with just the error code", () => {
    expect(buildSignInRedirectUrl("generic")).toBe("/signin?error=generic");
  });

  it("includes email and oauth_detail when given", () => {
    const url = buildSignInRedirectUrl("oauth_failed", "a@b.com", "provider timeout");
    const params = new URLSearchParams(url.split("?")[1]);

    expect(params.get("error")).toBe("oauth_failed");
    expect(params.get("email")).toBe("a@b.com");
    expect(params.get("oauth_detail")).toBe("provider timeout");
  });

  it("omits email/oauth_detail params when not given", () => {
    const url = buildSignInRedirectUrl("generic");

    expect(url).not.toContain("email=");
    expect(url).not.toContain("oauth_detail=");
  });
});
