import { describe, expect, it } from "vitest";
import { HACS_REPO_URL, INTEGRATION_CARDS } from "./integrationsHub";

describe("integrationsHub", () => {
  it("re-exports HACS repo URL for integration pages", () => {
    expect(HACS_REPO_URL).toContain("thermaltrace-home-assistant");
  });

  it("includes Home Assistant as first integration card", () => {
    expect(INTEGRATION_CARDS[0]?.id).toBe("home-assistant");
  });

  it("keeps primary CTAs on thermaltrace.dev when in-app docs exist", () => {
    for (const card of INTEGRATION_CARDS) {
      if (card.external) {
        expect(card.href).toMatch(/^https?:\/\//);
        continue;
      }
      expect(card.href.startsWith("/"), `${card.id} should use an in-app path`).toBe(true);
    }
    const webhooks = INTEGRATION_CARDS.find((c) => c.id === "webhooks");
    expect(webhooks?.href).toBe("/about/ingest-and-webhooks");
    expect(webhooks?.bullets?.length).toBeGreaterThanOrEqual(2);
    expect(webhooks?.secondaryExternal).toBe(true);

    const grafana = INTEGRATION_CARDS.find((c) => c.id === "grafana");
    expect(grafana?.href).toBe("/docs/api");

    const mqtt = INTEGRATION_CARDS.find((c) => c.id === "mqtt-bridge");
    expect(mqtt?.href).toBe("/about/mqtt-bridge");

    expect(INTEGRATION_CARDS.some((c) => c.id === "freeze-map-embed")).toBe(true);
    expect(INTEGRATION_CARDS.some((c) => c.id === "matter")).toBe(true);
    expect(INTEGRATION_CARDS.some((c) => c.id === "node-red")).toBe(true);
    expect(INTEGRATION_CARDS.some((c) => c.id === "automation")).toBe(true);
    expect(INTEGRATION_CARDS.some((c) => c.id === "influx")).toBe(true);
    expect(INTEGRATION_CARDS.some((c) => c.id === "smartthings")).toBe(true);
    const matter = INTEGRATION_CARDS.find((c) => c.id === "matter");
    expect(matter?.href).toBe("/integrations/matter");
  });
});
