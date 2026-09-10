import { createServerClient } from "./supabase";

export type HistorySavedViewParams = {
  feed?: string;
  probe?: string;
  from?: string;
  to?: string;
  days?: number;
  tab?: string;
  yoy?: boolean;
  overlay?: string;
  compare_from?: string;
  compare_to?: string;
};

export type HistorySavedView = {
  id: string;
  user_id: string;
  household_id: string | null;
  name: string;
  params: HistorySavedViewParams;
  created_at: string;
};

export function paramsFromSearchParams(
  search: URLSearchParams,
): HistorySavedViewParams {
  const params: HistorySavedViewParams = {};
  const feed = search.get("feed")?.trim();
  const probe = search.get("probe")?.trim();
  const from = search.get("from")?.trim();
  const to = search.get("to")?.trim();
  const tab = search.get("tab")?.trim();
  const overlay = search.get("overlay")?.trim();
  const compareFrom = search.get("compare_from")?.trim();
  const compareTo = search.get("compare_to")?.trim();
  const days = Number(search.get("days") ?? "");
  if (feed) params.feed = feed;
  if (probe) params.probe = probe;
  if (from) params.from = from;
  if (to) params.to = to;
  if (tab) params.tab = tab;
  if (overlay) params.overlay = overlay;
  if (compareFrom) params.compare_from = compareFrom;
  if (compareTo) params.compare_to = compareTo;
  if (Number.isFinite(days) && days > 0) params.days = days;
  if (search.get("yoy") === "1") params.yoy = true;
  return params;
}

export function searchParamsFromView(params: HistorySavedViewParams): string {
  const sp = new URLSearchParams();
  if (params.feed) sp.set("feed", params.feed);
  if (params.probe) sp.set("probe", params.probe);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.days && params.days !== 7) sp.set("days", String(params.days));
  if (params.tab) sp.set("tab", params.tab);
  if (params.yoy) sp.set("yoy", "1");
  if (params.overlay) sp.set("overlay", params.overlay);
  if (params.compare_from) sp.set("compare_from", params.compare_from);
  if (params.compare_to) sp.set("compare_to", params.compare_to);
  return sp.toString();
}

export async function listHistorySavedViews(
  userId: string,
): Promise<HistorySavedView[]> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("history_saved_views")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error || !data) return [];
  return data.map((row) => ({
    id: row.id as string,
    user_id: row.user_id as string,
    household_id: (row.household_id as string | null) ?? null,
    name: row.name as string,
    params: (row.params ?? {}) as HistorySavedViewParams,
    created_at: row.created_at as string,
  }));
}

export async function createHistorySavedView(input: {
  userId: string;
  householdId: string | null;
  name: string;
  params: HistorySavedViewParams;
}): Promise<{ id: string | null; error: string | null }> {
  const name = input.name.trim().slice(0, 80);
  if (!name) return { id: null, error: "Name required" };
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("history_saved_views")
    .insert({
      user_id: input.userId,
      household_id: input.householdId,
      name,
      params: input.params as import("../types/supabase").Json,
    })
    .select("id")
    .single();
  if (error) return { id: null, error: error.message };
  return { id: data?.id ?? null, error: null };
}

export async function deleteHistorySavedView(
  userId: string,
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServerClient();
  const { error } = await supabase
    .from("history_saved_views")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
