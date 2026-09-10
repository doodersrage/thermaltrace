/** Tab-aware dashboard hrefs so hashes land on the pane that actually contains them. */

export function alertsSettingsPath(hash: string): string {
  const id = hash.replace(/^#/, "");
  return `/dashboard/alerts?tab=settings#${id}`;
}

export function alertsActivityPath(): string {
  return "/dashboard/alerts?tab=activity";
}

export function historyExportsPath(hash = "claims-pack"): string {
  const id = hash.replace(/^#/, "");
  return `/dashboard/history?tab=exports#${id}`;
}

export function devicesOpsPath(hash?: string): string {
  const suffix = hash ? `#${hash.replace(/^#/, "")}` : "";
  return `/dashboard/devices?view=ops${suffix}`;
}

export function devicesSetupPath(opts?: {
  tab?: "push" | "pull";
  hash?: string;
}): string {
  const params = new URLSearchParams({ view: "setup" });
  if (opts?.tab) params.set("tab", opts.tab);
  const suffix = opts?.hash ? `#${opts.hash.replace(/^#/, "")}` : "";
  return `/dashboard/devices?${params.toString()}${suffix}`;
}
