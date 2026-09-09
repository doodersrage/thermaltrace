import { describe, expect, it } from "vitest";
import { parseAlertPlaybooks, parseAlertPlaybooksFromForm } from "./alertPlaybooks";

const validStep = {
  id: "escalate-sms",
  name: "SMS follow-up",
  afterMinutes: 15,
  ifUnacked: true,
  channels: ["sms"],
  kinds: ["freeze"],
};

describe("parseAlertPlaybooks", () => {
  it("returns empty for non-arrays", () => {
    expect(parseAlertPlaybooks(null)).toEqual([]);
    expect(parseAlertPlaybooks({})).toEqual([]);
    expect(parseAlertPlaybooks("[]")).toEqual([]);
  });

  it("keeps steps with required id, afterMinutes, and channels", () => {
    expect(parseAlertPlaybooks([validStep])).toEqual([validStep]);
  });

  it("drops items missing required fields", () => {
    expect(
      parseAlertPlaybooks([
        validStep,
        { afterMinutes: 5, channels: ["email"] },
        { id: "x", channels: ["email"] },
        { id: "y", afterMinutes: 5 },
        { id: "z", afterMinutes: "5", channels: ["email"] },
        null,
        "bad",
      ]),
    ).toEqual([validStep]);
  });
});

describe("parseAlertPlaybooksFromForm", () => {
  it("returns empty for blank input", () => {
    expect(parseAlertPlaybooksFromForm(null)).toEqual([]);
    expect(parseAlertPlaybooksFromForm(undefined)).toEqual([]);
    expect(parseAlertPlaybooksFromForm("")).toEqual([]);
    expect(parseAlertPlaybooksFromForm("   ")).toEqual([]);
  });

  it("parses valid JSON playbook arrays", () => {
    expect(parseAlertPlaybooksFromForm(JSON.stringify([validStep]))).toEqual([validStep]);
  });

  it("returns empty for invalid JSON", () => {
    expect(parseAlertPlaybooksFromForm("{not json")).toEqual([]);
    expect(parseAlertPlaybooksFromForm("[")).toEqual([]);
  });

  it("filters invalid steps inside valid JSON", () => {
    expect(
      parseAlertPlaybooksFromForm(
        JSON.stringify([{ id: "only-id" }, validStep]),
      ),
    ).toEqual([validStep]);
  });
});
