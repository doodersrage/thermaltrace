import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlertSettings } from "./alerts";
import type { User } from "@supabase/supabase-js";

const mockGetUserHouseholdId = vi.fn();
vi.mock("./households", () => ({
  getUserHouseholdId: (...a: unknown[]) => mockGetUserHouseholdId(...a),
}));

const mockGetAlertSettingsForUser = vi.fn();
vi.mock("./notify", () => ({
  getAlertSettingsForUser: (...a: unknown[]) => mockGetAlertSettingsForUser(...a),
}));

const mockListHouseholdDevices = vi.fn();
vi.mock("./devices", () => ({
  listHouseholdDevices: (...a: unknown[]) => mockListHouseholdDevices(...a),
}));

const mockGetUserEntitlements = vi.fn();
vi.mock("./entitlements", () => ({
  getUserEntitlements: (...a: unknown[]) => mockGetUserEntitlements(...a),
}));

const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();
vi.mock("./supabase", () => ({
  createServerClient: () => ({ from: (...a: unknown[]) => mockFrom(...a) }),
}));

const mockBuildMonitoringCertificateHtml = vi.fn();
const mockFormatCertificateDate = vi.fn();
const mockFormatPlanLabel = vi.fn();
const mockResolveMonitoringRetentionLabel = vi.fn();
vi.mock("./monitoringCertificate", () => ({
  buildMonitoringCertificateHtml: (...a: unknown[]) => mockBuildMonitoringCertificateHtml(...a),
  formatCertificateDate: (...a: unknown[]) => mockFormatCertificateDate(...a),
  formatPlanLabel: (...a: unknown[]) => mockFormatPlanLabel(...a),
  resolveMonitoringRetentionLabel: (...a: unknown[]) => mockResolveMonitoringRetentionLabel(...a),
}));

function alertSettings(overrides: Partial<AlertSettings> = {}): AlertSettings {
  return {
    enabled: true,
    freezeThresholdF: 35,
    channelEmail: false,
    channelSms: false,
    channelDiscord: false,
    channelPush: false,
    channelWebhook: false,
    channelTelegram: false,
    channelSlack: false,
    channelTeams: false,
    channelNtfy: false,
    channelPushover: false,
    channelWhatsapp: false,
    email: null,
    smsPhone: null,
    discordWebhookUrl: null,
    telegramBotToken: null,
    slackWebhookUrl: null,
    teamsWebhookUrl: null,
    ntfyTopic: null,
    pushoverUserKey: null,
    whatsappPhone: null,
    outboundWebhookUrl: null,
    dataRetentionDays: null,
    nwsFreezeAlertsEnabled: false,
    forecastFreezeEnabled: false,
    ...overrides,
  } as AlertSettings;
}

function user(overrides: Partial<Pick<User, "id" | "email" | "user_metadata">> = {}) {
  return {
    id: "user-1",
    email: "owner@example.com",
    user_metadata: {},
    ...overrides,
  } as Pick<User, "id" | "email" | "user_metadata">;
}

beforeEach(() => {
  mockGetUserHouseholdId.mockReset().mockResolvedValue("house-1");
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue(alertSettings());
  mockListHouseholdDevices.mockReset().mockResolvedValue({ devices: [], error: null });
  mockGetUserEntitlements.mockReset().mockResolvedValue({ tier: "free", historyDays: 7 });
  mockMaybeSingle.mockReset().mockResolvedValue({ data: { name: "The Smiths" } });
  mockFrom.mockReset().mockReturnValue({
    select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }),
  });
  mockBuildMonitoringCertificateHtml.mockReset().mockReturnValue("<html>cert</html>");
  mockFormatCertificateDate.mockReset().mockReturnValue("June 15, 2024");
  mockFormatPlanLabel.mockReset().mockReturnValue("Free");
  mockResolveMonitoringRetentionLabel.mockReset().mockReturnValue("7 days");
});

describe("generateMonitoringCertificateForUser", () => {
  it("returns a 'No household' error without fetching anything else", async () => {
    mockGetUserHouseholdId.mockResolvedValue(null);
    const { generateMonitoringCertificateForUser } = await import("./monitoringCertificateGenerate");

    const result = await generateMonitoringCertificateForUser(user(), "https://example.com");

    expect(result).toEqual({
      html: null,
      data: null,
      filenameBase: "thermaltrace-monitoring-certificate",
      error: "No household",
    });
    expect(mockGetAlertSettingsForUser).not.toHaveBeenCalled();
    expect(mockListHouseholdDevices).not.toHaveBeenCalled();
  });

  it("maps devices, filtering out invisible sensors", async () => {
    mockListHouseholdDevices.mockResolvedValue({
      devices: [
        {
          name: "Garage",
          space: "Outbuilding",
          sensors: [
            { label: "Probe 1", kind: "temperature", visible: true },
            { label: "Hidden", kind: "humidity", visible: false },
          ],
        },
        {
          name: "Attic",
          space: null,
          sensors: [{ label: "Probe 2", kind: "temperature", visible: true }],
        },
      ],
      error: null,
    });
    const { generateMonitoringCertificateForUser } = await import("./monitoringCertificateGenerate");

    const result = await generateMonitoringCertificateForUser(user(), "https://example.com");

    expect(result.data?.devices).toEqual([
      { name: "Garage", space: "Outbuilding", sensors: [{ label: "Probe 1", kind: "temperature" }] },
      { name: "Attic", space: null, sensors: [{ label: "Probe 2", kind: "temperature" }] },
    ]);
    expect(result.data?.deviceCount).toBe(2);
    expect(result.data?.sensorCount).toBe(2);
  });

  it("falls back from the household row name to the user's email, then 'Household'", async () => {
    const { generateMonitoringCertificateForUser } = await import("./monitoringCertificateGenerate");

    const withName = await generateMonitoringCertificateForUser(user(), "https://example.com");
    expect(withName.data?.householdLabel).toBe("The Smiths");

    mockMaybeSingle.mockResolvedValue({ data: { name: "   " } });
    const withEmail = await generateMonitoringCertificateForUser(user(), "https://example.com");
    expect(withEmail.data?.householdLabel).toBe("owner@example.com");

    mockMaybeSingle.mockResolvedValue({ data: null });
    const withNeither = await generateMonitoringCertificateForUser(
      user({ email: undefined }),
      "https://example.com",
    );
    expect(withNeither.data?.householdLabel).toBe("Household");
  });

  it("slugifies the household label for the filename, falling back to 'certificate'", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { name: "The Smiths' Garage!!" } });
    const { generateMonitoringCertificateForUser } = await import("./monitoringCertificateGenerate");

    const result = await generateMonitoringCertificateForUser(user(), "https://example.com");

    expect(result.filenameBase).toBe("thermaltrace-monitoring-the-smiths-garage");

    mockMaybeSingle.mockResolvedValue({ data: { name: "!!!" } });
    const fallback = await generateMonitoringCertificateForUser(
      user({ email: undefined }),
      "https://example.com",
    );
    expect(fallback.filenameBase).toBe("thermaltrace-monitoring-certificate");
  });

  it("only lists alert channels that are both enabled and have a destination configured", async () => {
    mockGetAlertSettingsForUser.mockResolvedValue(
      alertSettings({
        channelEmail: true,
        email: "alerts@example.com",
        channelSms: true,
        smsPhone: "", // enabled but no destination: excluded
        channelPush: true, // push has no destination field: always included when enabled
        channelWebhook: true,
        outboundWebhookUrl: "https://hooks.example.com/x",
      }),
    );
    const { generateMonitoringCertificateForUser } = await import("./monitoringCertificateGenerate");

    const result = await generateMonitoringCertificateForUser(user(), "https://example.com");

    expect(result.data?.alertChannels).toEqual(["email", "browser push", "webhook"]);
  });

  it("passes through entitlements-derived plan label and retention label", async () => {
    mockGetUserEntitlements.mockResolvedValue({ tier: "pro", historyDays: 90 });
    mockFormatPlanLabel.mockReturnValue("Pro");
    mockResolveMonitoringRetentionLabel.mockReturnValue("90 days");
    const { generateMonitoringCertificateForUser } = await import("./monitoringCertificateGenerate");

    const result = await generateMonitoringCertificateForUser(user(), "https://example.com");

    expect(mockFormatPlanLabel).toHaveBeenCalledWith("pro");
    expect(mockResolveMonitoringRetentionLabel).toHaveBeenCalledWith(null, 90);
    expect(result.data?.planLabel).toBe("Pro");
    expect(result.data?.dataRetentionLabel).toBe("90 days");
  });

  it("builds the html from the assembled data and returns no error", async () => {
    const { generateMonitoringCertificateForUser } = await import("./monitoringCertificateGenerate");

    const result = await generateMonitoringCertificateForUser(user(), "https://mysite.example");

    expect(mockBuildMonitoringCertificateHtml).toHaveBeenCalledWith(result.data);
    expect(result.html).toBe("<html>cert</html>");
    expect(result.error).toBeNull();
    expect(result.data?.siteUrl).toBe("https://mysite.example");
  });
});
