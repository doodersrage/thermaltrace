import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockGetAlertSettingsForUser = vi.fn();
vi.mock("../../../lib/notify", () => ({
  getAlertSettingsForUser: (...a: unknown[]) => mockGetAlertSettingsForUser(...a),
}));

const mockGetUserPreferences = vi.fn();
vi.mock("../../../lib/userPreferences", () => ({
  getUserPreferences: (...a: unknown[]) => mockGetUserPreferences(...a),
}));

const mockFetchNightsAtRisk = vi.fn();
vi.mock("../../../lib/FetchWeather", () => ({
  fetchNightsAtRisk: (...a: unknown[]) => mockFetchNightsAtRisk(...a),
}));

const mockBuildFreezeOutlookIcal = vi.fn();
vi.mock("../../../lib/icalFeed", () => ({
  buildFreezeOutlookIcal: (...a: unknown[]) => mockBuildFreezeOutlookIcal(...a),
}));

function makeContext(): APIContext {
  return { cookies: {} } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "t" },
    user: { id: "user-1", user_metadata: {} },
  });
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue({ freezeThresholdF: 32 });
  mockGetUserPreferences.mockReset().mockResolvedValue({ weatherCityId: "1234" });
  mockFetchNightsAtRisk.mockReset().mockResolvedValue([]);
  mockBuildFreezeOutlookIcal.mockReset().mockReturnValue("BEGIN:VCALENDAR\nEND:VCALENDAR");
});

describe("GET /api/ical/outlook", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { GET } = await import("./outlook");

    const response = await GET(makeContext());

    expect(response.status).toBe(401);
    expect(mockFetchNightsAtRisk).not.toHaveBeenCalled();
  });

  it("fetches settings, preferences, and nights at risk for the user", async () => {
    const { GET } = await import("./outlook");

    await GET(makeContext());

    expect(mockGetAlertSettingsForUser).toHaveBeenCalledWith("user-1", {});
    expect(mockGetUserPreferences).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-1" }),
    );
    expect(mockFetchNightsAtRisk).toHaveBeenCalledWith({
      cityId: "1234",
      freezeThresholdF: 32,
    });
  });

  it("returns the built ical body with calendar headers", async () => {
    mockFetchNightsAtRisk.mockResolvedValue([{ dateLabel: "Mon", minTempF: 20, atRisk: true }]);
    mockBuildFreezeOutlookIcal.mockReturnValue("BEGIN:VCALENDAR\nSUMMARY:Freeze\nEND:VCALENDAR");
    const { GET } = await import("./outlook");

    const response = await GET(makeContext());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/calendar; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toBe(
      'attachment; filename="thermaltrace-freeze-outlook.ics"',
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("BEGIN:VCALENDAR\nSUMMARY:Freeze\nEND:VCALENDAR");
    expect(mockBuildFreezeOutlookIcal).toHaveBeenCalledWith([
      { dateLabel: "Mon", minTempF: 20, atRisk: true },
    ]);
  });
});
