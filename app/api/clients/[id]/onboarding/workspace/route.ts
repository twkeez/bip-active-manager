import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/require-admin";
import { SERVICE_KEYS, type OnboardingDetails } from "@/lib/onboarding/onboarding-details";
import type { StartTrigger, WebStatus } from "@/lib/onboarding/pipeline-intake";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Everything the onboarding page shows for one client, in one request: the
 * details, which sources have been read, and when each research scan last ran.
 * Nothing about the old checklist — the page no longer shows it.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const clientId = Number((await context.params).id);
  if (!Number.isInteger(clientId) || clientId <= 0) {
    return NextResponse.json({ error: "Invalid client id" }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isAdmin(supabase))) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const admin = createAdminClient();
  const [{ data: client }, { data: intake }, { count: keywordCount }, { data: staff }] = await Promise.all([
    admin
      .from("clients")
      .select("id, account_name, website, city, state, marketing_strategist, seo, ppc, smm, blog, orm, basecamp_project_id")
      .eq("id", clientId)
      .maybeSingle(),
    admin
      .from("client_onboarding_intake")
      .select(
        "web_status, website_launch_date, service_start_plan, kickoff_meeting_at, source_filename, pipeline_notes, kickoff_doc_filename, kickoff_doc_summary, kickoff_doc_at, basecamp_background, basecamp_background_at, basecamp_threads_read, discovery_at, competitor_ads_at, campaign_plan_at, brand_elements_at",
      )
      .eq("client_id", clientId)
      .maybeSingle(),
    admin
      .from("client_keyword_targets")
      .select("id", { count: "exact", head: true })
      .eq("client_id", clientId)
      .eq("is_active", true),
    admin.from("profiles").select("full_name"),
  ]);
  if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });

  const plan = (intake?.service_start_plan ?? {}) as Record<string, { startTrigger?: StartTrigger; startDate?: string | null }>;
  const details: OnboardingDetails = {
    accountName: client.account_name as string,
    website: (client.website as string | null) ?? "",
    city: (client.city as string | null) ?? "",
    state: (client.state as string | null) ?? "",
    strategist: (client.marketing_strategist as string | null) ?? "",
    services: Object.fromEntries(
      SERVICE_KEYS.map((key) => [key, ((client as Record<string, unknown>)[key] as string | null) ?? "N"]),
    ) as OnboardingDetails["services"],
    starts: Object.fromEntries(
      SERVICE_KEYS.map((key) => [
        key,
        { startTrigger: plan[key]?.startTrigger ?? "start_now", startDate: plan[key]?.startDate ?? null },
      ]),
    ) as OnboardingDetails["starts"],
    webStatus: ((intake?.web_status as WebStatus | null) ?? "") as OnboardingDetails["webStatus"],
    websiteLaunchDate: ((intake?.website_launch_date as string | null) ?? "").slice(0, 10),
    kickoffDate: ((intake?.kickoff_meeting_at as string | null) ?? "").slice(0, 10),
  };

  // First names, for the strategist field: the document only shows a strategist
  // whose name matches a staff member.
  const staffNames = [
    ...new Set(
      (staff ?? [])
        .map((row) => String(row.full_name ?? "").trim().split(/\s+/)[0])
        .filter(Boolean),
    ),
  ].sort();

  return NextResponse.json({
    clientId,
    details,
    staffNames,
    sources: {
      pipelineFilename: (intake?.source_filename as string | null) ?? null,
      hasPipelineNotes: Boolean((intake?.pipeline_notes as string | null)?.trim()),
      kickoffDocFilename: (intake?.kickoff_doc_filename as string | null) ?? null,
      kickoffDocSummary: (intake?.kickoff_doc_summary as string | null) ?? null,
      kickoffDocAt: (intake?.kickoff_doc_at as string | null) ?? null,
      basecampLinked: Boolean((client.basecamp_project_id as string | null)?.trim()),
      basecampBackground: (intake?.basecamp_background as string | null) ?? null,
      basecampBackgroundAt: (intake?.basecamp_background_at as string | null) ?? null,
      basecampThreadsRead: (intake?.basecamp_threads_read as number | null) ?? null,
    },
    research: {
      discoveryAt: (intake?.discovery_at as string | null) ?? null,
      competitorAdsAt: (intake?.competitor_ads_at as string | null) ?? null,
      campaignPlanAt: (intake?.campaign_plan_at as string | null) ?? null,
      brandElementsAt: (intake?.brand_elements_at as string | null) ?? null,
      keywordCount: keywordCount ?? 0,
    },
  });
}
