import { createServerClient } from "./supabase";

export function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

/** Cheap syntactic gate — not a full RFC parser. */
export function isPlausibleEmailAddress(email: string): boolean {
  const value = normalizeEmailAddress(email);
  if (!value || value.length > 254) return false;
  if (value.includes("..") || value.startsWith(".") || value.endsWith(".")) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
  return !isNonDeliverableEmailAddress(value);
}

/**
 * Addresses that look syntactically valid but never accept mail
 * (noreply aliases, GitHub no-reply, etc.).
 */
export function isNonDeliverableEmailAddress(email: string): boolean {
  const value = normalizeEmailAddress(email);
  const [local = "", domain = ""] = value.split("@");
  if (!domain) return true;
  if (local === "noreply" || local === "no-reply" || local.startsWith("noreply+")) {
    return true;
  }
  if (
    domain === "users.noreply.github.com" ||
    domain.endsWith(".noreply.github.com") ||
    domain === "noreply.github.com"
  ) {
    return true;
  }
  if (domain.startsWith("noreply.") || domain.includes(".noreply.")) {
    return true;
  }
  return false;
}

/** Cloudflare / mailer failures that should stop future sends to this address. */
export function isMailDeliveryBounceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    /bounce/i.test(message) ||
    /E_RECIPIENT_SUPPRESSED/i.test(message) ||
    /recipient.?suppressed/i.test(message) ||
    /email address is suppressed/i.test(message) ||
    /cannot retry/i.test(message) ||
    /invalid.?recipient/i.test(message) ||
    /mailbox.?unavailable/i.test(message) ||
    /user.?unknown/i.test(message) ||
    /address.?rejected/i.test(message)
  );
}

export async function isEmailSuppressed(email: string): Promise<boolean> {
  const normalized = normalizeEmailAddress(email);
  if (!normalized) return false;
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("email_suppressions")
      .select("email")
      .eq("email", normalized)
      .maybeSingle();
    if (error) {
      // Table missing / RLS — fail open so transactional mail still works.
      console.error("email suppression lookup failed:", error.message);
      return false;
    }
    return Boolean(data?.email);
  } catch (error) {
    console.error("email suppression lookup failed:", error);
    return false;
  }
}

export async function suppressEmail(
  email: string,
  reason = "bounce",
  lastError?: string | null,
): Promise<void> {
  const normalized = normalizeEmailAddress(email);
  if (!normalized || !isPlausibleEmailAddress(normalized)) return;
  try {
    const supabase = createServerClient();
    const { error } = await supabase.from("email_suppressions").upsert(
      {
        email: normalized,
        reason,
        last_error: lastError?.slice(0, 500) ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" },
    );
    if (error) {
      console.error("email suppression upsert failed:", error.message);
    }
  } catch (error) {
    console.error("email suppression upsert failed:", error);
  }
}
