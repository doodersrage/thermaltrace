import type { APIRoute } from "astro";
import { getAuthFromRequest } from "../../../lib/auth";
import { getUserEntitlements } from "../../../lib/entitlements";
import { getSiteUrl } from "../../../lib/stripe";
import { formRedirectPath } from "../../../lib/siteUrl";
import { generateClaimsPackForUser } from "../../../lib/claimsPackGenerate";
import { createClaimsPackExport } from "../../../lib/claimsPackExports";
import { sendEmail, isMailerRecipientNotAllowed } from "../../../lib/mailer";
import { brandedEmailParts } from "../../../lib/emailLayout";

function wantsJson(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  const contentType = request.headers.get("content-type") ?? "";
  return accept.includes("application/json") || contentType.includes("application/json");
}

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const { session, user } = await getAuthFromRequest(request, cookies);
  const asJson = wantsJson(request);

  if (!session || !user) {
    if (asJson) return jsonResponse({ error: "Unauthorized" }, 401);
    return redirect("/signin");
  }

  let adjusterEmail = "";
  let fromDate: string | undefined;
  let toDate: string | undefined;
  let redirectTo = "/dashboard/history";

  if (asJson) {
    let body: { adjuster_email?: string; from?: string; to?: string };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return jsonResponse({ error: "Invalid JSON" }, 400);
    }
    adjusterEmail = body.adjuster_email?.trim() ?? "";
    fromDate = body.from?.trim();
    toDate = body.to?.trim();
  } else {
    const formData = await request.formData();
    redirectTo = formRedirectPath(formData, "/dashboard/history");
    adjusterEmail = formData.get("adjuster_email")?.toString().trim() ?? "";
    fromDate = formData.get("from")?.toString();
    toDate = formData.get("to")?.toString();
  }

  // Same gate as the existing authenticated download route
  // (api/claims/pack.ts) -- that route has no extra household-role check
  // today, so this matches it rather than introducing a stricter,
  // inconsistent gate for the same underlying report.
  const entitlements = await getUserEntitlements(user.id);
  if (!entitlements.canUseClaimsPack) {
    if (asJson) return jsonResponse({ error: "pro_required" }, 403);
    return redirect(`${redirectTo}?claims_error=pro_required`);
  }

  if (!adjusterEmail || !adjusterEmail.includes("@")) {
    if (asJson) return jsonResponse({ error: "invalid_email" }, 400);
    return redirect(`${redirectTo}?claims_error=invalid_email`);
  }

  const siteUrl = getSiteUrl(request).replace(/\/$/, "");
  const { pack, householdId } = await generateClaimsPackForUser(
    user,
    entitlements,
    { from: fromDate, to: toDate },
    siteUrl,
  );

  if (!householdId) {
    if (asJson) return jsonResponse({ error: "no_household" }, 400);
    return redirect(`${redirectTo}?claims_error=no_household`);
  }

  const { token, contentHash, error } = await createClaimsPackExport(
    householdId,
    pack,
    user.id,
  );
  if (!token) {
    console.error("Failed to persist claims pack export for email:", error);
    if (asJson) return jsonResponse({ error: "send_failed" }, 500);
    return redirect(`${redirectTo}?claims_error=send_failed`);
  }

  const verifyUrl = `${siteUrl}/api/claims/pack/${token}`;
  const rangeLabel = `${pack.rangeFrom.slice(0, 10)} to ${pack.rangeTo.slice(0, 10)}`;

  try {
    const parts = brandedEmailParts({
      eyebrow: "Claims pack",
      preheader: `A ThermalTrace freeze-exposure report for ${pack.householdLabel} is ready to view.`,
      title: `Claims pack: ${pack.householdLabel}`,
      intro: `A ThermalTrace household member shared a freeze-exposure and alert-history report covering ${rangeLabel}.`,
      paragraphs: [
        "The report includes freeze-exposure stats, device and probe tables, and a timeline of critical alerts for the selected period, with a verification code so this specific export can be reconfirmed later.",
        `Verification code: ${contentHash}`,
      ],
      cta: { label: "View claims pack", url: verifyUrl },
      secondaryCta: pack.historyUrl
        ? { label: "Open this window on History", url: pack.historyUrl }
        : undefined,
      tone: "brand",
      footerNote:
        "This report was sent by a ThermalTrace household member. It's a monitoring summary, not a certified inspection -- see the report itself for full context.",
    });
    await sendEmail(adjusterEmail, `Claims pack: ${pack.householdLabel}`, parts.text, {
      html: parts.html,
    });
  } catch (err) {
    if (isMailerRecipientNotAllowed(err)) {
      if (asJson) return jsonResponse({ error: "recipient_not_allowed" }, 400);
      return redirect(`${redirectTo}?claims_error=recipient_not_allowed`);
    }
    console.error("Failed to send claims pack email:", err);
    if (asJson) return jsonResponse({ error: "send_failed" }, 500);
    return redirect(`${redirectTo}?claims_error=send_failed`);
  }

  if (asJson) {
    return jsonResponse({
      ok: true,
      verify_url: verifyUrl,
      verification_code: contentHash,
    });
  }

  return redirect(`${redirectTo}?claims_emailed=1`);
};
