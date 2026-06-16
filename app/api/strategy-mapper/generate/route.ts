import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildClientContext } from "@/lib/strategy-mapper/build-client-context";
import { assembleFullReport } from "@/lib/strategy-mapper/assemble-report";
import { resolveActiveServices } from "@/lib/strategy-mapper/form-options";
import { dualRadiusFromResearch } from "@/lib/strategy-mapper/radius";
import { sanitizeReport } from "@/lib/strategy-mapper/report-sanitize";
import { fetchContentBlocks } from "@/lib/strategy-mapper/content-library";
import { fetchServiceTiers } from "@/lib/strategy-mapper/tier-library";
import {
  getUpsellTierCandidates,
  resolveSelectedTiers,
} from "@/lib/strategy-mapper/tier-resolver";
import { mergeWebsiteSeoAuditIntoReport } from "@/lib/strategy-mapper/website-seo-report";
import { evaluateUpsellDirectives } from "@/lib/strategy-mapper/upsell-rules";
import type {
  StrategyMapperGenerateRequest,
  StrategyMapperGenerateResult,
  StrategyMapperResearch,
} from "@/types/strategy-mapper";

function validateResearch(research: StrategyMapperResearch): string | null {
  if (!research.clientMetrics) {
    return "Research clientMetrics is required";
  }
  if (
    typeof research.clientMetrics.googleRating !== "number" ||
    typeof research.clientMetrics.reviewCount !== "number" ||
    typeof research.clientMetrics.runsGoogleAds !== "boolean"
  ) {
    return "Research clientMetrics must include googleRating, reviewCount, and runsGoogleAds";
  }
  if (!Array.isArray(research.competitors)) {
    return "Research competitors must be an array";
  }
  if (!research.densityTier || !research.radiusRationale?.trim()) {
    return "Research densityTier and radiusRationale are required";
  }
  return null;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: StrategyMapperGenerateRequest;
  try {
    body = (await request.json()) as StrategyMapperGenerateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { form, research, websiteAudit } = body;

  if (!form?.practiceName?.trim()) {
    return NextResponse.json({ error: "Practice name is required" }, { status: 400 });
  }
  if (!form.streetAddress?.trim()) {
    return NextResponse.json({ error: "Street address is required" }, { status: 400 });
  }
  if (!research) {
    return NextResponse.json({ error: "Audited research payload is required" }, { status: 400 });
  }

  const researchError = validateResearch(research);
  if (researchError) {
    return NextResponse.json({ error: researchError }, { status: 400 });
  }

  const activeServices = resolveActiveServices(form.activeServices ?? []);

  if (!activeServices.length) {
    return NextResponse.json(
      { error: "No active Phase 1 services — select services on the form." },
      { status: 400 },
    );
  }

  const radius = dualRadiusFromResearch(research);
  const clientContext = buildClientContext(form, research);
  const tiers = await fetchServiceTiers(supabase);
  const contentBlocks = await fetchContentBlocks(supabase);
  const selectedTiers = resolveSelectedTiers(form, activeServices, tiers);
  const upsellDirectives = evaluateUpsellDirectives(activeServices, form, research);
  const allowedUpsellServices = upsellDirectives.map((d) => d.service);
  const upsellTierCandidates = getUpsellTierCandidates(
    selectedTiers,
    activeServices,
    tiers,
    upsellDirectives,
  );

  try {
    let report = assembleFullReport({
      form,
      research,
      radius,
      activeServices,
      selectedTierKeys: selectedTiers,
      tiers,
      contentBlocks,
      upsellDirectives,
      upsellTierCandidates,
    });

    if (websiteAudit && !websiteAudit.skipped) {
      report = mergeWebsiteSeoAuditIntoReport(report, websiteAudit, form, activeServices);
    }

    const sanitized = sanitizeReport(
      report,
      activeServices,
      allowedUpsellServices,
      form.salesPdfExtract,
      {
        activeStrategies: report.activeStrategies,
        growthOpportunityStubs: report.growthOpportunities,
        competitiveAuditRows: report.competitiveAuditRows,
        internalStrategistChecklist: report.internalStrategistChecklist,
      },
    );

    const result: StrategyMapperGenerateResult = {
      research,
      report: sanitized,
      upsellDirectives,
      radius,
      activeServices,
      clientContext,
      websiteAudit,
    };

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to build strategy mapper plan",
      },
      { status: 500 },
    );
  }
}
