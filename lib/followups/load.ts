import type { SupabaseClient } from "@supabase/supabase-js";
import type { FollowupRow } from "./followups";

/** Open follow-ups (oldest first) and the ones closed in the last 30 days. */
export async function loadFollowups(supabase: SupabaseClient, now: Date = new Date()) {
  const since = new Date(now.getTime() - 30 * 24 * 3_600_000).toISOString();
  const [open, done] = await Promise.all([
    supabase.from("strategist_followups").select("*").eq("state", "open").order("sent_at", { ascending: true }),
    supabase
      .from("strategist_followups")
      .select("*")
      .eq("state", "done")
      .gte("resolved_at", since)
      .order("resolved_at", { ascending: false }),
  ]);
  const missingTable = /could not find the table|does not exist/i.test(open.error?.message ?? "");
  return {
    open: (open.data ?? []) as FollowupRow[],
    done: (done.data ?? []) as FollowupRow[],
    loadError: missingTable
      ? "The follow-ups table does not exist yet. Run supabase/migrations/20260926140000_strategist_followups.sql in the Supabase SQL editor, then reload."
      : (open.error?.message ?? done.error?.message ?? null),
  };
}
