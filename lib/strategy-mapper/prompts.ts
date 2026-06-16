import { SERVICE_LABELS } from "@/lib/strategy-mapper/form-options";
import type { ServiceTierTemplate } from "@/lib/strategy-mapper/tier-library";
import type { UpsellTierCandidate } from "@/lib/strategy-mapper/tier-resolver";
import { framingLabel } from "@/lib/strategy-mapper/upsell-rules";
import type {
  DualRadiusResult,
  SalesPdfExtract,
  StrategyMapperFormData,
  StrategyMapperResearch,
  StrategyMapperService,
  UpsellDirective,
  UpsellFraming,
} from "@/types/strategy-mapper";

function formatSpecializations(form: StrategyMapperFormData): string {
  const items = [...form.specializations];
  if (form.customSpecialization.trim()) {
    items.push(form.customSpecialization.trim());
  }
  return items.length > 0 ? items.join(", ") : "General practice";
}

function formatSalesExtract(extract?: SalesPdfExtract): string {
  if (!extract) return "No sales PDF provided.";
  return [
    `Summary: ${extract.summary}`,
    extract.purchasedServices.length
      ? `Purchased services (Phase 1 — authoritative): ${extract.purchasedServices.join(", ")}`
      : "Purchased services: none found in PDF table",
    extract.purchasedProductLabels.length
      ? `Purchased product labels: ${extract.purchasedProductLabels.join("; ")}`
      : "",
    extract.ormProgramName ? `ORM program name: ${extract.ormProgramName}` : "",
    extract.clinicalDifferentiator
      ? `Clinical/pricing differentiator: ${extract.clinicalDifferentiator}`
      : "",
    extract.primaryProcedures.length
      ? `Primary procedures (must name in strategy prose): ${extract.primaryProcedures.join(", ")}`
      : "",
    extract.clientRunsOwnAds
      ? `Client runs own ads: YES${extract.adsPerformanceNote ? ` — ${extract.adsPerformanceNote}` : ""}`
      : "Client runs own ads: no (or not stated)",
    extract.vendorPlatforms.length
      ? `Vendor platforms: ${extract.vendorPlatforms.join(", ")}`
      : "",
    extract.socialContentThemes.length
      ? `Social content themes: ${extract.socialContentThemes.join("; ")}`
      : "",
    extract.primarySocialPlatform
      ? `Primary social platform: ${extract.primarySocialPlatform}`
      : "",
    extract.socialAdsHistory ? `Social ads history: ${extract.socialAdsHistory}` : "",
    extract.doctorCount ? `Doctors: ${extract.doctorCount}` : "",
    extract.staffConstraints ? `Staff constraints: ${extract.staffConstraints}` : "",
    extract.capacityNotes ? `Capacity: ${extract.capacityNotes}` : "",
    extract.operationalBottlenecks.length
      ? `Operational bottlenecks: ${extract.operationalBottlenecks.join("; ")}`
      : "",
    extract.painPoints.length
      ? `Pain points: ${extract.painPoints.join("; ")}`
      : "",
    extract.goals.length ? `Goals: ${extract.goals.join("; ")}` : "",
    extract.agencyFrustrations.length
      ? `Agency frustrations: ${extract.agencyFrustrations.join("; ")}`
      : "",
    extract.vendorFrustrations.length
      ? `Vendor/software frustrations: ${extract.vendorFrustrations.join("; ")}`
      : "",
    `Client persona tone: ${extract.clientPersonaTone}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function toneInstructions(extract?: SalesPdfExtract): string {
  if (extract?.clientPersonaTone === "no-nonsense") {
    return `TONE: Client is "no-nonsense" — be direct, data-driven, authoritative. Strip corporate fluff and emotional filler. No exclamation-heavy marketing speak.`;
  }
  return `TONE: Expert, data-driven, warm, approachable — focused on "getting more tails through the door."`;
}

function wantsCaseTransformationGallery(extract?: SalesPdfExtract): boolean {
  if (!extract) return false;
  const sources = [
    ...extract.socialContentThemes,
    ...extract.goals,
    ...extract.painPoints,
    extract.summary,
  ]
    .join(" ")
    .toLowerCase();
  return (
    sources.includes("before") && sources.includes("after") ||
    sources.includes("success stor") ||
    sources.includes("case transformation") ||
    sources.includes("recovery gallery") ||
    sources.includes("before-and-after") ||
    sources.includes("before and after")
  );
}

function hasBeforeAfterSocialThemes(extract?: SalesPdfExtract): boolean {
  return wantsCaseTransformationGallery(extract);
}

function clinicalWeaponizationBlock(extract: SalesPdfExtract): string {
  const procedureNames =
    extract.primaryProcedures.length > 0
      ? extract.primaryProcedures.join(", ")
      : "the named procedure from clinicalDifferentiator";
  return `
WEAPONIZE PRIMARY CLINICAL DIFFERENTIATORS:
- Scan sales notes for specific high-ticket procedures and explicit pricing advantages. Primary procedures: ${procedureNames}. Pricing/value edge: "${extract.clinicalDifferentiator}".
- STRICTLY FORBIDDEN vague filler in executiveSummary, activeStrategies.seo, activeStrategies.ppc tactics, and PPC growthOpportunity blocks: "high-value procedures", "advanced surgery", "advanced care", "specialty services", "advanced orthopedic care", "orthopedic specialist" (without naming the procedure).
- MUST call out the exact procedure name(s) — e.g. "TPLO" (Tibial Plateau Leveling Osteotomy) — and the value proposition (e.g. half the cost of 24-hour corporate facilities) in:
  - executiveSummary.missionStatement — regional draw is for TPLO price-advantage, NOT generic orthopedic positioning
  - executiveSummary.narrative
  - growthOpportunities PPC block whyItMatters when PPC optimization is triggered
- coreFocusAreas must include at least one bullet naming the procedure AND the pricing/regional advantage`;
}

function upsellFramingExemplar(
  service: StrategyMapperService,
  framing: UpsellFraming,
  extract?: SalesPdfExtract,
): string {
  if (service === "ppc" && framing === "optimization") {
    const clinicalWedge = extract?.clinicalDifferentiator
      ? ` Tie optimization to the clinical/cost wedge: "${extract.clinicalDifferentiator}" — e.g. scale TPLO/regional search campaigns that already convert.`
      : "";
    return `- PPC / optimization title pattern: "PPC Advertising Optimization" — acknowledge self-managed Google Ads are already their most effective channel; offer integration, conversion tracking, and eventual offload — NOT "introducing paid search."${clinicalWedge}`;
  }
  if (service === "ppc" && framing === "introduction") {
    return `- PPC / introduction title pattern: "PPC Advertising" — competitors run ads; client does not; position as new channel to capture high-intent search.`;
  }
  if (service === "orm" && framing === "reputation_gap") {
    return `- ORM / reputation gap — only when ORM is NOT purchased; cite review count gap vs top competitor.`;
  }
  if (service === "social" && framing === "community") {
    if (hasBeforeAfterSocialThemes(extract)) {
      const platform = extract?.primarySocialPlatform || "primary social platform";
      const adsNote = extract?.socialAdsHistory
        ? ` Leverage past success: ${extract.socialAdsHistory}.`
        : "";
      return `- Social / community — mandate a dedicated post-op orthopedic recovery gallery workflow: before-and-after surgical outcome showcases, video clips of dogs running pain-free post-TPLO recovery, broadcast on ${platform}; build regional trust through case transformations — NOT generic "post cute pet photos" or "patient milestones."${adsNote}`;
    }
    return `- Social / community — local trust-building, pet-owner education, behind-the-scenes content; not a hard sell.`;
  }
  if (service === "seo" && framing === "introduction") {
    return `- SEO / introduction — client not in top 3 local review leaders; organic visibility gap.`;
  }
  return `- ${SERVICE_LABELS[service]} (${framingLabel(framing)})`;
}

export function buildSalesNotesExtractionPrompt(): string {
  return `You are a sales intelligence analyst for Beyond Indigo Pets, a veterinary marketing agency.

Extract structured discovery notes from the uploaded sales PDF / pipeline document.

CRITICAL MATRIX CHECK:
- Scan for a "Purchased Products", "Purchased Services", or similar table.
- purchasedServices is AUTHORITATIVE for Phase 1 — map each purchased item to one or more of: seo, ppc, orm, social.
  - SEO / Search Engine Optimization / SEO Local → seo
  - PPC / Google Ads / Pay-Per-Click / Google Ads management → ppc
  - ORM / Reputation / Review Management / Premium Plus (when reputation-related) → orm
  - Social Media → social
- purchasedProductLabels: preserve exact table labels (e.g. "ORM Premium Plus", "SEO Local").
- ormProgramName: named ORM tier if present (e.g. "ORM Premium Plus"); empty string if none.
- Partial matches count: "Reputation", "Premium Plus" (with ORM context), "Google Ads management".

DO NOT CONTRADICT:
- If notes say the client runs their own Google Ads, self-manages PPC, or ads are working well → clientRunsOwnAds: true.
- adsPerformanceNote: capture how ads perform (e.g. "self-managed Google Ads are their most effective channel").
- Never infer clientRunsOwnAds: false when notes explicitly say they run ads.

Clinical / pricing anchor:
- clinicalDifferentiator: explicit pricing or procedure edge (e.g. "TPLO at ~half regional hospital cost", "affordable orthopedic surgery drawing clients from multiple states"). Empty string if none stated.
- primaryProcedures: array of named high-ticket procedures explicitly mentioned (e.g. "TPLO", "Tibial Plateau Leveling Osteotomy", "ACL repair"). Empty array if none. Always include acronym AND full name when both appear in notes.

Social marketing intent (from website/social notes):
- socialContentThemes: array of requested content types (e.g. "before-and-after success stories", "orthopedic recovery", "case transformations"). Empty array if none stated.
- primarySocialPlatform: main platform if mentioned (e.g. "Facebook", "Instagram"). Empty string if none.
- socialAdsHistory: past paid social success if noted (e.g. "historically ran Facebook ads successfully"). Empty string if none.

Vendor platforms:
- vendorPlatforms: named platforms/vendors (Demandforce, previous agency names, etc.) from frustrations or current stack.

Context Extractor:
- operationalBottlenecks: staffing, doctor count limits, scheduling constraints
- capacityNotes: capacity percentages or appointment availability notes
- vendorFrustrations: failed platforms (e.g. Demandforce closed-loop reviews), unresponsive web admins, pricing issues
- staffConstraints: free-text summary of team size constraints (e.g. "1 doctor, 11 staff")
- doctorCount: number of doctors if stated

Tone Adapter:
- If notes describe client as "no-nonsense", "direct", "no fluff", or similar → clientPersonaTone: "no-nonsense"
- Otherwise → "standard"

Also extract: summary, painPoints, goals, agencyFrustrations.

Do NOT hallucinate purchased services — only include services explicitly listed in a purchased products table or equivalent section.`;
}

export function buildStrategyMapperResearchPrompt(
  form: StrategyMapperFormData,
  radius: DualRadiusResult,
  activeServices: StrategyMapperService[],
): string {
  const localRadius = radius.wellnessRadiusMiles;
  const regionalRadius = radius.specialtyRadiusMiles;
  const extract = form.salesPdfExtract;
  const clientRunsOwnAds = extract?.clientRunsOwnAds === true;

  return `You are a local market researcher for Beyond Indigo Pets, a veterinary marketing agency.

Use web search to research ${form.practiceName} at ${form.streetAddress}.

DUAL-RADIUS FRAMEWORK:
- Core Wellness (local): ${localRadius}-mile radius (${radius.densityTier})
${radius.specialtyRadiusEnabled && regionalRadius ? `- Specialty (regional): ${regionalRadius}-mile radius for surgical/high-ticket specializations` : "- No regional specialty radius required"}

Location notes: ${form.locationNotes || "None"}
Practice specializations: ${formatSpecializations(form)}
Client rating override: ${form.clientGoogleRating || "Use web search"}
Client review count override: ${form.clientReviewCount || "Use web search"}

${clientRunsOwnAds ? `SALES NOTES FACT (non-negotiable): Client runs self-managed Google Ads per sales notes${extract?.adsPerformanceNote ? ` (${extract.adsPerformanceNote})` : ""}. Set clientMetrics.runsGoogleAds to true and treat ads as self-managed — do NOT override with SERP guess suggesting they do not advertise.` : ""}

WEB SEARCH REQUIRED:
1. Find ${form.practiceName}'s Google Business Profile rating, review count, and Google Ads presence (client has PPC in active plan: ${activeServices.includes("ppc") ? "yes" : "no"}).
2. Local competitors (scope: "local"): up to 4 within ${localRadius} miles — closest and highest-rated.
3. ${radius.specialtyRadiusEnabled && regionalRadius ? `Regional competitors (scope: "regional"): up to 3 specialty/surgical hospitals within ${regionalRadius} miles if relevant to specializations.` : "Skip regional competitors if not applicable."}
4. For each: name, distanceMiles, googleRating, reviewCount, runsGoogleAds (boolean), scope ("local" or "regional").
5. Do NOT exceed competitor limits — maximum 4 local and 3 regional entries. Stop searching once limits are met.

After completing web search, you MUST emit the structured JSON output matching the required schema as your final response.

${radius.rationale}`;
}

function formatVerifiedResearchPayload(research: StrategyMapperResearch): string {
  return JSON.stringify(research, null, 2);
}

export function buildStrategyMapperReportPrompt(
  form: StrategyMapperFormData,
  research: StrategyMapperResearch,
  upsellDirectives: UpsellDirective[],
  radius: DualRadiusResult,
  activeServices: StrategyMapperService[],
  selectedTierLabels: string[],
  upsellTierCandidates: UpsellTierCandidate[],
  tiers: ServiceTierTemplate[],
): string {
  const extract = form.salesPdfExtract;
  const socialInScope =
    activeServices.includes("social") ||
    upsellDirectives.some((d) => d.service === "social");

  const directiveLines = upsellDirectives.map(
    (d) =>
      `${SERVICE_LABELS[d.service]} (${d.framing}): ${upsellFramingExemplar(d.service, d.framing, extract)}`,
  );

  const forbiddenAdsPhrases = extract?.clientRunsOwnAds
    ? `
FORBIDDEN PHRASES (client runs own ads):
- "you do not run ads"
- "start advertising"
- "introduce PPC"
- "begin paid search"
- Any claim that the client lacks Google Ads presence`
    : "";

  const clinicalDrillDown =
    extract?.clinicalDifferentiator || (extract?.primaryProcedures.length ?? 0) > 0
      ? extract
        ? clinicalWeaponizationBlock(extract)
        : ""
      : "";

  const caseTransformationBlock =
    extract && wantsCaseTransformationGallery(extract)
      ? `
CASE TRANSFORMATION WORKFLOWS:
- Sales notes request before-and-after / success stories for clinical cases — reflect this in executiveSummary and Phase 2 social growthOpportunity whyItMatters when social is an upsell.
- ${upsellDirectives.some((d) => d.service === "social") ? "Phase 2 social growthOpportunity whyItMatters" : "executiveSummary narrative"}: mandate a protocol for broadcasting video-based client success stories and case transformations${extract.primarySocialPlatform ? ` on ${extract.primarySocialPlatform}` : ""}${extract.socialAdsHistory ? ` (leverage: ${extract.socialAdsHistory})` : ""}.
- Forbidden substitutes: "gather photo assets", "celebrate patient milestones", "behind-the-scenes content" WITHOUT specifying the surgical outcome gallery workflow.`
      : "";

  const ormContext = activeServices.includes("orm")
    ? `
ORM (Phase 1 — purchased tier language is pre-assembled):
- Describe ORM as active Phase 1 correction in painPointResolution — NOT a future upsell.
${extract?.ormProgramName ? `- Reference program tier in narrative: ${extract.ormProgramName}` : ""}`
    : "";

  const socialSpecificity =
    socialInScope && extract
      ? `
SOCIAL MEDIA SPECIFICITY (for executiveSummary and Phase 2 whyItMatters only — Phase 1 tactics are pre-assembled):
${extract.socialContentThemes.length ? `- Content themes from notes: ${extract.socialContentThemes.join("; ")}` : ""}
${wantsCaseTransformationGallery(extract) ? `- Client requested before-and-after / success stories — reference surgical outcome gallery protocol in narrative.` : ""}
${extract.primarySocialPlatform ? `- Primary platform: ${extract.primarySocialPlatform}` : ""}
${extract.socialAdsHistory ? `- Past social ads success: ${extract.socialAdsHistory}` : ""}`
      : "";

  const selectedTierSummary = selectedTierLabels.length
    ? selectedTierLabels.join("; ")
    : activeServices.map((s) => SERVICE_LABELS[s]).join(", ");

  const upsellTierSummary = upsellTierCandidates
    .map((c) => {
      const tier = tiers.find((t) => t.tierKey === c.tierKey);
      return tier ? `${SERVICE_LABELS[c.service]} → ${tier.tierLabel}` : c.service;
    })
    .join("; ");

  return `You are Beyond Indigo Pets' senior marketing strategist writing a CUSTOMIZED DIGITAL MARKETING PLAN.

APPROVED SERVICE TIER LIBRARY (Phase 1 is PRE-ASSEMBLED — do NOT output activeStrategies):
- Selected tiers for Phase 1: ${selectedTierSummary}
- Phase 1 objectives and tactics come verbatim from the Approved Service Tier Library; only bracket placeholders were substituted.
- Do NOT invent, paraphrase, or output activeStrategies — the system injects them after generation.

STRICT FACT-CHECKING PROTOCOL:
- Sales PDF extract is authoritative for operational facts: purchasedServices (Phase 1), doctor count, staff constraints, capacity, vendor platforms, ads status.
- Verified research JSON below is authoritative for market/competitive facts: client GBP metrics, competitor names, ratings, review counts, ads presence, and radius fields.
- NEVER list purchased services in growthOpportunities (Phase 2).
- Reference vendorPlatforms by name in painPointResolution when relevant (e.g. Demandforce closed-loop → GBP syndication).
${forbiddenAdsPhrases}

${toneInstructions(extract)}
${clinicalDrillDown}
${caseTransformationBlock}
${ormContext}
${socialSpecificity}
${extract?.clientRunsOwnAds && !activeServices.includes("ppc") ? "\nPPC is NOT purchased but client runs own ads — if PPC appears in Phase 2, use optimization framing only." : ""}

PRACTICE INPUT:
- Practice Name: ${form.practiceName}
- Practice Owner/Lead: ${form.practiceOwnerName || "Not provided"}
- Address: ${form.streetAddress}
- Geographic Focus: ${radius.geographicFocusLabel}
- Specializations: ${formatSpecializations(form)}
- Primary Goal: ${form.primaryGoal || "Not specified"}
- Strategic Context: ${form.strategicContextNotes || "None"}
- Active Phase 1 Services (from PDF product matcher or form): ${activeServices.map((s) => SERVICE_LABELS[s]).join(", ")}

SALES PDF EXTRACT:
${formatSalesExtract(extract)}

VERIFIED RESEARCH PAYLOAD (HUMAN-AUDITED — ABSOLUTE TRUTH):
1. STRICT ADHERENCE: Treat the JSON below as infallible. It was manually verified by a strategist.
2. NO EXTERNAL ASSUMPTIONS: Do not correct ratings, review counts, or competitor names using prior knowledge or training data. If a competitor has 0 reviews, write 0 reviews.
3. FACT-CHECK BEFORE OUTPUT: Executive summary, narrative, growthOpportunity whyItMatters, and seoKeywordMatrix must ONLY cite client/competitor metrics and names present in this JSON. Mentioning any competitor or metric not in the payload is a critical failure.
4. TONE: Maintain clinical weaponization (TPLO etc.) but anchor claims to audited sales extract + this payload only.

${formatVerifiedResearchPayload(research)}

INSTRUCTIONS:
1. executiveSummary.missionStatement — body text ONLY (do NOT prefix with "Our Shared Mission:" — the UI and export add that label once). Address real operational reality (${extract?.doctorCount || "use notes"} doctors, ${extract?.staffConstraints || "staff per notes"}). Do NOT hallucinate 24/7 or multi-doctor scale unless stated. When citing competitive gaps, use exact ratings and review counts from the verified payload only.
2. executiveSummary.painPointResolution — body text ONLY (do NOT prefix with "Direct Pain-Point Resolution:"). Directly address past agency/software failures; use vendor platform names from extract.
3. executiveSummary.coreFocusAreas — 3–5 bullet-level focus strings (pricing transparency, freeing from unresponsive web admin, etc.).
4. executiveSummary.narrative — supporting 2–3 sentence paragraph. Competitive comparisons must reference only competitors and metrics in the verified payload.
5. Competitive audit table is pre-assembled from verified payload — do NOT output competitiveAuditRows.
6. seoKeywordMatrix — ONLY if seo is active. Minimum 2 rows: High-Intent Specialty (regional) if specialty radius enabled, plus Local Core wellness.
7. growthOpportunities — ONLY these Phase 2 directives. Pre-assembled tier upsell candidates: ${upsellTierSummary || "none"}. For each directive, output ONLY service + whyItMatters (competitive context from verified payload only — quote exact review counts/ratings when comparing). Do NOT rewrite marketObservation or title — the system injects standardized tier language.
${directiveLines.length ? directiveLines.join("\n") : "   (none — return empty array)"}
8. launchRoadmap — exactly 3 steps: Kickoff Meeting, Technical Asset Gathering, Strategy Launch Day.
9. internalStrategistChecklist is pre-assembled — do NOT output internalStrategistChecklist.

Never include Phase 2 blocks except for listed directives. Never claim capabilities not supported by intake data. Never cite market metrics outside the verified research payload.`;
}
