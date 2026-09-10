import { createServerClient } from "./supabase";

export type HouseholdRole =
  | "owner"
  | "member"
  | "viewer"
  | "alert_only"
  | "property_manager";

export type Household = {
  id: string;
  name: string;
  created_at: string;
};

export type HouseholdMember = {
  id: string;
  household_id: string;
  user_id: string;
  role: HouseholdRole;
  created_at: string;
  email?: string | null;
  digest_opt_in?: boolean;
};

export type UserHousehold = {
  household_id: string;
  role: HouseholdRole;
  name: string;
};

export async function getOrCreateHouseholdForUser(
  userId: string,
  email?: string | null,
): Promise<{ householdId: string; error: string | null }> {
  const preferred = await getPreferredHouseholdId(userId);
  if (preferred) {
    return { householdId: preferred, error: null };
  }

  const owned = await getOwnedHouseholdId(userId);
  if (owned) {
    return { householdId: owned, error: null };
  }

  const name = `${(email ?? "My").split("@")[0]}'s household`;
  const supabase = createServerClient();
  const { data: household, error: createError } = await supabase
    .from("households")
    .insert({ name })
    .select("id")
    .single();

  if (createError || !household) {
    return { householdId: "", error: createError?.message ?? "Failed to create household" };
  }

  const { error: memberError } = await supabase.from("household_members").insert({
    household_id: household.id,
    user_id: userId,
    role: "owner",
  });

  if (memberError) {
    return { householdId: "", error: memberError.message };
  }

  return { householdId: household.id, error: null };
}

export async function getOwnedHouseholdId(userId: string): Promise<string | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .order("created_at", { ascending: true });

  if (!data || data.length === 0) return null;

  // Prefer active household when the user owns multiple properties
  try {
    const { createAdminClient } = await import("./supabase");
    const admin = createAdminClient();
    const { data: authData } = await admin.auth.admin.getUserById(userId);
    const active = authData.user?.user_metadata?.active_household_id;
    if (
      typeof active === "string" &&
      data.some((row) => row.household_id === active)
    ) {
      return active;
    }
  } catch {
    // fall through to first owned
  }

  return data[0]?.household_id ?? null;
}

export async function countOwnedHouseholds(userId: string): Promise<number> {
  const supabase = createServerClient();
  const { count, error } = await supabase
    .from("household_members")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "owner");

  if (error) {
    console.error("countOwnedHouseholds failed:", error.message);
    return 0;
  }

  return count ?? 0;
}

export async function listUserHouseholds(
  userId: string,
): Promise<{ households: UserHousehold[]; error: string | null }> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("household_id, role, households(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    return { households: [], error: error.message };
  }

  const households: UserHousehold[] = (data ?? []).map((row) => {
    const nested = row.households as { name?: string } | { name?: string }[] | null;
    const name = Array.isArray(nested)
      ? nested[0]?.name
      : nested?.name;
    return {
      household_id: row.household_id,
      role: row.role as HouseholdRole,
      name: name ?? "Household",
    };
  });

  return { households, error: null };
}

async function getPreferredHouseholdId(userId: string): Promise<string | null> {
  const supabase = createServerClient();
  const { data: memberRows } = await supabase
    .from("household_members")
    .select("household_id, role")
    .eq("user_id", userId);

  if (!memberRows || memberRows.length === 0) return null;

  const membershipIds = new Set(memberRows.map((row) => row.household_id));

  // Prefer explicit active_household_id from auth metadata when valid
  try {
    const { createAdminClient } = await import("./supabase");
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(userId);
    const active = data.user?.user_metadata?.active_household_id;
    if (typeof active === "string" && membershipIds.has(active)) {
      return active;
    }
  } catch {
    // ignore — fall through
  }

  // Prefer a household that already has devices (shared homes)
  const { data: devices } = await supabase
    .from("devices")
    .select("household_id")
    .in("household_id", [...membershipIds])
    .limit(50);

  if (devices && devices.length > 0) {
    const withDevices = new Set(devices.map((d) => d.household_id));
    const shared = memberRows.find(
      (row) => row.role === "member" && withDevices.has(row.household_id),
    );
    if (shared) return shared.household_id;
    const any = memberRows.find((row) => withDevices.has(row.household_id));
    if (any) return any.household_id;
  }

  const owner = memberRows.find((row) => row.role === "owner");
  return (owner ?? memberRows[0]).household_id;
}

export async function getUserHouseholdId(
  userId: string,
): Promise<string | null> {
  return getPreferredHouseholdId(userId);
}

export async function setActiveHouseholdForUser(
  userId: string,
  householdId: string,
): Promise<{ error: string | null }> {
  if (!(await isUserInHousehold(userId, householdId))) {
    return { error: "Not a member of that household" };
  }

  const { createAdminClient } = await import("./supabase");
  const admin = createAdminClient();
  const { data } = await admin.auth.admin.getUserById(userId);
  const existing = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
  const { error } = await admin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...existing,
      active_household_id: householdId,
    },
  });

  return { error: error?.message ?? null };
}

export async function listHouseholdMembers(
  householdId: string,
): Promise<{ members: HouseholdMember[]; error: string | null }> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("id, household_id, user_id, role, created_at, digest_opt_in")
    .eq("household_id", householdId)
    .order("created_at", { ascending: true });

  if (error) {
    return { members: [], error: error.message };
  }

  return { members: (data ?? []) as HouseholdMember[], error: null };
}

export async function getUserHouseholdRole(
  userId: string,
  householdId: string,
): Promise<HouseholdRole | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("household_members")
    .select("role")
    .eq("user_id", userId)
    .eq("household_id", householdId)
    .maybeSingle();
  return (data?.role as HouseholdRole | undefined) ?? null;
}

export function canEditHousehold(role: HouseholdRole | null): boolean {
  return role === "owner" || role === "member" || role === "property_manager";
}

/** Billing, invites, share links, API keys — owner and full members only. */
export function canManageHousehold(role: HouseholdRole | null): boolean {
  return role === "owner" || role === "member";
}

export function canViewAlerts(role: HouseholdRole | null): boolean {
  return role != null;
}

export async function createAdditionalHouseholdForUser(
  userId: string,
  name: string,
): Promise<{ householdId: string; error: string | null }> {
  const supabase = createServerClient();
  const trimmed = name.trim() || "My property";
  const { data: household, error: createError } = await supabase
    .from("households")
    .insert({ name: trimmed })
    .select("id")
    .single();

  if (createError || !household) {
    return { householdId: "", error: createError?.message ?? "Failed to create household" };
  }

  const { error: memberError } = await supabase.from("household_members").insert({
    household_id: household.id,
    user_id: userId,
    role: "owner",
  });

  if (memberError) {
    return { householdId: "", error: memberError.message };
  }

  await setActiveHouseholdForUser(userId, household.id);
  return { householdId: household.id, error: null };
}

export async function isUserInHousehold(
  userId: string,
  householdId: string,
): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("household_members")
    .select("id")
    .eq("user_id", userId)
    .eq("household_id", householdId)
    .maybeSingle();

  return Boolean(data);
}

export async function addHouseholdMemberByUserId(
  householdId: string,
  userId: string,
  role: HouseholdRole = "member",
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { error } = await supabase.from("household_members").upsert(
    {
      household_id: householdId,
      user_id: userId,
      role,
    },
    { onConflict: "household_id,user_id" },
  );

  return { error: error?.message ?? null };
}

export async function removeHouseholdMember(
  householdId: string,
  userId: string,
): Promise<{ error: string | null }> {
  const supabase = createServerClient();

  const { data: member } = await supabase
    .from("household_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();

  if (member?.role === "owner") {
    return { error: "Cannot remove the household owner" };
  }

  const { error } = await supabase
    .from("household_members")
    .delete()
    .eq("household_id", householdId)
    .eq("user_id", userId);

  return { error: error?.message ?? null };
}

/** Member leaves their current household (not allowed for owners). */
export async function leaveHousehold(
  userId: string,
  householdId: string,
): Promise<{ error: string | null }> {
  const result = await removeHouseholdMember(householdId, userId);
  if (result.error) {
    return result;
  }

  const remaining = await listUserHouseholds(userId);
  const next = remaining.households[0]?.household_id ?? null;
  if (next) {
    await setActiveHouseholdForUser(userId, next);
  } else {
    // Fall back to owned household or recreate personal one
    const owned = await getOwnedHouseholdId(userId);
    if (owned) {
      await setActiveHouseholdForUser(userId, owned);
    }
  }

  return { error: null };
}

export async function updateHouseholdName(
  householdId: string,
  name: string,
): Promise<{ error: string | null }> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("households")
    .update({ name: name.trim() || "My household" })
    .eq("id", householdId);

  return { error: error?.message ?? null };
}

export async function listAllHouseholdOwnerUserIds(): Promise<string[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("role", "owner");

  if (error || !data) return [];
  return [...new Set(data.map((row) => row.user_id))];
}

/** Unique households that should be polled by cron (those with devices, else all owned). */
export async function listHouseholdIdsForCron(): Promise<
  Array<{ householdId: string; ownerUserId: string }>
> {
  const supabase = createServerClient();
  const { data: owners } = await supabase
    .from("household_members")
    .select("household_id, user_id")
    .eq("role", "owner");

  if (!owners || owners.length === 0) return [];

  const rows = owners.map((row) => ({
    householdId: row.household_id,
    ownerUserId: row.user_id,
  }));

  // Deduplicate by household
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.householdId)) return false;
    seen.add(row.householdId);
    return true;
  });
}
