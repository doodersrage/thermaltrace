import type { APIRoute } from "astro";
import { getAuthFromRequest } from "../../../lib/auth";
import { createServerClient } from "../../../lib/supabase";
import {
  countOwnedHouseholds,
  getOwnedHouseholdId,
  getOrCreateHouseholdForUser,
  leaveHousehold,
  listHouseholdMembers,
  listUserHouseholds,
  removeHouseholdMember,
  setActiveHouseholdForUser,
  updateHouseholdName,
  createAdditionalHouseholdForUser,
} from "../../../lib/households";
import { getUserEntitlements } from "../../../lib/entitlements";
import {
  createHouseholdInvite,
  listPendingInvites,
  parseHouseholdInviteRole,
  revokeHouseholdInvite,
  sendInviteEmail,
} from "../../../lib/householdInvites";
import { buildSiteUrl } from "../../../lib/stripe";
import { updateHouseholdFreezeMapSettings } from "../../../lib/freezeMap";
import { getHouseholdFreezeMapSettings } from "../../../lib/freezeMap";
import { getIndoorReferenceSensorId } from "../../../lib/indoorReference";
import {
  redirectUnlessManager,
  requireHouseholdManager,
} from "../../../lib/householdAuth";
import { recordHouseholdActivity } from "../../../lib/householdActivity";
import { formRedirectPath } from "../../../lib/siteUrl";

export const GET: APIRoute = async ({ request, cookies }) => {
  const { user } = await getAuthFromRequest(request, cookies);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const household = await getOrCreateHouseholdForUser(user.id, user.email);
  if (household.error) {
    return new Response(JSON.stringify({ error: household.error }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [members, households, invites, freezeMap, indoorReferenceSensorId] =
    await Promise.all([
    listHouseholdMembers(household.householdId),
    listUserHouseholds(user.id),
    listPendingInvites(household.householdId),
    getHouseholdFreezeMapSettings(household.householdId),
    getIndoorReferenceSensorId(household.householdId),
  ]);

  const manager = await requireHouseholdManager(user.id);
  const safeInvites = manager.ok
    ? invites.invites
    : invites.invites.map(({ token, ...rest }) => ({
        ...rest,
        token: null as string | null,
        token_preview: token.slice(-4),
      }));

  return new Response(
    JSON.stringify({
      householdId: household.householdId,
      members: members.members,
      households: households.households,
      invites: safeInvites,
      indoor_reference_sensor_id: indoorReferenceSensorId,
      freeze_map: {
        opt_in: freezeMap.optIn,
        city_id: freezeMap.cityId,
        label: freezeMap.label,
        lat: freezeMap.lat,
        lon: freezeMap.lon,
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { user } = await getAuthFromRequest(request, cookies);
  if (!user) {
    return redirect("/signin");
  }

  const formData = await request.formData();
  const action = formData.get("action")?.toString() ?? "invite";
  const redirectTo = formRedirectPath(formData, "/dashboard/household");

  if (action === "switch") {
    const householdId = formData.get("household_id")?.toString();
    if (!householdId) {
      return redirect(`${redirectTo}?error=1`);
    }
    const result = await setActiveHouseholdForUser(user.id, householdId);
    if (result.error) {
      return redirect(`${redirectTo}?error=${encodeURIComponent(result.error)}`);
    }
    return redirect(`${redirectTo}?switched=1`);
  }

  if (action === "leave") {
    const householdId = formData.get("household_id")?.toString();
    if (!householdId) {
      return redirect(`${redirectTo}?error=1`);
    }
    const result = await leaveHousehold(user.id, householdId);
    if (result.error) {
      return redirect(
        `${redirectTo}?error=${encodeURIComponent(result.error === "Cannot remove the household owner" ? "cannot_leave_owner" : result.error)}`,
      );
    }
    return redirect(`${redirectTo}?left=1`);
  }

  if (action === "create_property") {
    const entitlements = await getUserEntitlements(user.id);
    const ownedCount = await countOwnedHouseholds(user.id);
    if (ownedCount >= entitlements.maxOwnedHouseholds) {
      return redirect(`${redirectTo}?error=property_limit`);
    }
    const name = formData.get("name")?.toString() ?? "My property";
    const result = await createAdditionalHouseholdForUser(user.id, name);
    if (result.error) {
      return redirect(`${redirectTo}?error=1`);
    }
    await recordHouseholdActivity({
      householdId: result.householdId,
      userId: user.id,
      action: "household_created",
      detail: name,
    });
    return redirect(`${redirectTo}?property_created=1`);
  }

  const manager = await requireHouseholdManager(user.id);
  const blocked = redirectUnlessManager(manager, redirectTo, redirect);
  if (blocked) return blocked;

  const ownedId = await getOwnedHouseholdId(user.id);
  const household = await getOrCreateHouseholdForUser(user.id, user.email);
  const manageId = ownedId ?? household.householdId;

  if (!manageId) {
    return redirect(`${redirectTo}?error=1`);
  }

  if (action === "rename") {
    const name = formData.get("name")?.toString() ?? "";
    await updateHouseholdName(manageId, name);
    return redirect(`${redirectTo}?saved=1`);
  }

  if (action === "freeze_map") {
    if (!ownedId || ownedId !== manageId) {
      return redirect(`${redirectTo}?error=1`);
    }
    const optIn = formData.has("freeze_map_opt_in");
    const cityId = formData.get("freeze_map_city_id")?.toString().trim() || null;
    const label = formData.get("freeze_map_label")?.toString().trim() || null;
    const latRaw = formData.get("freeze_map_lat")?.toString().trim();
    const lonRaw = formData.get("freeze_map_lon")?.toString().trim();
    const lat = latRaw ? Number(latRaw) : null;
    const lon = lonRaw ? Number(lonRaw) : null;
    const result = await updateHouseholdFreezeMapSettings(manageId, {
      optIn,
      cityId,
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null,
      label,
    });
    if (result.error) {
      return redirect(`${redirectTo}?error=1`);
    }
    return redirect(`${redirectTo}?saved=1`);
  }

  if (action === "remove") {
    const memberUserId = formData.get("user_id")?.toString();
    if (!memberUserId) {
      return redirect(`${redirectTo}?error=1`);
    }
    const result = await removeHouseholdMember(manageId, memberUserId);
    if (result.error) {
      return redirect(`${redirectTo}?error=${encodeURIComponent(result.error)}`);
    }
    return redirect(`${redirectTo}?removed=1`);
  }

  if (action === "revoke_invite") {
    const inviteId = formData.get("invite_id")?.toString();
    if (!inviteId) {
      return redirect(`${redirectTo}?error=1`);
    }
    const result = await revokeHouseholdInvite(manageId, inviteId);
    if (result.error) {
      return redirect(`${redirectTo}?error=1`);
    }
    return redirect(`${redirectTo}?invite_revoked=1`);
  }

  // Email invite link (does not require existing account)
  const email = formData.get("email")?.toString().trim().toLowerCase();
  if (!email) {
    return redirect(`${redirectTo}?error=missing_email`);
  }

  const role = parseHouseholdInviteRole(formData.get("role")?.toString()) ?? "member";
  if (role === "property_manager") {
    const entitlements = await getUserEntitlements(user.id);
    if (entitlements.tier !== "portfolio" && entitlements.tier !== "admin") {
      return redirect(`${redirectTo}?error=portfolio_required`);
    }
  }
  const { invite, error } = await createHouseholdInvite(manageId, email, user.id, 7, role);
  if (error || !invite) {
    return redirect(`${redirectTo}?error=1`);
  }

  const supabase = createServerClient();
  const { data: householdRow } = await supabase
    .from("households")
    .select("name")
    .eq("id", manageId)
    .maybeSingle();

  const acceptUrl = buildSiteUrl(request, `/invite/${invite.token}`);
  await sendInviteEmail(
    email,
    acceptUrl,
    householdRow?.name ?? "a household",
    user.email ?? null,
  );

  return redirect(`${redirectTo}?invited=1`);
};
