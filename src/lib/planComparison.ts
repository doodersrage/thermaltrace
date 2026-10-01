import {
  FREE_HISTORY_DAYS,
  FREE_MAX_DEVICES,
  MEMBER_HISTORY_DAYS,
  MEMBER_MAX_DEVICES,
  PORTFOLIO_MAX_OWNED_HOUSEHOLDS,
  PRO_HISTORY_DAYS,
  PRO_MAX_DEVICES,
  PRO_MAX_OWNED_HOUSEHOLDS,
  formatHistoryRetention,
  type PlanTier,
} from "./entitlements";

export type ComparisonTier = "free" | "member" | "pro" | "portfolio";

export type NudgeFeatureId =
  | "csv_export"
  | "history_charts"
  | "sms_alerts"
  | "push_alerts"
  | "webhooks"
  | "share_links"
  | "api_keys"
  | "embed_widget"
  | "status_pages"
  | "device_limit"
  | "data_retention"
  | "cold_risk"
  | "prometheus"
  | "multi_property"
  | "portfolio_scale"
  | "claims_pack"
  | "thermostat_integration";

export type PlanFeatureRow = {
  id: string;
  category: string;
  label: string;
  free: string;
  member: string;
  pro: string;
  portfolio: string;
  anchor?: string;
  emphasis?: boolean;
  cellBadge?: Partial<Record<ComparisonTier, string>>;
};

const PRO_LIKE = "Yes";

export const PLAN_FEATURE_ROWS: PlanFeatureRow[] = [
  {
    id: "push_devices",
    category: "Limits",
    label: "Push ingest devices (per property)",
    free: `${FREE_MAX_DEVICES} devices`,
    member: `${MEMBER_MAX_DEVICES} devices`,
    pro: `${PRO_MAX_DEVICES} devices`,
    portfolio: `${PRO_MAX_DEVICES} devices`,
    anchor: "push_devices",
    emphasis: true,
  },
  {
    id: "data_retention",
    category: "Limits",
    label: "Data retention",
    free: formatHistoryRetention(FREE_HISTORY_DAYS),
    member: formatHistoryRetention(MEMBER_HISTORY_DAYS),
    pro: `${formatHistoryRetention(PRO_HISTORY_DAYS)}+`,
    portfolio: `${formatHistoryRetention(PRO_HISTORY_DAYS)}+`,
    anchor: "data-retention",
    emphasis: true,
  },
  {
    id: "pull_feeds",
    category: "Limits",
    label: "Pull JSON feeds",
    free: "Unlimited",
    member: "Unlimited",
    pro: "Unlimited",
    portfolio: "Unlimited",
  },
  {
    id: "sensor_kinds",
    category: "Limits",
    label: "Sensor types",
    free: "Temp, humidity, CO₂, air quality, doors, leaks, energy, motion",
    member: "Temp, humidity, CO₂, air quality, doors, leaks, energy, motion",
    pro: "Temp, humidity, CO₂, air quality, doors, leaks, energy, motion",
    portfolio: "Temp, humidity, CO₂, air quality, doors, leaks, energy, motion",
  },
  {
    id: "alerts_basic",
    category: "Alerts",
    label: "Email, Discord, Telegram, Slack",
    free: PRO_LIKE,
    member: PRO_LIKE,
    pro: PRO_LIKE,
    portfolio: PRO_LIKE,
  },
  {
    id: "cold_risk",
    category: "Alerts",
    label: "Freeze and cold alerts",
    free: "Threshold + time-to-freeze clock",
    member: "Threshold + indoor time-to-freeze + outdoor forecast",
    pro: "Threshold + time-to-freeze + forecast + NWS",
    portfolio: "Threshold + time-to-freeze + forecast + NWS",
    anchor: "cold-risk",
    emphasis: true,
  },
  {
    id: "sms_alerts",
    category: "Alerts",
    label: "SMS alerts (Twilio)",
    free: "—",
    member: "—",
    pro: PRO_LIKE,
    portfolio: PRO_LIKE,
    anchor: "sms-alerts",
  },
  {
    id: "push_alerts",
    category: "Alerts",
    label: "Push notifications (browser + Android)",
    free: PRO_LIKE,
    member: PRO_LIKE,
    pro: PRO_LIKE,
    portfolio: PRO_LIKE,
    anchor: "push-alerts",
  },
  {
    id: "webhooks",
    category: "Alerts",
    label: "Outbound + reading webhooks",
    free: "—",
    member: "—",
    pro: PRO_LIKE,
    portfolio: PRO_LIKE,
    anchor: "webhooks",
  },
  {
    id: "inbound_webhooks",
    category: "Integrations",
    label: "Inbound snooze / status webhooks",
    free: "—",
    member: "—",
    pro: PRO_LIKE,
    portfolio: PRO_LIKE,
    anchor: "webhooks",
  },
  {
    id: "hacs_integration",
    category: "Integrations",
    label: "Home Assistant (HACS)",
    free: "—",
    member: "—",
    pro: "Share link + services",
    portfolio: "Share link + services",
    anchor: "share-links",
    emphasis: true,
  },
  {
    id: "history_charts",
    category: "History",
    label: "Charts, YoY overlay, anomaly hints",
    free: PRO_LIKE,
    member: PRO_LIKE,
    pro: PRO_LIKE,
    portfolio: PRO_LIKE,
  },
  {
    id: "csv_export",
    category: "History",
    label: "CSV export",
    free: "—",
    member: PRO_LIKE,
    pro: PRO_LIKE,
    portfolio: PRO_LIKE,
    anchor: "csv-export",
  },
  {
    id: "claims_pack",
    category: "History",
    label: "Claims / insurance evidence pack",
    free: "—",
    member: "—",
    pro: "Printable HTML + CSVs",
    portfolio: "Printable HTML + CSVs",
    anchor: "claims-pack",
    emphasis: true,
  },
  {
    id: "share_links",
    category: "Sharing",
    label: "Public share links (live, history, embed)",
    free: "1 family live link",
    member: "1 family live link",
    pro: PRO_LIKE,
    portfolio: PRO_LIKE,
    anchor: "share-links",
  },
  {
    id: "api_keys",
    category: "Sharing",
    label: "Dashboard API keys",
    free: "—",
    member: "—",
    pro: PRO_LIKE,
    portfolio: PRO_LIKE,
    anchor: "api-keys",
  },
  {
    id: "embed_widget",
    category: "Sharing",
    label: "Embeddable live widget",
    free: "—",
    member: "—",
    pro: PRO_LIKE,
    portfolio: PRO_LIKE,
    anchor: "embed-widget",
  },
  {
    id: "status_pages",
    category: "Sharing",
    label: "Public status pages + iCal feed",
    free: "—",
    member: "—",
    pro: PRO_LIKE,
    portfolio: PRO_LIKE,
    anchor: "status-pages",
  },
  {
    id: "prometheus",
    category: "Integrations",
    label: "Prometheus metrics + Grafana JSON",
    free: "—",
    member: "—",
    pro: PRO_LIKE,
    portfolio: PRO_LIKE,
    anchor: "prometheus",
  },
  {
    id: "thermostat_integration",
    category: "Integrations",
    label: "Nest / Ecobee thermostat connection",
    free: "—",
    member: "—",
    pro: PRO_LIKE,
    portfolio: PRO_LIKE,
    anchor: "thermostat-integration",
  },
  {
    id: "multi_property",
    category: "Households",
    label: "Owned properties",
    free: "1",
    member: "1",
    pro: `Up to ${PRO_MAX_OWNED_HOUSEHOLDS}`,
    portfolio: `Up to ${PORTFOLIO_MAX_OWNED_HOUSEHOLDS}`,
    anchor: "multi-property",
    emphasis: true,
  },
  {
    id: "property_manager",
    category: "Households",
    label: "Property-manager logins",
    free: "—",
    member: "—",
    pro: "—",
    portfolio: "Devices & alerts only (no billing)",
    anchor: "property-manager",
    emphasis: true,
  },
  {
    id: "portfolio_dashboard",
    category: "Households",
    label: "Cross-property freeze dashboard",
    free: "—",
    member: "—",
    pro: PRO_LIKE,
    portfolio: PRO_LIKE,
    anchor: "portfolio",
  },
  {
    id: "annual_billing",
    category: "Billing",
    label: "Annual billing discount",
    free: "—",
    member: "Save ~20%",
    pro: "Save ~20%",
    portfolio: "Save ~20%",
    anchor: "annual-billing",
  },
  {
    id: "pro_trial",
    category: "Billing",
    label: "Paid-plan free trial",
    free: "—",
    member: "—",
    pro: "14 days (+7 with referral)",
    portfolio: "14 days (+7 with referral)",
  },
];

const TIER_RANK: Record<PlanTier, number> = {
  free: 0,
  member: 1,
  pro: 2,
  portfolio: 3,
  admin: 4,
};

const NUDGE_CONFIG: Record<
  NudgeFeatureId,
  { targetTier: ComparisonTier; title: string; body: string; anchor: string; href?: string }
> = {
  csv_export: {
    targetTier: "member",
    title: "Export history as CSV",
    body: "Member unlocks CSV download of your retained readings, handy for insurance docs and HVAC tuning.",
    anchor: "csv-export",
  },
  history_charts: {
    targetTier: "member",
    title: "Keep more history at your fingertips",
    body: "Member includes CSV export and full chart tooling. Free accounts still see live data and recent charts.",
    anchor: "csv-export",
  },
  sms_alerts: {
    targetTier: "pro",
    title: "Get freeze and leak alerts by SMS",
    body: "Pro adds Twilio SMS, critical when email isn't fast enough during a cold snap or a wet contact.",
    anchor: "sms-alerts",
  },
  push_alerts: {
    targetTier: "pro",
    title: "Browser push on this device",
    body: "Browser push is on every plan, so alerts reach you even when the dashboard isn't open.",
    anchor: "push-alerts",
  },
  webhooks: {
    targetTier: "pro",
    title: "Wire alerts into Home Assistant or Zapier",
    body: "Pro adds outbound alert webhooks, reading webhooks on ingest, inbound snooze/status endpoints, and the official Home Assistant HACS integration.",
    anchor: "webhooks",
  },
  share_links: {
    targetTier: "pro",
    title: "More share scopes for guests and Grafana",
    body: "Free already includes one family live link. Pro adds history, metrics, embeds, and never-expire links.",
    anchor: "share-links",
  },
  api_keys: {
    targetTier: "pro",
    title: "API keys for Grafana and scripts",
    body: "Pro includes dashboard API keys and a downloadable Grafana dashboard JSON.",
    anchor: "api-keys",
  },
  embed_widget: {
    targetTier: "pro",
    title: "Embed live temps on your site",
    body: "Pro share links can power an embeddable widget for a family portal or workshop page.",
    anchor: "embed-widget",
  },
  status_pages: {
    targetTier: "pro",
    title: "Public status page",
    body: "Pro households can publish a tokenized status page and iCal freeze outlook feed.",
    anchor: "status-pages",
  },
  device_limit: {
    targetTier: "pro",
    title: "Need more push devices?",
    body: `Free allows ${FREE_MAX_DEVICES} push devices per property, Member ${MEMBER_MAX_DEVICES}, Pro ${PRO_MAX_DEVICES}: upgrade when you outgrow the limit.`,
    anchor: "push_devices",
  },
  data_retention: {
    targetTier: "member",
    title: "Keep a longer history window",
    body: `Free keeps ${formatHistoryRetention(FREE_HISTORY_DAYS)} of readings. Member extends that to ${formatHistoryRetention(MEMBER_HISTORY_DAYS)}; Pro keeps ${formatHistoryRetention(PRO_HISTORY_DAYS)}+ for seasonal and year-over-year compare.`,
    anchor: "data-retention",
  },
  cold_risk: {
    targetTier: "member",
    title: "Get ahead of freeze nights",
    body: "Every plan has a time-to-freeze clock for this unheated space. Member adds outdoor forecast freeze warnings. Pro adds official NWS freeze and cold alerts.",
    anchor: "cold-risk",
  },
  prometheus: {
    targetTier: "pro",
    title: "Scrape metrics into Grafana",
    body: "Pro unlocks Prometheus-format metrics and API keys for your observability stack.",
    anchor: "prometheus",
  },
  multi_property: {
    targetTier: "pro",
    title: "Monitoring a second property?",
    body: `Pro supports up to ${PRO_MAX_OWNED_HOUSEHOLDS} owned properties: vacation home, rental unit, or workshop.`,
    anchor: "multi-property",
  },
  portfolio_scale: {
    targetTier: "portfolio",
    title: "Running a larger property portfolio?",
    body: `Portfolio raises the owned-property ceiling to ${PORTFOLIO_MAX_OWNED_HOUSEHOLDS} and adds property-manager logins for on-site staff.`,
    anchor: "portfolio",
  },
  claims_pack: {
    targetTier: "pro",
    title: "Export a claims evidence pack",
    body: "Pro builds a printable freeze/leak summary with matching readings and alert-event CSVs for a date range you choose.",
    anchor: "claims-pack",
    href: "/claims-pack",
  },
  thermostat_integration: {
    targetTier: "pro",
    title: "Connect your Nest or Ecobee",
    body: "Pro shows your house thermostat's reading and setpoint alongside this probe, and adds that context to freeze alerts.",
    anchor: "thermostat-integration",
  },
};

export function tierRank(tier: PlanTier): number {
  return TIER_RANK[tier] ?? 0;
}

export function normalizeComparisonTier(tier: PlanTier): ComparisonTier {
  if (tier === "admin" || tier === "portfolio") return "portfolio";
  if (tier === "pro") return "pro";
  if (tier === "member") return "member";
  return "free";
}

export function getNudgeContent(
  tier: PlanTier,
  feature: NudgeFeatureId,
): {
  targetTier: ComparisonTier;
  title: string;
  body: string;
  compareHref: string;
  dismissKey: string;
} | null {
  if (tier === "admin") return null;

  const config = NUDGE_CONFIG[feature];
  if (!config) return null;

  const current = normalizeComparisonTier(tier);
  const targetRank = TIER_RANK[config.targetTier];
  const currentRank = TIER_RANK[current];
  if (currentRank >= targetRank) return null;

  return {
    ...config,
    compareHref: config.href ?? `/pricing#${config.anchor}`,
    dismissKey: `nudge-${feature}`,
  };
}

export function nextUpgradeTier(tier: PlanTier): ComparisonTier | null {
  if (tier === "admin" || tier === "portfolio") return null;
  if (tier === "pro") return "portfolio";
  if (tier === "member") return "pro";
  return "member";
}
