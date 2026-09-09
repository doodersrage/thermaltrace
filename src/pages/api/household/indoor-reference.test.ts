import { beforeEach, describe, expect, it, vi } from "vitest";
import type { APIContext } from "astro";

const mockGetAuthFromCookies = vi.fn();
vi.mock("../../../lib/auth", () => ({
  getAuthFromCookies: (...a: unknown[]) => mockGetAuthFromCookies(...a),
}));

const mockGetOwnedHouseholdId = vi.fn();
const mockCanEditHousehold = vi.fn();
const mockGetUserHouseholdRole = vi.fn();
vi.mock("../../../lib/households", () => ({
  getOwnedHouseholdId: (...a: unknown[]) => mockGetOwnedHouseholdId(...a),
  canEditHousehold: (...a: unknown[]) => mockCanEditHousehold(...a),
  getUserHouseholdRole: (...a: unknown[]) => mockGetUserHouseholdRole(...a),
}));

const mockUpdateIndoorReferenceSensor = vi.fn();
vi.mock("../../../lib/indoorReference", () => ({
  updateIndoorReferenceSensor: (...a: unknown[]) => mockUpdateIndoorReferenceSensor(...a),
}));

function makeContext(fields: Record<string, string> = {}): APIContext {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  const request = { formData: () => Promise.resolve(form) } as unknown as Request;
  const redirect = vi.fn(
    (path: string) => new Response(null, { status: 302, headers: { Location: path } }),
  );
  return { request, cookies: {}, redirect } as unknown as APIContext;
}

beforeEach(() => {
  mockGetAuthFromCookies.mockReset().mockResolvedValue({
    session: { access_token: "tok" },
    user: { id: "user-1", email: "user@example.com" },
  });
  mockGetOwnedHouseholdId.mockReset().mockResolvedValue("house-1");
  mockGetUserHouseholdRole.mockReset().mockResolvedValue("owner");
  mockCanEditHousehold.mockReset().mockReturnValue(true);
  mockUpdateIndoorReferenceSensor.mockReset().mockResolvedValue({ error: null });
});

describe("POST /api/household/indoor-reference", () => {
  it("redirects to /signin when not authenticated", async () => {
    mockGetAuthFromCookies.mockResolvedValue({ session: null, user: null });
    const { POST } = await import("./indoor-reference");
    const context = makeContext({ sensor_id: "sensor-1" });

    const response = await POST(context);

    expect(context.redirect).toHaveBeenCalledWith("/signin");
    expect(response.status).toBe(302);
  });

  it("redirects with no_household when the user has no owned household", async () => {
    mockGetOwnedHouseholdId.mockResolvedValue(null);
    const { POST } = await import("./indoor-reference");
    const context = makeContext({ sensor_id: "sensor-1" });

    await POST(context);

    expect(mockUpdateIndoorReferenceSensor).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/temperature?indoor_ref_error=no_household",
    );
  });

  it("redirects with forbidden when the user cannot edit the household", async () => {
    mockCanEditHousehold.mockReturnValue(false);
    const { POST } = await import("./indoor-reference");
    const context = makeContext({ sensor_id: "sensor-1" });

    await POST(context);

    expect(mockGetUserHouseholdRole).toHaveBeenCalledWith("user-1", "house-1");
    expect(mockUpdateIndoorReferenceSensor).not.toHaveBeenCalled();
    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/temperature?indoor_ref_error=forbidden",
    );
  });

  it("clears the sensor when sensor_id is blank and redirects with indoor_ref_saved", async () => {
    const { POST } = await import("./indoor-reference");
    const context = makeContext({ sensor_id: "  " });

    await POST(context);

    expect(mockUpdateIndoorReferenceSensor).toHaveBeenCalledWith("house-1", null);
    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/temperature?indoor_ref_saved=1#indoor-reference",
    );
  });

  it("saves the sensor and preserves a custom redirect path", async () => {
    const { POST } = await import("./indoor-reference");
    const context = makeContext({
      sensor_id: "sensor-1",
      redirect: "/dashboard/temperature#indoor-reference",
    });

    await POST(context);

    expect(mockUpdateIndoorReferenceSensor).toHaveBeenCalledWith("house-1", "sensor-1");
    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/temperature?indoor_ref_saved=1#indoor-reference",
    );
  });

  it("redirects with save_failed when the update fails", async () => {
    mockUpdateIndoorReferenceSensor.mockResolvedValue({ error: "db boom" });
    const { POST } = await import("./indoor-reference");
    const context = makeContext({ sensor_id: "sensor-1" });

    await POST(context);

    expect(context.redirect).toHaveBeenCalledWith(
      "/dashboard/temperature?indoor_ref_error=save_failed#indoor-reference",
    );
  });
});
