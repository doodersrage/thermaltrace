import { describe, expect, it } from "vitest";
import { BRAND_DESCRIPTION, META_DESCRIPTION_MAX_LENGTH } from "./brand";
import { aboutPages } from "./aboutPages";
import { stories } from "./stories";
import { compareGuides } from "./compareGuides";
import { HA_DESCRIPTION } from "./homeAssistantIntegration";
import { MATTER_TAGLINE } from "./matterIntegration";
import { INFLUX_NAME, INFLUX_TAGLINE } from "./influxIntegration";
import { AUTOMATION_NAME, AUTOMATION_TAGLINE } from "./automationIntegration";
import { NODERED_NAME, NODERED_TAGLINE } from "./nodeRedIntegration";
import { SMARTTHINGS_NAME, SMARTTHINGS_TAGLINE } from "./smartThingsIntegration";
import { BAYBUDDY_TAGLINE } from "./bayBuddy";
import { DESKTOP_TAGLINE } from "./desktop";
import { CLAIM_PUCK_TAGLINE } from "./claimPuck";
import { getDefaultDescription } from "./schemaMarkup";

function expectMeta(label: string, value: string) {
  expect(
    value.length,
    `${label} is ${value.length} chars (max ${META_DESCRIPTION_MAX_LENGTH}): ${value}`,
  ).toBeLessThanOrEqual(META_DESCRIPTION_MAX_LENGTH);
}

describe("meta description length", () => {
  it("keeps brand and integration defaults within the SERP cutoff", () => {
    expectMeta("BRAND_DESCRIPTION", BRAND_DESCRIPTION);
    expectMeta("getDefaultDescription", getDefaultDescription());
    expectMeta("MATTER_TAGLINE", MATTER_TAGLINE);
    expectMeta("HA_DESCRIPTION", HA_DESCRIPTION);
    expectMeta("Influx meta", `${INFLUX_NAME}: ${INFLUX_TAGLINE}`);
    expectMeta("Automation meta", `${AUTOMATION_NAME}: ${AUTOMATION_TAGLINE}`);
    expectMeta("Node-RED meta", `${NODERED_NAME}: ${NODERED_TAGLINE}`);
    expectMeta("SmartThings meta", `${SMARTTHINGS_NAME}: ${SMARTTHINGS_TAGLINE}`);
    expectMeta("Bay Buddy tagline", BAYBUDDY_TAGLINE);
    expectMeta("Desktop tagline", DESKTOP_TAGLINE);
    expectMeta("Claim puck tagline", CLAIM_PUCK_TAGLINE);
  });

  it("keeps about, story, and compare guide descriptions within the SERP cutoff", () => {
    for (const page of aboutPages) {
      expectMeta(`/about/${page.slug}`, page.description);
    }
    for (const story of stories) {
      expectMeta(story.path, story.description);
    }
    for (const guide of compareGuides) {
      expectMeta(guide.path, guide.description);
    }
  });
});
