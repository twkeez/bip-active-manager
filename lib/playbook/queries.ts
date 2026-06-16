import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlaybookItem, ServiceTier } from "./types";

export async function fetchServiceTiers(
  supabase: SupabaseClient,
): Promise<ServiceTier[]> {
  const { data, error } = await supabase
    .from("strategy_mapper_service_tiers")
    .select("*")
    .eq("enabled", true)
    .order("service")
    .order("tier_rank");
  if (error || !data) return [];
  return data.map((row) => ({
    ...row,
    tactics: Array.isArray(row.tactics)
      ? row.tactics
      : JSON.parse(row.tactics ?? "[]"),
  })) as ServiceTier[];
}

export async function fetchPlaybookItems(
  supabase: SupabaseClient,
  tierKey?: string,
): Promise<PlaybookItem[]> {
  let query = supabase
    .from("playbook_items")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .order("id");
  if (tierKey) {
    query = query.eq("tier_key", tierKey);
  }
  const { data, error } = await query;
  if (error || !data) return [];
  return data as PlaybookItem[];
}

export async function fetchPlaybookItemsByTiers(
  supabase: SupabaseClient,
  tierKeys: string[],
): Promise<Record<string, PlaybookItem[]>> {
  if (tierKeys.length === 0) return {};
  const { data, error } = await supabase
    .from("playbook_items")
    .select("*")
    .in("tier_key", tierKeys)
    .eq("is_active", true)
    .order("sort_order")
    .order("id");
  if (error || !data) return {};
  const grouped: Record<string, PlaybookItem[]> = {};
  for (const item of data as PlaybookItem[]) {
    if (!grouped[item.tier_key]) grouped[item.tier_key] = [];
    grouped[item.tier_key].push(item);
  }
  return grouped;
}
