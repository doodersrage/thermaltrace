export const ADMIN_DASHBOARD_TABS = [
  { id: "ops", label: "Overview", href: "/dashboard/ops" },
  { id: "feeds", label: "Feed health", href: "/dashboard/feeds" },
  { id: "jobs", label: "Jobs", href: "/dashboard/jobs" },
  { id: "email", label: "Email suppressions", href: "/dashboard/email-suppressions" },
  { id: "users", label: "Users", href: "/dashboard/users" },
  { id: "contacts", label: "Contacts", href: "/dashboard/contacts" },
] as const;

export type AdminDashboardTabId = (typeof ADMIN_DASHBOARD_TABS)[number]["id"];

const ADMIN_HREFS = ADMIN_DASHBOARD_TABS.map((tab) => tab.href);

export function isAdminDashboardPath(pathname: string): boolean {
  return ADMIN_HREFS.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
}

export function adminTabIdFromPath(pathname: string): AdminDashboardTabId {
  const match = [...ADMIN_DASHBOARD_TABS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`));
  return match?.id ?? "ops";
}

export type MobileMonitorHref =
  | "/dashboard"
  | "/dashboard/live"
  | "/dashboard/portfolio"
  | "/dashboard/devices"
  | "/dashboard/alerts"
  | "/dashboard/history";

/** Five-slot phone bar. Portfolio replaces History when it belongs in Monitor. */
export function mobileMonitorHrefs(
  showPortfolioInMonitor: boolean,
): MobileMonitorHref[] {
  if (showPortfolioInMonitor) {
    return [
      "/dashboard",
      "/dashboard/live",
      "/dashboard/portfolio",
      "/dashboard/devices",
      "/dashboard/alerts",
    ];
  }
  return [
    "/dashboard",
    "/dashboard/live",
    "/dashboard/devices",
    "/dashboard/alerts",
    "/dashboard/history",
  ];
}

export function newestRecordedAt(
  rows: Array<{ recorded_at?: string | null }>,
): string | null {
  let newest: string | null = null;
  let newestMs = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    if (!row.recorded_at) continue;
    const ms = Date.parse(row.recorded_at);
    if (!Number.isFinite(ms) || ms <= newestMs) continue;
    newestMs = ms;
    newest = row.recorded_at;
  }
  return newest;
}
