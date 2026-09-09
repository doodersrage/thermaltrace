import { afterEach, describe, expect, it, vi } from "vitest";
import {
  browserSupportsWebAuthn,
  performWebAuthnCreate,
  performWebAuthnGet,
} from "./webauthnMfaBrowser";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browserSupportsWebAuthn", () => {
  it("returns false when window is undefined", () => {
    expect(browserSupportsWebAuthn()).toBe(false);
  });

  it("returns false when window has no PublicKeyCredential", () => {
    vi.stubGlobal("window", { navigator: {} });
    expect(browserSupportsWebAuthn()).toBe(false);
  });

  it("returns false when navigator.credentials is missing create/get", () => {
    vi.stubGlobal("window", {
      PublicKeyCredential: function () {},
      navigator: { credentials: {} },
    });
    expect(browserSupportsWebAuthn()).toBe(false);
  });

  it("returns true when everything required is present", () => {
    vi.stubGlobal("window", {
      PublicKeyCredential: function () {},
      navigator: { credentials: { create: () => {}, get: () => {} } },
    });
    expect(browserSupportsWebAuthn()).toBe(true);
  });
});

describe("performWebAuthnCreate", () => {
  it("throws when the browser can't parse creation options from JSON", async () => {
    vi.stubGlobal("PublicKeyCredential", function () {});

    await expect(performWebAuthnCreate({})).rejects.toThrow(
      "This browser does not support WebAuthn registration",
    );
  });

  it("throws when registration is cancelled (credential is null)", async () => {
    const parsed = { challenge: "abc" };
    vi.stubGlobal("PublicKeyCredential", {
      parseCreationOptionsFromJSON: vi.fn().mockReturnValue(parsed),
    });
    vi.stubGlobal("navigator", { credentials: { create: vi.fn().mockResolvedValue(null) } });

    await expect(performWebAuthnCreate({})).rejects.toThrow(
      "Security key registration was cancelled",
    );
  });

  it("throws when the resulting credential can't be serialized", async () => {
    vi.stubGlobal("PublicKeyCredential", {
      parseCreationOptionsFromJSON: vi.fn().mockReturnValue({}),
    });
    vi.stubGlobal("navigator", {
      credentials: { create: vi.fn().mockResolvedValue({}) },
    });

    await expect(performWebAuthnCreate({})).rejects.toThrow(
      "Could not serialize WebAuthn credential",
    );
  });

  it("parses options, creates the credential, and returns its JSON form", async () => {
    const parsed = { challenge: "abc" };
    const parseCreationOptionsFromJSON = vi.fn().mockReturnValue(parsed);
    const toJSON = vi.fn().mockReturnValue({ id: "cred-1" });
    const create = vi.fn().mockResolvedValue({ toJSON });
    vi.stubGlobal("PublicKeyCredential", { parseCreationOptionsFromJSON });
    vi.stubGlobal("navigator", { credentials: { create } });

    const result = await performWebAuthnCreate({ rp: { id: "example.com" } });

    expect(parseCreationOptionsFromJSON).toHaveBeenCalledWith({ rp: { id: "example.com" } });
    expect(create).toHaveBeenCalledWith({ publicKey: parsed });
    expect(result).toEqual({ id: "cred-1" });
  });
});

describe("performWebAuthnGet", () => {
  it("throws when the browser can't parse request options from JSON", async () => {
    vi.stubGlobal("PublicKeyCredential", function () {});

    await expect(performWebAuthnGet({})).rejects.toThrow(
      "This browser does not support WebAuthn authentication",
    );
  });

  it("throws when verification is cancelled (credential is null)", async () => {
    vi.stubGlobal("PublicKeyCredential", {
      parseRequestOptionsFromJSON: vi.fn().mockReturnValue({}),
    });
    vi.stubGlobal("navigator", { credentials: { get: vi.fn().mockResolvedValue(null) } });

    await expect(performWebAuthnGet({})).rejects.toThrow(
      "Security key verification was cancelled",
    );
  });

  it("parses options, gets the credential, and returns its JSON form", async () => {
    const parsed = { challenge: "xyz" };
    const parseRequestOptionsFromJSON = vi.fn().mockReturnValue(parsed);
    const toJSON = vi.fn().mockReturnValue({ id: "cred-2" });
    const get = vi.fn().mockResolvedValue({ toJSON });
    vi.stubGlobal("PublicKeyCredential", { parseRequestOptionsFromJSON });
    vi.stubGlobal("navigator", { credentials: { get } });

    const result = await performWebAuthnGet({ allowCredentials: [] });

    expect(parseRequestOptionsFromJSON).toHaveBeenCalledWith({ allowCredentials: [] });
    expect(get).toHaveBeenCalledWith({ publicKey: parsed });
    expect(result).toEqual({ id: "cred-2" });
  });
});
