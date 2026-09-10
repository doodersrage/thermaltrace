import type { APIRoute } from "astro";
import { getAuthFromRequest } from "../../../lib/auth";
import { createChartShare } from "../../../lib/chartShare";
import { getUserEntitlements } from "../../../lib/entitlements";
import { buildSiteUrl } from "../../../lib/siteUrl";

export const POST: APIRoute = async ({ request, cookies }) => {
  const { session, user } = await getAuthFromRequest(request, cookies);
  if (!session || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const entitlements = await getUserEntitlements(user.id);
  if (!entitlements.canDownloadCsv) {
    return new Response(JSON.stringify({ error: "Upgrade required for chart share" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const contentType = request.headers.get("content-type") ?? "";
  let pngBytes: ArrayBuffer | null = null;
  let title: string | undefined;

  if (contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as { pngBase64?: string; title?: string };
      if (!body.pngBase64) {
        return new Response(JSON.stringify({ error: "pngBase64 required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      const raw = body.pngBase64.replace(/^data:image\/png;base64,/, "");
      const binary = atob(raw);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      pngBytes = bytes.buffer;
      title = body.title;
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    const form = await request.formData();
    const file = form.get("png");
    title = form.get("title")?.toString();
    if (file instanceof File) {
      pngBytes = await file.arrayBuffer();
    }
  }

  if (!pngBytes || pngBytes.byteLength < 32 || pngBytes.byteLength > 8_000_000) {
    return new Response(JSON.stringify({ error: "Invalid PNG" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const created = await createChartShare({
    userId: user.id,
    pngBytes,
    title,
  });

  if (created.error || !created.token) {
    return new Response(JSON.stringify({ error: created.error ?? "Share failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = `${buildSiteUrl().replace(/\/$/, "")}/share/chart/${created.token}`;
  return new Response(JSON.stringify({ ok: true, token: created.token, url }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
