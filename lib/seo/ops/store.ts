import type { SupabaseClient } from "@supabase/supabase-js";
import { monthPeriodKey, isoWeekPeriodKey } from "@/lib/seo/ops/periods";
import type { SeoOpsCompletion, SeoOpsTemplate } from "@/lib/seo/ops/types";

export async function listSeoOpsTemplates(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("seo_ops_templates")
    .select("*")
    .order("cadence", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as SeoOpsTemplate[];
}

export async function listSeoOpsCompletionsForClient(
  supabase: SupabaseClient,
  clientId: number,
) {
  const weeklyKey = isoWeekPeriodKey();
  const monthlyKey = monthPeriodKey();
  const { data, error } = await supabase
    .from("seo_ops_completions")
    .select("*")
    .eq("client_id", clientId)
    .in("period_key", [weeklyKey, monthlyKey]);
  if (error) throw new Error(error.message);
  return (data ?? []) as SeoOpsCompletion[];
}

export async function listSeoOpsCompletionsForClients(
  supabase: SupabaseClient,
  clientIds: number[],
) {
  if (clientIds.length === 0) return [] as SeoOpsCompletion[];
  const weeklyKey = isoWeekPeriodKey();
  const monthlyKey = monthPeriodKey();
  const { data, error } = await supabase
    .from("seo_ops_completions")
    .select("*")
    .in("client_id", clientIds)
    .in("period_key", [weeklyKey, monthlyKey]);
  if (error) throw new Error(error.message);
  return (data ?? []) as SeoOpsCompletion[];
}

type PatchSeoOpsItemInput = {
  done?: boolean;
  notes?: string | null;
  viewed?: boolean;
};

export async function patchSeoOpsItem(
  supabase: SupabaseClient,
  clientId: number,
  itemKey: string,
  cadence: "weekly" | "monthly",
  body: PatchSeoOpsItemInput,
  userId: string,
) {
  const periodKey = cadence === "weekly" ? isoWeekPeriodKey() : monthPeriodKey();
  const now = new Date().toISOString();

  const { data: existing, error: fetchError } = await supabase
    .from("seo_ops_completions")
    .select("*")
    .eq("client_id", clientId)
    .eq("item_key", itemKey)
    .eq("period_key", periodKey)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);

  const payload: Record<string, unknown> = {
    client_id: clientId,
    item_key: itemKey,
    period_key: periodKey,
    updated_at: now,
  };

  if (body.viewed === true) {
    payload.viewed_at = now;
  }
  if (body.notes !== undefined) {
    payload.notes = body.notes;
  }
  if (body.done === true) {
    payload.completed_at = now;
    payload.completed_by = userId;
  } else if (body.done === false) {
    payload.completed_at = null;
    payload.completed_by = null;
  }

  if (existing) {
    const { error } = await supabase
      .from("seo_ops_completions")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("seo_ops_completions").insert(payload);
  if (error) throw new Error(error.message);
}

export async function recordSeoOpsPage2Viewed(
  supabase: SupabaseClient,
  clientId: number,
  userId: string,
) {
  await patchSeoOpsItem(
    supabase,
    clientId,
    "monthly_gsc_page2",
    "monthly",
    { viewed: true },
    userId,
  );
}
