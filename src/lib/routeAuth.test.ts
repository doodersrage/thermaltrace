import { describe, expect, it } from "vitest";
import { pathRequiresAuth } from "./routeAuth";

describe("pathRequiresAuth", () => {
  it("allows public home and Stripe webhook endpoints", () => {
    expect(pathRequiresAuth("/api/stripe/webhook")).toBe(false);
    expect(pathRequiresAuth("/api/home/demo-temps")).toBe(false);
    expect(pathRequiresAuth("/api/home/weather")).toBe(false);
    expect(pathRequiresAuth("/api/feeds/example")).toBe(false);
    expect(pathRequiresAuth("/")).toBe(false);
    expect(pathRequiresAuth("/signin")).toBe(false);
  });

  it("requires auth for dashboard and protected APIs", () => {
    expect(pathRequiresAuth("/dashboard")).toBe(true);
    expect(pathRequiresAuth("/dashboard/alerts")).toBe(true);
    expect(pathRequiresAuth("/api/home/readings")).toBe(true);
    expect(pathRequiresAuth("/api/stripe/checkout")).toBe(true);
    expect(pathRequiresAuth("/api/user/alert-settings")).toBe(true);
    expect(pathRequiresAuth("/api/devices")).toBe(true);
    expect(pathRequiresAuth("/api/claims/pack")).toBe(true);
    expect(pathRequiresAuth("/api/alerts/export.csv")).toBe(true);
    expect(pathRequiresAuth("/api/api-keys")).toBe(true);
    expect(pathRequiresAuth("/api/inbound-webhooks")).toBe(true);
    expect(pathRequiresAuth("/api/status/manage")).toBe(true);
    expect(pathRequiresAuth("/api/contacts/export.csv")).toBe(true);
    expect(pathRequiresAuth("/api/ical/outlook")).toBe(true);
    expect(pathRequiresAuth("/api/auth/update-password")).toBe(true);
    expect(pathRequiresAuth("/api/auth/mfa-manage")).toBe(true);
    expect(pathRequiresAuth("/api/auth/companion/complete")).toBe(true);
    expect(pathRequiresAuth("/api/integrations/nest/connect")).toBe(true);
    expect(pathRequiresAuth("/api/integrations/ecobee/callback")).toBe(true);
    expect(pathRequiresAuth("/api/integrations/thermostat")).toBe(true);
    expect(pathRequiresAuth("/api/pucks/register")).toBe(true);
    expect(pathRequiresAuth("/api/pucks/claim/start")).toBe(true);
    expect(pathRequiresAuth("/api/bays/garage/mood")).toBe(true);
    expect(pathRequiresAuth("/api/monitoring/certificate")).toBe(true);
    expect(pathRequiresAuth("/_actions/updateAlertSettings")).toBe(true);
  });

  it("keeps companion start public so unsigned OAuth can begin", () => {
    expect(pathRequiresAuth("/api/auth/companion/start")).toBe(false);
  });

  it("keeps token-based alert links public", () => {
    expect(pathRequiresAuth("/api/alerts/snooze")).toBe(false);
    expect(pathRequiresAuth("/api/alerts/ack")).toBe(false);
    expect(pathRequiresAuth("/api/telegram/webhook")).toBe(false);
    expect(pathRequiresAuth("/api/status/subscribe")).toBe(false);
  });
});
