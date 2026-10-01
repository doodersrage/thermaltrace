import {
  isUserAdmin,
  isUserInGroup,
  MEMBER_GROUP_NAME,
} from "./adminAccess";

export { resolvePlanTierFromPriceId } from "./planTier";

export const PRO_GROUP_NAME = "pro";
export const PORTFOLIO_GROUP_NAME = "portfolio";

export type PlanTier = "free" | "member" | "pro" | "portfolio" | "admin";

export const FREE_MAX_DEVICES = 2;
export const MEMBER_MAX_DEVICES = 6;
export const PRO_MAX_DEVICES = 24;

export const FREE_HISTORY_DAYS = 7;
export const MEMBER_HISTORY_DAYS = 90;
export const PRO_HISTORY_DAYS = 365;

const FREE_MAX_OWNED_HOUSEHOLDS = 1;
const MEMBER_MAX_OWNED_HOUSEHOLDS = 1;
export const PRO_MAX_OWNED_HOUSEHOLDS = 50;
/** Portfolio tier -- landlords/property managers running many properties. */
export const PORTFOLIO_MAX_OWNED_HOUSEHOLDS = 500;

export type Entitlements = {
  tier: PlanTier;
  canDownloadCsv: boolean;
  canUseSms: boolean;
  canUsePush: boolean;
  canUseOutboundWebhook: boolean;
  /** Pro+: unlimited share scopes (live, history, metrics) and never-expire links. */
  canCreateShareLinks: boolean;
  /** All tiers: one live family share link (expiring). */
  canCreateFamilyShareLink: boolean;
  canUseClaimsPack: boolean;
  canUsePortfolio: boolean;
  canUseForecastAlerts: boolean;
  canUseNwsAlerts: boolean;
  canUseThermostatIntegration: boolean;
  maxDevices: number;
  maxOwnedHouseholds: number;
  historyDays: number;
};

function entitlementsFor(tier: PlanTier): Entitlements {
  const memberOrAbove =
    tier === "member" || tier === "pro" || tier === "portfolio" || tier === "admin";
  // Portfolio is a strict superset of Pro -- same feature gates, higher property
  // ceiling. See the plan doc for why the ceiling doesn't come at the expense of
  // lowering Pro's existing cap.
  const proOrAbove = tier === "pro" || tier === "portfolio" || tier === "admin";
  const portfolioOrAbove = tier === "portfolio" || tier === "admin";

  return {
    tier,
    canDownloadCsv: memberOrAbove,
    canUseSms: proOrAbove,
    // Push costs nothing to send, and an alert that wakes you up is the product.
    canUsePush: true,
    canUseOutboundWebhook: proOrAbove,
    canCreateShareLinks: proOrAbove,
    canCreateFamilyShareLink: true,
    canUseClaimsPack: proOrAbove,
    canUsePortfolio: proOrAbove,
    canUseForecastAlerts: memberOrAbove,
    canUseNwsAlerts: proOrAbove,
    canUseThermostatIntegration: proOrAbove,
    maxDevices: proOrAbove
      ? PRO_MAX_DEVICES
      : memberOrAbove
        ? MEMBER_MAX_DEVICES
        : FREE_MAX_DEVICES,
    maxOwnedHouseholds: portfolioOrAbove
      ? PORTFOLIO_MAX_OWNED_HOUSEHOLDS
      : proOrAbove
        ? PRO_MAX_OWNED_HOUSEHOLDS
        : memberOrAbove
          ? MEMBER_MAX_OWNED_HOUSEHOLDS
          : FREE_MAX_OWNED_HOUSEHOLDS,
    historyDays: proOrAbove
      ? PRO_HISTORY_DAYS
      : memberOrAbove
        ? MEMBER_HISTORY_DAYS
        : FREE_HISTORY_DAYS,
  };
}

export function formatHistoryRetention(days: number): string {
  if (days >= 365) {
    const years = days / 365;
    return years === 1 ? "1 year" : `${Number.isInteger(years) ? years : years.toFixed(1)} years`;
  }
  return `${days} days`;
}

export async function getUserEntitlements(userId: string): Promise<Entitlements> {
  const [admin, portfolio, pro, member] = await Promise.all([
    isUserAdmin(userId),
    isUserInGroup(userId, PORTFOLIO_GROUP_NAME),
    isUserInGroup(userId, PRO_GROUP_NAME),
    isUserInGroup(userId, MEMBER_GROUP_NAME),
  ]);

  if (admin) return entitlementsFor("admin");
  if (portfolio) return entitlementsFor("portfolio");
  if (pro) return entitlementsFor("pro");
  if (member) return entitlementsFor("member");
  return entitlementsFor("free");
}
