import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The few numbers the client overview page needs that aren't already in
 * loadClientWorkspaceData(). Kept separate so the overview can grow its own
 * stats without widening the shared workspace payload.
 */
export type ClientOverviewExtras = {
  /** Posts placed on this client's calendar for the current month. */
  postsThisMonth: number;
  /** Latest Google rating we have stored, if reputation has ever been run. */
  reviewRating: number | null;
  reviewVotes: number | null;
  /** When the last reputation report was generated, if any. */
  reputationReportAt: string | null;
};

async function loadSocialPostCount(
  supabase: SupabaseClient,
  clientId: number,
): Promise<number> {
  const now = new Date();
  const { data: plan } = await supabase
    .from("social_content_plans")
    .select("id")
    .eq("client_id", clientId)
    .eq("plan_month", now.getMonth() + 1)
    .eq("plan_year", now.getFullYear())
    .maybeSingle<{ id: number }>();

  if (!plan) return 0;

  const { count } = await supabase
    .from("social_content_posts")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", plan.id);

  return count ?? 0;
}

export async function loadClientOverviewExtras(
  supabase: SupabaseClient,
  clientId: number,
): Promise<ClientOverviewExtras> {
  const [postsThisMonth, snapshot, report] = await Promise.all([
    loadSocialPostCount(supabase, clientId),
    supabase
      .from("client_reputation_snapshots")
      .select("rating, votes_count")
      .eq("client_id", clientId)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ rating: number | null; votes_count: number | null }>(),
    supabase
      .from("client_reputation_reports")
      .select("generated_at")
      .eq("client_id", clientId)
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ generated_at: string }>(),
  ]);

  return {
    postsThisMonth,
    reviewRating: snapshot.data?.rating ?? null,
    reviewVotes: snapshot.data?.votes_count ?? null,
    reputationReportAt: report.data?.generated_at ?? null,
  };
}
