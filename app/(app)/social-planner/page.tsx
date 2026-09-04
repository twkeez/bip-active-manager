import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProfile, isAdmin } from "@/lib/auth/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { SocialPlannerStudio } from "@/components/social/social-planner-studio";
import type {
  SocialAwarenessDay,
  SocialIdea,
  SocialSeries,
  SocialSeriesWithParts,
} from "@/lib/social/types";

export const metadata = { title: "Social Planner" };

export default async function SocialPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client: clientParam } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const profile = await getProfile(supabase);

  const admin = createAdminClient();
  const [
    { data: ideas },
    { data: clients },
    { data: awarenessDays },
    { data: series },
    { data: seriesParts },
    { data: allAwarenessDays },
  ] = await Promise.all([
    admin
      .from("social_idea_repository")
      .select("*")
      .order("campaign_type")
      .order("title")
      .returns<SocialIdea[]>(),
    admin
      .from("clients")
      .select("id, account_name, public_name")
      .order("account_name")
      .returns<{ id: number; account_name: string; public_name: string | null }[]>(),
    // Only verified + active days are usable; the rest are a review backlog.
    admin
      .from("social_awareness_days")
      .select("*")
      .eq("is_active", true)
      .eq("verified", true)
      .order("month")
      .returns<SocialAwarenessDay[]>(),
    admin
      .from("social_series")
      .select("*")
      .eq("is_active", true)
      .order("title")
      .returns<SocialSeries[]>(),
    admin
      .from("social_series_parts")
      .select("*")
      .order("series_id")
      .order("part_number")
      .returns<SocialSeriesWithParts["parts"]>(),
    // Every day, including the unverified backlog the planner cannot use — the
    // Celebration Days tab exists to make that backlog visible.
    admin
      .from("social_awareness_days")
      .select("*")
      .order("month")
      .returns<SocialAwarenessDay[]>(),
  ]);

  // Attach parts to their series so arc cards can show a part count.
  const partsBySeries = new Map<number, SocialSeriesWithParts["parts"]>();
  for (const part of seriesParts ?? []) {
    const list = partsBySeries.get(part.series_id) ?? [];
    list.push(part);
    partsBySeries.set(part.series_id, list);
  }
  const seriesWithParts: SocialSeriesWithParts[] = (series ?? []).map((s) => ({
    ...s,
    parts: partsBySeries.get(s.id) ?? [],
  }));

  const initialClientId =
    clientParam && Number.isInteger(Number(clientParam)) ? Number(clientParam) : undefined;

  return (
    <SocialPlannerStudio
      initialIdeas={ideas ?? []}
      clients={clients ?? []}
      awarenessDays={awarenessDays ?? []}
      allAwarenessDays={allAwarenessDays ?? []}
      series={seriesWithParts}
      isAdminUser={isAdmin(profile)}
      initialClientId={initialClientId}
    />
  );
}
