const LIVE_PREFIX = "/dashboard/live";

function normalizeDashboardPath(path: string): string {
  const trimmed = path.trim().split(/[?#]/)[0] ?? path;
  if (trimmed.length > 1 && trimmed.endsWith("/")) {
    return trimmed.slice(0, -1);
  }
  return trimmed || "/";
}

function isLivePath(path: string): boolean {
  const normalized = normalizeDashboardPath(path);
  return normalized === LIVE_PREFIX || normalized.startsWith(`${LIVE_PREFIX}/`);
}

function isRecordableKioskPath(path: string): boolean {
  const normalized = normalizeDashboardPath(path);
  return (
    isLivePath(normalized) ||
    normalized === "/dashboard/portfolio" ||
    normalized.startsWith("/dashboard/portfolio/")
  );
}

/**
 * Kiosk is a glance surface. Overview and account pages jump to Live
 * (or the last Live/Portfolio route). Already on Live stays put.
 */
export function kioskLandingPath(
  currentPath: string,
  lastKioskPath: string | null | undefined,
): string {
  const current = normalizeDashboardPath(currentPath);
  if (isLivePath(current) || isRecordableKioskPath(current)) return current;

  if (lastKioskPath && isRecordableKioskPath(lastKioskPath)) {
    return normalizeDashboardPath(lastKioskPath);
  }

  return LIVE_PREFIX;
}

export function kioskRouteToRecord(currentPath: string): string | null {
  const current = normalizeDashboardPath(currentPath);
  return isRecordableKioskPath(current) ? current : null;
}

export const KIOSK_STORAGE_KEY = "tt-kiosk-mode";
export const KIOSK_ROUTE_STORAGE_KEY = "tt-kiosk-route";
