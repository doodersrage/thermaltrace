import { describe, expect, it } from "vitest";
import {
  isMailerRecipientNotAllowed,
  partitionMailErrors,
} from "./mailer";
import { dripJobShouldFail } from "./dripEmails";

describe("mailer recipient errors", () => {
  it("detects Cloudflare destination restrictions", () => {
    expect(
      isMailerRecipientNotAllowed(new Error("email to rob@studiocenter.com not allowed")),
    ).toBe(true);
    expect(isMailerRecipientNotAllowed(new Error("network timeout"))).toBe(false);
  });

  it("does not fail drip job for recipient-not-allowed only", () => {
    expect(
      dripJobShouldFail([
        "user-1: email to rob@studiocenter.com not allowed",
      ]),
    ).toBe(false);
    expect(dripJobShouldFail(["user-1: MAILER unavailable"])).toBe(true);
  });

  it("partitions restricted vs hard errors", () => {
    const { hardErrors, restrictedErrors } = partitionMailErrors([
      "a: not allowed",
      "b: boom",
      "c: temporary bounces (cannot retry)",
    ]);
    expect(restrictedErrors).toHaveLength(2);
    expect(hardErrors).toEqual(["b: boom"]);
  });
});