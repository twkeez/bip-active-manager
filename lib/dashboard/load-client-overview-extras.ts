import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The few numbers the client overview page needs that aren't already in
 * loadClientWorkspaceData(). Kept separate so the overview can grow its own
 * stats without widening the shared workspace payload.
 */
export type ClientOverviewExtras = {
  /** Posts placed on this client's calendar for the current month. */
  postsThisMonth: number;
};

export async function loadClientOverviewExtras(
  supabase: SupabaseClient,
  clientId: number,
): Promise<ClientOverviewExtras> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const { data: plan } = await supabase
    .from("social_content_plans")
    .select("id")
    .eq("client_id", clientId)
    .eq("plan_month", month)
    .eq("plan_year", year)
    .maybeSingle<{ id: number }>();

  if (!plan) return { postsThisMonth: 0 };

  const { count } = await supabase
    .from("social_content_posts")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", plan.id);

  return { postsThisMonth: count ?? 0 };
}
