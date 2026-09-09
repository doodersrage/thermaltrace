import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockMaybeSingle = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockCreateServerClient = vi.fn();
vi.mock("../../../lib/supabase", () => ({
  createServerClient: () => mockCreateServerClient(),
}));

const mockGetAlertSettingsForUser = vi.fn();
const mockSaveAlertSettingsForUser = vi.fn();
vi.mock("../../../lib/notify", () => ({
  getAlertSettingsForUser: (...a: unknown[]) => mockGetAlertSettingsForUser(...a),
  saveAlertSettingsForUser: (...a: unknown[]) => mockSaveAlertSettingsForUser(...a),
}));

const mockSnoozeUntilFromHours = vi.fn();
const mockVacationUntilFromDays = vi.fn();
vi.mock("../../../lib/alertSnooze", () => ({
  snoozeUntilFromHours: (...a: unknown[]) => mockSnoozeUntilFromHours(...a),
  vacationUntilFromDays: (...a: unknown[]) => mockVacationUntilFromDays(...a),
}));

const mockGetUserHouseholdId = vi.fn();
vi.mock("../../../lib/households", () => ({
  getUserHouseholdId: (...a: unknown[]) => mockGetUserHouseholdId(...a),
}));

const mockFetchLatestSensorValues = vi.fn();
vi.mock("../../../lib/sensorReadings", () => ({
  fetchLatestSensorValues: (...a: unknown[]) => mockFetchLatestSensorValues(...a),
}));

const mockFilterRowsByLabel = vi.fn();
const mockParseTelegramSnoozeHours = vi.fn();
const mockParseTelegramVacationDays = vi.fn();
const mockTelegramStatusQuery = vi.fn();
vi.mock("../../../lib/telegramCommands", () => ({
  filterRowsByLabel: (...a: unknown[]) => mockFilterRowsByLabel(...a),
  parseTelegramSnoozeHours: (...a: unknown[]) => mockParseTelegramSnoozeHours(...a),
  parseTelegramVacationDays: (...a: unknown[]) => mockParseTelegramVacationDays(...a),
  telegramStatusQuery: (...a: unknown[]) => mockTelegramStatusQuery(...a),
  TELEGRAM_HELP: "help text",
}));

const mockCheckTelegramWebhookRateLimit = vi.fn();
vi.mock("../../../lib/telegramWebhookLimits", () => ({
  checkTelegramWebhookRateLimit: (...a: unknown[]) =>
    mockCheckTelegramWebhookRateLimit(...a),
}));

const mockTimingSafeEqual = vi.fn();
vi.mock("../../../lib/timingSafeEqual", () => ({
  timingSafeEqual: (...a: unknown[]) => mockTimingSafeEqual(...a),
}));

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeContext(options: {
  secret?: string | null;
  body?: unknown;
  clientAddress?: string;
} = {}): APIContext {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (options.secret !== null) {
    headers.set(
      "X-Telegram-Bot-Api-Secret-Token",
      options.secret ?? "telegram-secret",
    );
  }
  return {
    request: new Request("https://example.com/api/telegram/webhook", {
      method: "POST",
      headers,
      body: JSON.stringify(
        options.body ?? {
          message: { text: "/help", chat: { id: 42 } },
        },
      ),
    }),
    url: new URL("https://example.com/api/telegram/webhook"),
    clientAddress: options.clientAddress ?? "127.0.0.1",
  } as unknown as APIContext;
}

beforeEach(() => {
  mockMaybeSingle.mockReset().mockResolvedValue({ data: { user_id: "user-1" } });
  mockEq.mockReset().mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockSelect.mockReset().mockReturnValue({ eq: mockEq });
  mockFrom.mockReset().mockReturnValue({ select: mockSelect });
  mockCreateServerClient.mockReset().mockReturnValue({ from: mockFrom });
  mockCheckTelegramWebhookRateLimit.mockReset().mockReturnValue({ ok: true });
  mockGetAlertSettingsForUser.mockReset().mockResolvedValue({
    telegramBotToken: "bot-token",
    telegramChatId: "42",
  });
  mockSaveAlertSettingsForUser.mockReset().mockResolvedValue({ error: null });
  mockParseTelegramSnoozeHours.mockReset().mockReturnValue(4);
  mockParseTelegramVacationDays.mockReset().mockReturnValue(3);
  mockSnoozeUntilFromHours.mockReset().mockReturnValue("2024-01-01T04:00:00Z");
  mockVacationUntilFromDays.mockReset().mockReturnValue("2024-01-04T00:00:00Z");
  mockGetUserHouseholdId.mockReset().mockResolvedValue("house-1");
  mockFetchLatestSensorValues.mockReset().mockResolvedValue([]);
  mockTelegramStatusQuery.mockReset().mockReturnValue("");
  mockFilterRowsByLabel.mockReset().mockReturnValue([]);
  mockTimingSafeEqual.mockReset().mockReturnValue(true);
  mockFetch.mockReset().mockResolvedValue(new Response("ok"));
});

describe("POST /api/telegram/webhook", () => {
  it("returns 429 when rate limited", async () => {
    mockCheckTelegramWebhookRateLimit.mockReturnValue({
      ok: false,
      retryAfterSec: 10,
    });
    const { POST } = await import("./webhook");

    const response = await POST(makeContext());

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("10");
  });

  it("returns 401 when the telegram secret is unknown", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null });
    const { POST } = await import("./webhook");

    const response = await POST(makeContext());

    expect(response.status).toBe(401);
  });

  it("returns 401 when the chat id does not match", async () => {
    mockTimingSafeEqual.mockReturnValue(false);
    const { POST } = await import("./webhook");

    const response = await POST(makeContext());

    expect(response.status).toBe(401);
  });

  it("snoozes alerts and replies via telegram", async () => {
    const { POST } = await import("./webhook");

    const response = await POST(
      makeContext({ body: { message: { text: "/snooze 4", chat: { id: 42 } } } }),
    );

    expect(mockSaveAlertSettingsForUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ snoozeUntil: "2024-01-01T04:00:00Z" }),
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.telegram.org/botbot-token/sendMessage",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Alerts snoozed for 4 hours"),
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
