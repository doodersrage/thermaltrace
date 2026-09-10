import { describe, expect, it } from "vitest";
import { formRedirectPath, sanitizeNextPath } from "./siteUrl";

describe("sanitizeNextPath", () => {
  it("allows relative same-origin paths", () => {
    expect(sanitizeNextPath("/dashboard")).toBe("/dashboard");
    expect(sanitizeNextPath("/dashboard/share?x=1")).toBe("/dashboard/share?x=1");
  });

  it("rejects open redirects", () => {
    expect(sanitizeNextPath("https://evil.example/")).toBeNull();
    expect(sanitizeNextPath("//evil.example")).toBeNull();
    expect(sanitizeNextPath("\\\\evil.example")).toBeNull();
    expect(sanitizeNextPath("/\\evil.example")).toBeNull();
  });
});

describe("formRedirectPath", () => {
  it("falls back when redirect is absolute", () => {
    const formData = new FormData();
    formData.set("redirect", "https://attacker.tld/collect");
    expect(formRedirectPath(formData, "/dashboard/share")).toBe("/dashboard/share");
  });

  it("uses a safe redirect field", () => {
    const formData = new FormData();
    formData.set("redirect", "/dashboard/devices");
    expect(formRedirectPath(formData, "/dashboard/share")).toBe(
      "/dashboard/devices",
    );
  });
});
