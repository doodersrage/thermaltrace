import { describe, expect, it } from "vitest";
import {
  MFA_WEBAUTHN_UI_ENABLED,
  YUBIKEY_OTP_ENROLL_HINT,
  YUBIKEY_OTP_SIGNIN_HINT,
  YUBIKEY_TOTP_ENROLL_HINT,
  YUBIKEY_TOTP_SIGNIN_HINT,
} from "./mfaWebAuthnUi";

describe("mfaWebAuthnUi", () => {
  it("keeps WebAuthn MFA UI disabled", () => {
    expect(MFA_WEBAUTHN_UI_ENABLED).toBe(false);
  });

  it("exposes non-empty YubiKey hint strings", () => {
    for (const hint of [
      YUBIKEY_OTP_ENROLL_HINT,
      YUBIKEY_OTP_SIGNIN_HINT,
      YUBIKEY_TOTP_ENROLL_HINT,
      YUBIKEY_TOTP_SIGNIN_HINT,
    ]) {
      expect(typeof hint).toBe("string");
      expect(hint.trim().length).toBeGreaterThan(0);
    }
  });
});
