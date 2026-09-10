/** Default post-auth destination for new accounts — connect a probe first. */
export const REGISTER_NEXT_DEVICES = "/dashboard/devices";

export type RegisterUrlOptions = {
  next?: string | null;
  ref?: string | null;
  /** Extra query params (e.g. email). */
  params?: Record<string, string | undefined | null>;
};

/** Build `/register?...` with a safe `next` (defaults to Devices). */
export function buildRegisterHref(options: RegisterUrlOptions = {}): string {
  const params = new URLSearchParams();
  const next = sanitizeRegisterNext(options.next) ?? REGISTER_NEXT_DEVICES;
  params.set("next", next);

  const ref = options.ref?.trim().toLowerCase();
  if (ref) params.set("ref", ref);

  for (const [key, value] of Object.entries(options.params ?? {})) {
    const trimmed = value?.trim();
    if (trimmed) params.set(key, trimmed);
  }

  return `/register?${params.toString()}`;
}

export function sanitizeRegisterNext(next: string | null | undefined): string | null {
  if (!next) return null;
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
  return trimmed;
}
