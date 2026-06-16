import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSalesSeoAudit } from "@/lib/sales/audit";
import { runSalesLighthouseAudit } from "@/lib/sales/lighthouse";
import {
  analyzeLogoBrandProfile,
  buildHostingerHorizonsPrompt,
  buildStrategicSummary,
} from "@/lib/sales/ai";
import { extractSalesSiteContent } from "@/lib/sales/site-content";
import type {
  SalesLogoAnalysis,
  SalesPromptBrief,
  SalesProspectAiOutputs,
  SalesProspectAudit,
  SalesProspectRun,
  SalesSiteExtract,
} from "@/lib/types/client";

type SalesLabRunRequest = {
  prospectUrl?: string;
  prospectName?: string;
  logoUrl?: string;
  targetKeyword?: string;
  competitorUrl?: string;
  valueProposition?: string;
  clientTestimonial?: string;
  crawlMode?: "all_pages" | "core_pages";
  maxPages?: number;
  promptStyle?: "full" | "short";
};

type ParsedRunInput = {
  body: SalesLabRunRequest;
  logoUpload:
    | {
        bytes: Buffer;
        mimeType: string;
      }
    | null;
};

function normalizeUrl(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (value.includes("://")) return value;
  return `https://${value}`;
}

function normalizeOptionalText(value: string | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed ? trimmed : null;
}

function normalizeMaxPages(value: number | undefined) {
  if (!Number.isInteger(value)) return 50;
  return Math.max(10, Math.min(value ?? 50, 120));
}

function normalizePromptStyle(value: string | undefined) {
  return value === "short" ? "short" : "full";
}

function buildPlaceholderExtract(): SalesSiteExtract {
  return {
    scannedUrls: 0,
    sourceUrls: [],
    valueProps: [],
    reviews: [],
    services: [],
    ctas: [],
    contactPoints: [],
    serviceAreas: [],
    trustSignals: [],
    reasonsToChoose: [
      "Use placeholder proof and request client-provided reviews and trust statements.",
    ],
    missingSections: ["valueProps", "reviews", "services", "trustSignals"],
    crawlDiagnostics: {
      attemptedUrls: 0,
      skippedUrls: 0,
      skippedByReason: {},
    },
  };
}

async function parseRunInput(request: Request): Promise<ParsedRunInput> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const logoFile = form.get("logoUpload");
    let logoUpload: ParsedRunInput["logoUpload"] = null;
    if (logoFile instanceof File && logoFile.size > 0) {
      const maxLogoBytes = 4 * 1024 * 1024;
      if (logoFile.size > maxLogoBytes) {
        throw new Error("Logo upload must be 4MB or smaller.");
      }
      const mimeType = logoFile.type || "application/octet-stream";
      if (!mimeType.startsWith("image/")) {
        throw new Error("Logo upload must be an image file.");
      }
      const bytes = Buffer.from(await logoFile.arrayBuffer());
      logoUpload = { bytes, mimeType };
    }
    return {
      body: {
        prospectUrl: String(form.get("prospectUrl") ?? ""),
        prospectName: String(form.get("prospectName") ?? ""),
        logoUrl: String(form.get("logoUrl") ?? ""),
        targetKeyword: String(form.get("targetKeyword") ?? ""),
        competitorUrl: String(form.get("competitorUrl") ?? ""),
        valueProposition: String(form.get("valueProposition") ?? ""),
        clientTestimonial: String(form.get("clientTestimonial") ?? ""),
        crawlMode:
          String(form.get("crawlMode") ?? "") === "core_pages" ? "core_pages" : "all_pages",
        maxPages: Number(form.get("maxPages") ?? 0),
        promptStyle:
          String(form.get("promptStyle") ?? "") === "short" ? "short" : "full",
      },
      logoUpload,
    };
  }
  return {
    body: (await request.json()) as SalesLabRunRequest,
    logoUpload: null,
  };
}

async function fetchLogoFromUrl(rawUrl: string) {
  const normalized = normalizeUrl(rawUrl);
  if (!normalized) return null;
  const response = await fetch(normalized, {
    cache: "no-store",
    redirect: "follow",
    headers: { "User-Agent": "BIPSalesLabBot/1.0 (+logo-fetch)" },
  });
  if (!response.ok) {
    throw new Error(`Logo URL fetch failed (${response.status}).`);
  }
  const mimeType = response.headers.get("content-type") ?? "";
  if (!mimeType.startsWith("image/")) {
    throw new Error("Logo URL did not return an image content type.");
  }
  const length = Number(response.headers.get("content-length") ?? "0");
  const maxLogoBytes = 4 * 1024 * 1024;
  if (length > maxLogoBytes) {
    throw new Error("Logo URL content is too large (over 4MB).");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > maxLogoBytes) {
    throw new Error("Logo URL content is too large (over 4MB).");
  }
  return { bytes, mimeType };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsedInput: ParsedRunInput;
  try {
    parsedInput = await parseRunInput(request);
  } catch (parseError) {
    return NextResponse.json(
      {
        error:
          parseError instanceof Error ? parseError.message : "Invalid request body.",
      },
      { status: 400 },
    );
  }
  const { body, logoUpload } = parsedInput;

  const prospectUrl = normalizeUrl(body.prospectUrl ?? "");
  const prospectName = (body.prospectName ?? "").trim() || null;
  const logoUrl = (body.logoUrl ?? "").trim() || null;
  const competitorUrl = normalizeOptionalText(body.competitorUrl);
  const targetKeyword = normalizeOptionalText(body.targetKeyword);
  const valueProposition = normalizeOptionalText(body.valueProposition);
  const clientTestimonial = normalizeOptionalText(body.clientTestimonial);
  const crawlMode = body.crawlMode === "core_pages" ? "core_pages" : "all_pages";
  const maxPages = normalizeMaxPages(body.maxPages);
  const promptStyle = normalizePromptStyle(body.promptStyle);
  if (!prospectUrl) {
    return NextResponse.json({ error: "prospectUrl is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: runRow, error: runCreateError } = await admin
    .from("sales_prospect_runs")
    .insert({
      created_by: user.id,
      prospect_name: prospectName,
      prospect_url: prospectUrl,
      status: "running",
    })
    .select("*")
    .single<SalesProspectRun>();
  if (runCreateError || !runRow) {
    return NextResponse.json(
      { error: runCreateError?.message ?? "Failed to create sales run." },
      { status: 500 },
    );
  }

  try {
    const [seoResult, lighthouseResult] = await Promise.allSettled([
      runSalesSeoAudit(prospectUrl),
      runSalesLighthouseAudit(prospectUrl),
    ]);
    const seo =
      seoResult.status === "fulfilled"
        ? seoResult.value
        : {
            normalized_url: prospectUrl,
            title: null,
            title_length: 0,
            meta_description: null,
            meta_description_length: 0,
            h1_count: 0,
            canonical: null,
            robots_meta: null,
            has_json_ld_schema: false,
            schema_types: [],
            has_sitemap_hint: false,
            has_robots_txt_hint: false,
            issues: [],
          };
    const lighthouse =
      lighthouseResult.status === "fulfilled"
        ? lighthouseResult.value
        : {
            scores: {
              performance: null,
              seo: null,
              accessibility: null,
              bestPractices: null,
            },
            metrics: {
              fcp: null,
              lcp: null,
              cls: null,
              tbt: null,
              speedIndex: null,
            },
            findings: [],
          };
    let siteExtract: SalesSiteExtract;
    try {
      siteExtract = await extractSalesSiteContent(prospectUrl, {
        maxUrls: maxPages,
        crawlMode,
      });
    } catch (extractError) {
      console.warn("[sales-lab] extraction failed, continuing with placeholders", {
        error:
          extractError instanceof Error
            ? extractError.message
            : "unknown extraction error",
      });
      siteExtract = buildPlaceholderExtract();
    }
    if (siteExtract.scannedUrls === 0) {
      siteExtract = buildPlaceholderExtract();
    }
    let competitorExtract: SalesSiteExtract | null = null;
    if (competitorUrl) {
      try {
        competitorExtract = await extractSalesSiteContent(competitorUrl, {
          maxUrls: Math.max(12, Math.floor(maxPages / 2)),
          crawlMode: "core_pages",
        });
      } catch (competitorError) {
        console.warn("[sales-lab] competitor extraction failed, continuing", {
          error:
            competitorError instanceof Error
              ? competitorError.message
              : "unknown competitor extraction error",
        });
      }
    }

    let logoAnalysis: SalesLogoAnalysis | null = null;
    let logoSource: SalesPromptBrief["logoSource"] = "none";
    const logoAsset = logoUpload ?? (logoUrl ? await fetchLogoFromUrl(logoUrl).catch(() => null) : null);
    if (logoAsset) {
      logoSource = logoUpload ? "upload" : "url";
      try {
        logoAnalysis = await analyzeLogoBrandProfile({
          logoBytes: logoAsset.bytes,
          mimeType: logoAsset.mimeType,
          prospectName: prospectName ?? prospectUrl,
        });
      } catch (logoError) {
        console.warn("[sales-lab] logo analysis failed, continuing", {
          error: logoError instanceof Error ? logoError.message : "unknown logo analysis error",
        });
      }
    }

    const competitorGaps: string[] = [];
    if (competitorExtract) {
      if (siteExtract.reviews.length === 0 && competitorExtract.reviews.length > 0) {
        competitorGaps.push(
          "Add a testimonial section above the fold with at least 2 customer quotes and attribution.",
        );
      }
      if (siteExtract.ctas.length < competitorExtract.ctas.length) {
        competitorGaps.push(
          "Place one primary CTA and one secondary CTA in hero, mid-page, and footer placements.",
        );
      }
      if (siteExtract.services.length < competitorExtract.services.length) {
        competitorGaps.push(
          "Expand service-card coverage to match competitor breadth with benefit-first microcopy.",
        );
      }
      if (siteExtract.contactPoints.length === 0 && competitorExtract.contactPoints.length > 0) {
        competitorGaps.push(
          "Rebuild contact section with full NAP details and repeated footer consistency checks.",
        );
      }
    }
    const promptBrief: SalesPromptBrief = {
      targetKeyword,
      competitorUrl,
      valueProposition,
      clientTestimonial,
      crawlMode,
      maxPages,
      promptStyle,
      logoSource,
      competitorGaps,
    };
    const promptBaseUrl = siteExtract.sourceUrls[0] ?? seo.normalized_url ?? prospectUrl;
    console.info("[sales-lab] extracted-site-content", {
      scannedUrls: siteExtract.scannedUrls,
      sourceUrls: siteExtract.sourceUrls.length,
      valueProps: siteExtract.valueProps.length,
      reviews: siteExtract.reviews.length,
      services: siteExtract.services.length,
      trustSignals: siteExtract.trustSignals.length,
      missingSections: siteExtract.missingSections,
    });

    const { data: auditRow, error: auditError } = await admin
      .from("sales_prospect_audits")
      .upsert({
        run_id: runRow.id,
        seo_findings: seo,
        lighthouse_scores: lighthouse.scores,
        lighthouse_metrics: lighthouse.metrics,
        lighthouse_findings: lighthouse.findings,
        site_extract: siteExtract,
        extract_sources: siteExtract.sourceUrls,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single<SalesProspectAudit>();
    if (auditError || !auditRow) {
      throw new Error(auditError?.message ?? "Failed to persist audit findings.");
    }

    const hostingerPrompt = buildHostingerHorizonsPrompt({
      prospectName: prospectName ?? promptBaseUrl,
      prospectUrl: promptBaseUrl,
      seo,
      lighthouseScores: lighthouse.scores,
      lighthouseMetrics: lighthouse.metrics,
      lighthouseFindings: lighthouse.findings,
      extractedSiteContext: siteExtract,
      logoUrl,
      logoAnalysis,
      brief: promptBrief,
      competitorExtract,
    });

    let summaryJson = {
      theWin:
        "The audit uncovered clear opportunities to improve both user experience and search visibility.",
      theConcern:
        "Current technical and performance gaps are likely reducing conversion efficiency on mobile.",
      theNextMove:
        "Prioritize a modern rebuild with stronger SEO architecture and performance-focused UX.",
    };
    let followupEmailDraft = "";
    let aiWarning: string | null = null;
    try {
      const aiSummary = await buildStrategicSummary({
        prospectName: prospectName ?? promptBaseUrl,
        prospectUrl: promptBaseUrl,
        seo,
        lighthouseScores: lighthouse.scores,
        lighthouseMetrics: lighthouse.metrics,
        lighthouseFindings: lighthouse.findings,
      });
      summaryJson = aiSummary.summary;
      followupEmailDraft = aiSummary.followupEmailDraft;
    } catch (error) {
      aiWarning = error instanceof Error ? error.message : "AI summary generation failed.";
    }

    const { data: aiRow, error: aiError } = await admin
      .from("sales_prospect_ai_outputs")
      .upsert({
        run_id: runRow.id,
        summary_json: summaryJson,
        hostinger_prompt: hostingerPrompt,
        followup_email_draft: followupEmailDraft || null,
        logo_analysis:
          logoAnalysis ??
          ({
            primaryHex: "#1F2937",
            secondaryHex: "#4B5563",
            accentHex: "#2563EB",
            brandPersonality: "Professional and trustworthy.",
            designCues: [],
          } satisfies SalesLogoAnalysis),
        prompt_brief: promptBrief,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single<SalesProspectAiOutputs>();
    if (aiError || !aiRow) {
      throw new Error(aiError?.message ?? "Failed to persist AI outputs.");
    }

    const { data: completedRun, error: runUpdateError } = await admin
      .from("sales_prospect_runs")
      .update({
        status: "completed",
        error_message: aiWarning,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runRow.id)
      .select("*")
      .single<SalesProspectRun>();
    if (runUpdateError || !completedRun) {
      throw new Error(runUpdateError?.message ?? "Failed to finalize sales run.");
    }

    return NextResponse.json({
      ok: true,
      run: completedRun,
      audit: auditRow,
      aiOutputs: aiRow,
      warning: aiWarning,
    });
  } catch (error) {
    await admin
      .from("sales_prospect_runs")
      .update({
        status: "failed",
        error_message:
          error instanceof Error ? error.message : "Sales lab run failed.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", runRow.id);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sales lab run failed." },
      { status: 500 },
    );
  }
}
