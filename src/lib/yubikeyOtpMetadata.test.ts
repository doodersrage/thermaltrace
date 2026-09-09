import { describe, expect, it } from "vitest";
import {
  YUBIKEY_OTP_METADATA_KEY,
  buildYubiKeyMetadataRemove,
  buildYubiKeyMetadataUpdate,
  getYubiKeyPublicIdsFromUser,
  userHasYubiKeyOtpEnrolled,
} from "./yubikeyOtpMetadata";

const VALID_ID = "cccjgjgkhcbb";

describe("getYubiKeyPublicIdsFromUser", () => {
  it("returns an empty array for a null/undefined user or missing metadata", () => {
    expect(getYubiKeyPublicIdsFromUser(null)).toEqual([]);
    expect(getYubiKeyPublicIdsFromUser(undefined)).toEqual([]);
    expect(getYubiKeyPublicIdsFromUser({ user_metadata: {} })).toEqual([]);
  });

  it("returns an empty array when the metadata value isn't an array", () => {
    expect(
      getYubiKeyPublicIdsFromUser({ user_metadata: { [YUBIKEY_OTP_METADATA_KEY]: "not-an-array" } }),
    ).toEqual([]);
  });

  it("filters out entries that aren't valid modhex public ids", () => {
    const result = getYubiKeyPublicIdsFromUser({
      user_metadata: { [YUBIKEY_OTP_METADATA_KEY]: [VALID_ID, "too-short", 12345, null] },
    });

    expect(result).toEqual([VALID_ID]);
  });

  it("trims and lowercases valid ids", () => {
    const result = getYubiKeyPublicIdsFromUser({
      user_metadata: { [YUBIKEY_OTP_METADATA_KEY]: [`  ${VALID_ID.toUpperCase()}  `] },
    });

    expect(result).toEqual([VALID_ID]);
  });
});

describe("userHasYubiKeyOtpEnrolled", () => {
  it("is false with no enrolled ids and true with at least one", () => {
    expect(userHasYubiKeyOtpEnrolled({ user_metadata: {} })).toBe(false);
    expect(
      userHasYubiKeyOtpEnrolled({ user_metadata: { [YUBIKEY_OTP_METADATA_KEY]: [VALID_ID] } }),
    ).toBe(true);
  });
});

describe("buildYubiKeyMetadataUpdate", () => {
  it("appends a new normalized id", () => {
    expect(buildYubiKeyMetadataUpdate([], VALID_ID.toUpperCase())).toEqual({
      [YUBIKEY_OTP_METADATA_KEY]: [VALID_ID],
    });
  });

  it("does not duplicate an id that's already present", () => {
    expect(buildYubiKeyMetadataUpdate([VALID_ID], VALID_ID)).toEqual({
      [YUBIKEY_OTP_METADATA_KEY]: [VALID_ID],
    });
  });
});

describe("buildYubiKeyMetadataRemove", () => {
  it("removes the matching normalized id", () => {
    expect(buildYubiKeyMetadataRemove([VALID_ID, "other-id"], VALID_ID.toUpperCase())).toEqual({
      [YUBIKEY_OTP_METADATA_KEY]: ["other-id"],
    });
  });

  it("is a no-op when the id isn't present", () => {
    expect(buildYubiKeyMetadataRemove(["other-id"], VALID_ID)).toEqual({
      [YUBIKEY_OTP_METADATA_KEY]: ["other-id"],
    });
  });
});
