import type { User, Session } from "@supabase/supabase-js";
import type { AstroCookies } from "astro";
import { getAuthFromCookies } from "./auth";
import { isUserAdmin } from "./adminAccess";
import { getUserEntitlements, type Entitlements } from "./entitlements";
import { countUnacknowledgedAlerts } from "./alertEvents";
import {
  getOrCreateHouseholdForUser,
  listUserHouseholds,
  type UserHousehold,
} from "./households";
import {
  fetchLatestSensorValues,
  type LatestSensorRow,
} from "./sensorReadings";
import { formatRelativeAge } from "./relativeTime";

export type DashboardShell = {
  session: Session;
  user: User;
  isAdmin: boolean;
  entitlements: Entitlements;
  unackedAlerts: number;
  households: UserHousehold[];
  householdCount: number;
  showPortfolioInMonitor: boolean;
  liveLagging: boolean;
  activeHouseholdId: string | null;
  /** Present when live-lag was computed; reuse to avoid a second latest fetch. */
  latest: LatestSensorRow[] | null;
};

export type DashboardShellOptions = {
  includeLiveLag?: boolean;
};

/**
 * Shared dashboard chrome data. Prefer Astro.locals.dashboardShell from middleware
 * so Overview/Devices/etc. do not re-fetch entitlements/unacked/households/latest.
 */
export async function loadDashboardShell(
  cookies: AstroCookies,
  opts?: DashboardShellOptions,
): Promise<DashboardShell | null> {
  const { session, user } = await getAuthFromCookies(cookies);
  if (!session || !user) return null;
  return loadDashboardShellForUser(user, session, opts);
}

export async function loadDashboardShellForUser(
  user: User,
  session: Session,
  opts?: DashboardShellOptions,
): Promise<DashboardShell> {
  const includeLiveLag = opts?.includeLiveLag ?? true;

  const [isAdmin, entitlements, unackedAlerts, userHouseholds, household] =
    await Promise.all([
      isUserAdmin(user.id),
      getUserEntitlements(user.id),
      countUnacknowledgedAlerts(user.id),
      listUserHouseholds(user.id),
      getOrCreateHouseholdForUser(user.id, user.email),
    ]);

  const households = userHouseholds.households;
  const householdCount = households.length;
  const showPortfolioInMonitor =
    entitlements.canUsePortfolio || householdCount >= 2;
  const activeHouseholdId = household.householdId;

  let liveLagging = false;
  let latest: LatestSensorRow[] | null = null;
  if (includeLiveLag && activeHouseholdId) {
    latest = await fetchLatestSensorValues(activeHouseholdId);
    liveLagging =
      latest.length === 0 ||
      latest.some((row) => {
        if (!row.recorded_at) return true;
        return formatRelativeAge(row.recorded_at).lagging;
      });
  }

  return {
    session,
    user,
    isAdmin,
    entitlements,
    unackedAlerts,
    households,
    householdCount,
    showPortfolioInMonitor,
    liveLagging,
    activeHouseholdId,
    latest,
  };
}

export function planLabelForEntitlements(entitlements: Entitlements): string {
  if (entitlements.tier === "admin") return "Admin";
  return entitlements.tier.charAt(0).toUpperCase() + entitlements.tier.slice(1);
}

/** Prefer shell.latest when it matches this household. */
export function latestFromShell(
  shell: DashboardShell | null | undefined,
  householdId: string | null | undefined,
): LatestSensorRow[] | null {
  if (!shell?.latest || !householdId) return null;
  if (shell.activeHouseholdId !== householdId) return null;
  return shell.latest;
}

export function computeLiveLagging(latest: LatestSensorRow[]): boolean {
  if (latest.length === 0) return true;
  return latest.some((row) => {
    if (!row.recorded_at) return true;
    return formatRelativeAge(row.recorded_at).lagging;
  });
}
