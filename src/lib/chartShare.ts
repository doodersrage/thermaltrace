import { env as cloudflareEnv } from "cloudflare:workers";
import { createServerClient } from "./supabase";

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function getHistoryArchiveBucket(): R2Bucket | null {
  try {
    const bucket = (cloudflareEnv as unknown as { HISTORY_ARCHIVE?: R2Bucket })
      .HISTORY_ARCHIVE;
    return bucket ?? null;
  } catch {
    return null;
  }
}

export async function createChartShare(input: {
  userId: string;
  pngBytes: ArrayBuffer;
  title?: string;
  expiresDays?: number;
}): Promise<{ token: string | null; error: string | null }> {
  const bucket = getHistoryArchiveBucket();
  if (!bucket) {
    return { token: null, error: "Chart share storage is not configured." };
  }

  const token = randomToken();
  const key = `chart-shares/${token}.png`;
  const expiresDays = Math.min(30, Math.max(1, input.expiresDays ?? 14));
  const expiresAt = new Date(
    Date.now() + expiresDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  await bucket.put(key, input.pngBytes, {
    httpMetadata: { contentType: "image/png" },
  });

  const supabase = createServerClient();
  const { error } = await supabase.from("chart_share_tokens").insert({
    token,
    user_id: input.userId,
    r2_key: key,
    title: input.title?.slice(0, 120) ?? null,
    expires_at: expiresAt,
  });

  if (error) {
    try {
      await bucket.delete(key);
    } catch {
      /* ignore */
    }
    return { token: null, error: error.message };
  }

  return { token, error: null };
}

export async function getChartShareByToken(token: string): Promise<{
  title: string | null;
  png: ArrayBuffer | null;
  expiresAt: string;
} | null> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("chart_share_tokens")
    .select("r2_key, title, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!data) return null;
  if (Date.parse(data.expires_at as string) < Date.now()) return null;

  const bucket = getHistoryArchiveBucket();
  if (!bucket) return null;
  const object = await bucket.get(data.r2_key as string);
  if (!object) return null;
  const png = await object.arrayBuffer();
  return {
    title: (data.title as string | null) ?? null,
    png,
    expiresAt: data.expires_at as string,
  };
}
