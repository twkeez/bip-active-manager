import type {
  ClientFormData,
  DiscoveryFormData,
  LocalResearch,
  OnboardingPlan,
} from "@/types/onboarding";
import {
  BUDGET_OPTIONS,
  MAIN_GOALS,
  MARKETING_MANAGED_BY_OPTIONS,
  NUM_VETS_OPTIONS,
  PRESENCE_OPTIONS,
  PRACTICE_TYPES,
  SERVICES,
  TIMELINE_OPTIONS,
} from "@/lib/vet-onboarding/form-options";
import { formatUrlListForPrompt } from "@/lib/vet-onboarding/url-helpers";

const EXTRACTION_JSON_SCHEMA = `{
  "practiceName": "",
  "contactName": "",
  "location": "",
  "practiceType": "",
  "numVets": "",
  "services": [],
  "mainGoal": "",
  "challenge": "",
  "budget": "",
  "timeline": "",
  "presence": "",
  "notes": "",
  "websiteUrl": "",
  "googleBusinessProfileUrls": "",
  "facebookUrl": "",
  "instagramUrl": "",
  "otherSocialUrls": "",
  "practicePhone": "",
  "onlineBookingUrl": "",
  "serviceAreaNotes": "",
  "marketingManagedBy": "",
  "previousAgencyName": "",
  "intakeGoals": ["Specific client goal 1", "Specific client goal 2"],
  "intakeSummary": "2–4 sentence narrative summarizing everything the client wants to achieve, their priorities, success metrics, and constraints"
}`;

const EXTRACTION_RULES = `Read the entire intake form carefully — including checkboxes, handwritten-style fields, goal sections, and marketing priorities.

For intakeGoals: extract EVERY specific marketing or business goal the client stated (e.g. "increase new puppy appointments", "rank #1 for emergency vet", "fix Google reviews", "grow social following"). Use their wording where possible. Include 2–8 goals when present.

For intakeSummary: synthesize how all their goals fit together and what success looks like to them.

For challenge: combine their biggest obstacle with context from the form.

For notes: capture any remaining details not covered elsewhere (target audiences, competitors they mentioned, special services, etc.).

For digital footprint fields: extract website URL, Google Business Profile URL(s), Facebook, Instagram, other social URLs, practice phone, online booking URL, service area notes, and who manages marketing. Put multiple GBP or social URLs on separate lines in googleBusinessProfileUrls or otherSocialUrls. Use empty string when unknown.

Use empty string or empty array when truly unknown. Pick the closest allowed enum value when a field matches.`;

function buildExtractionPromptPreamble(): string {
  return `You are an intake specialist at Beyond Indigo Pets, a veterinary marketing agency in the USA.

Extract onboarding intake fields from the client's intake form or sales brief. Infer missing values when reasonable.

ALLOWED practiceType values: ${PRACTICE_TYPES.join(" | ")}
ALLOWED numVets values: ${NUM_VETS_OPTIONS.join(" | ")}
ALLOWED services (pick all that apply): ${SERVICES.join(" | ")}
ALLOWED mainGoal values: ${MAIN_GOALS.join(" | ")}
ALLOWED budget values: ${BUDGET_OPTIONS.join(" | ")}
ALLOWED timeline values: ${TIMELINE_OPTIONS.join(" | ")}
ALLOWED presence values: ${PRESENCE_OPTIONS.join(" | ")}
ALLOWED marketingManagedBy values: ${MARKETING_MANAGED_BY_OPTIONS.join(" | ")}

${EXTRACTION_RULES}

Respond with STRICT JSON only — no markdown, no backticks, no commentary. Return raw JSON matching this exact structure:

${EXTRACTION_JSON_SCHEMA}`;
}

export function buildDocumentExtractionPrompt(documentText: string): string {
  return `${buildExtractionPromptPreamble()}

DOCUMENT TEXT:
"""
${documentText.slice(0, 14000)}
"""`;
}

export function buildPdfDocumentExtractionPrompt(): string {
  return `${buildExtractionPromptPreamble()}

The client's intake form is attached as a PDF. Read all pages, form fields, and goal sections in the document.`;
}

function buildIntakeGoalsSection(data: ClientFormData): string {
  if (!data.intakeGoals.length && !data.intakeSummary.trim()) {
    return "";
  }

  const goalsList =
    data.intakeGoals.length > 0
      ? data.intakeGoals.map((g) => `- ${g}`).join("\n")
      : "- (see summary below)";

  return `

CLIENT STATED GOALS (from their intake form — these are the top priority; every section of the plan must address them directly):
${goalsList}

INTAKE SUMMARY:
${data.intakeSummary || "See goals above."}

INSTRUCTIONS FOR GOALS ALIGNMENT:
- The "goalsPlan" field must explain specifically how Beyond Indigo Pets will help them achieve EACH stated goal.
- Roadmap actions, quick wins, and next steps must map directly to these goals — not generic advice.
- Reference their exact goal language where natural.`;
}

function buildDigitalFootprintSection(data: ClientFormData): string {
  const hasDigital =
    data.websiteUrl ||
    data.googleBusinessProfileUrls ||
    data.facebookUrl ||
    data.instagramUrl ||
    data.otherSocialUrls ||
    data.practicePhone ||
    data.onlineBookingUrl ||
    data.serviceAreaNotes ||
    data.marketingManagedBy;

  if (!hasDigital) return "";

  return `

DIGITAL FOOTPRINT (client-provided — audit these properties when URLs are present):
- Website: ${data.websiteUrl || "Not provided"}
- Google Business Profile(s): ${formatUrlListForPrompt(data.googleBusinessProfileUrls)}
- Facebook: ${data.facebookUrl || "Not provided"}
- Instagram: ${data.instagramUrl || "Not provided"}
- Other social: ${formatUrlListForPrompt(data.otherSocialUrls)}
- Practice phone: ${data.practicePhone || "Not provided"}
- Online booking URL: ${data.onlineBookingUrl || "Not provided"}
- Service area: ${data.serviceAreaNotes || "Not provided"}
- Marketing managed by: ${data.marketingManagedBy || "Not provided"}${data.previousAgencyName ? ` (${data.previousAgencyName})` : ""}`;
}

function buildDigitalFootprintResearchInstructions(data: ClientFormData): string {
  const hasUrls =
    data.websiteUrl ||
    data.googleBusinessProfileUrls ||
    data.facebookUrl ||
    data.instagramUrl ||
    data.otherSocialUrls;

  if (!hasUrls) {
    return `Include 3–5 real competing vet practices in ${data.location} when possible. Base findings on current web search results.`;
  }

  return `PRIORITY: Before researching competitors, use web search to audit the client's own digital properties:
- Website: ${data.websiteUrl || "Not provided"}
- Google Business Profile(s): ${formatUrlListForPrompt(data.googleBusinessProfileUrls)}
- Facebook: ${data.facebookUrl || "Not provided"}
- Instagram: ${data.instagramUrl || "Not provided"}
- Other social: ${formatUrlListForPrompt(data.otherSocialUrls)}
- Practice phone (for NAP check): ${data.practicePhone || "Not provided"}

Assess website quality, GBP completeness and reviews, social activity, and NAP consistency (name, address, phone) across properties. Note specific gaps or strengths in marketSnapshot and searchLandscape.

Then include 3–5 real competing vet practices in ${data.location}. Base findings on current web search results.`;
}

export function buildResearchPrompt(data: ClientFormData): string {
  return `You are a local market researcher for Beyond Indigo Pets, a veterinary marketing agency in the USA.

Use web search to research the competitive and local market context for this veterinary practice. Complete your searches first, then populate the structured output.

- Practice Name: ${data.practiceName}
- Location: ${data.location}
- Practice Type: ${data.practiceType}
${buildDigitalFootprintSection(data)}

Return:
- competitors: 3–5 real competing vet practices in ${data.location}, each with a one-sentence note on positioning, strengths, or visibility
- marketSnapshot: 2–3 sentences on the local pet owner market (pet ownership, population, notable local trends)
- searchLandscape: 1–2 sentences on how competitive the local vet search market is and what stands out

${buildDigitalFootprintResearchInstructions(data)}`;
}

export function buildPrompt(data: ClientFormData, research: LocalResearch): string {
  const competitorList = research.competitors
    .map((c) => `${c.name} (${c.note})`)
    .join("; ");

  return `You are a senior marketing strategist at Beyond Indigo Pets, a veterinary marketing agency that works exclusively with veterinary practices in the USA.

Beyond Indigo Pets has 25+ years of veterinary marketing expertise, is a Google Partner, and an AAHA Strategic Alliance member.

A new client has completed their onboarding intake form. Based on their responses AND the local research below, create a personalized onboarding plan.

TONE OF VOICE: Confident, warm, results-focused, and plain-spoken. Avoid jargon. Write as Beyond Indigo Pets — use "we" and "our team" where natural.

When giving strategy advice, weave in competitor names specifically (e.g. "to stand out from Riverside Vets and Happy Paws Animal Hospital…").

CLIENT DETAILS:
- Practice Name: ${data.practiceName}
- Contact Name: ${data.contactName}
- Location: ${data.location}
- Practice Type: ${data.practiceType}
- Number of Veterinarians: ${data.numVets}
- Services Interested In: ${data.services.join(", ")}
- Main Goal: ${data.mainGoal}
- Biggest Challenge: ${data.challenge}
- Monthly Marketing Budget: ${data.budget}
- Desired Timeline: ${data.timeline}
- Existing Digital Presence: ${data.presence}
- Additional Notes: ${data.notes || "None provided"}
${buildDigitalFootprintSection(data)}
${buildIntakeGoalsSection(data)}

LOCAL RESEARCH (from web search):
- Competitors: ${competitorList}
- Market Snapshot: ${research.marketSnapshot}
- Search Landscape: ${research.searchLandscape}

Respond with STRICT JSON only — no markdown, no backticks, no commentary. Return raw JSON matching this exact structure:

{
  "welcome": "A warm, personalized welcome from Beyond Indigo Pets addressing the contact by name and referencing their practice",
  "whyItMatters": "A paragraph explaining why digital marketing matters for their practice type, goals, and local market",
  "stats": [
    { "num": "XX%", "label": "Relevant industry stat label" },
    { "num": "XX%", "label": "Relevant industry stat label" },
    { "num": "XX%", "label": "Relevant industry stat label" }
  ],
  "serviceStrategy": "A paragraph on recommended strategy based on selected services, goals, and how to compete locally — reference specific competitor names",
  "goalsPlan": "A paragraph explaining how Beyond Indigo Pets will help the client achieve their specific stated goals — reference each goal and the tactics we will use",
  "roadmap": [
    { "phase": "30 Days", "title": "Phase title", "actions": ["Action 1", "Action 2", "Action 3"] },
    { "phase": "60 Days", "title": "Phase title", "actions": ["Action 1", "Action 2", "Action 3"] },
    { "phase": "90 Days", "title": "Phase title", "actions": ["Action 1", "Action 2", "Action 3"] }
  ],
  "quickWins": ["Quick win 1", "Quick win 2", "Quick win 3"],
  "nextSteps": ["Next step 1", "Next step 2", "Next step 3"]
}

Use realistic veterinary industry statistics. Tailor all content to this practice's location, type, services, budget, goals, and local competitive landscape. Reference Beyond Indigo Pets credentials where appropriate.${
    data.intakeGoals.length > 0 || data.intakeSummary
      ? " Prioritize the CLIENT STATED GOALS section above over generic recommendations."
      : ""
  }`;
}

function formatDiscoverySection(
  label: string,
  value: string | string[],
): string {
  if (Array.isArray(value)) {
    return `- ${label}: ${value.length > 0 ? value.join(", ") : "None selected"}`;
  }
  return `- ${label}: ${value || "Not provided"}`;
}

export function buildDiscoveryPrompt(
  clientData: ClientFormData,
  discoveryData: DiscoveryFormData,
  onboardingPlan?: OnboardingPlan,
): string {
  const differentiators = [...discoveryData.differentiators];
  if (
    differentiators.includes("Other") &&
    discoveryData.differentiatorOther.trim()
  ) {
    const idx = differentiators.indexOf("Other");
    differentiators[idx] = `Other: ${discoveryData.differentiatorOther.trim()}`;
  }

  const competitorNames = discoveryData.competitorNames.trim();
  const clientFootprintAudit = buildDigitalFootprintSection(clientData);
  const webSearchInstructions = `${
    clientFootprintAudit
      ? `\n\nWEB SEARCH REQUIRED — CLIENT AUDIT: Audit ${clientData.practiceName}'s own digital properties (website, GBP, social URLs from DIGITAL FOOTPRINT). Check NAP consistency, GBP completeness, review velocity, posting cadence, booking UX, and visible ad presence. Populate onlinePresenceAudit with harsh, specific findings.`
      : `\n\nWEB SEARCH REQUIRED — CLIENT AUDIT: Search for ${clientData.practiceName} in ${clientData.location}. Audit their GBP, website, and social presence for onlinePresenceAudit.`
  }${
    competitorNames
      ? `\n\nWEB SEARCH REQUIRED — COMPETITOR INTEL: Look up these specific competitors in ${clientData.location}: ${competitorNames}. For EACH named competitor, search GBP ratings/review counts, Google Ads/SERP presence, social activity, review response habits, local SEO visibility in nearby towns, and any public pricing. Populate competitorDeficitAnalysis with 2–4 digitalWeaknesses per competitor and pricingComparison rows where procedure pricing is findable.`
      : `\n\nWEB SEARCH REQUIRED — COMPETITOR INTEL: Search for top veterinary competitors in ${clientData.location}. Populate competitorDeficitAnalysis and pricingComparison with real local context.`
  }`;

  const onboardingContext = onboardingPlan
    ? `\n\nEXISTING ONBOARDING PLAN SUMMARY (already delivered to client — extend, do not repeat verbatim):
- Service strategy: ${onboardingPlan.serviceStrategy.slice(0, 400)}…
- Goals plan: ${onboardingPlan.goalsPlan.slice(0, 400)}…
- Quick wins: ${onboardingPlan.quickWins.join("; ")}`
    : "";

  const nearCapacity =
    discoveryData.bookingAvailability.includes("3+ weeks") ||
    discoveryData.bookingAvailability.includes("near capacity");

  return `You are Beyond Indigo Pets' senior marketing strategist conducting a FULL PRACTICE DISCOVERY for a veterinary client. This is a deeper diagnostic layer after initial onboarding — be direct, specific, and actionable. Avoid generic advice; reference the actual data provided.

Beyond Indigo Pets has 25+ years of veterinary marketing expertise, is a Google Partner, and an AAHA Strategic Alliance member. Sign off recommendations as coming from Beyond Indigo Pets.

CAPACITY INSIGHT: Booking availability is "${discoveryData.bookingAvailability}". Client focus is "${discoveryData.clientFocus}". ${
    nearCapacity
      ? "They appear near capacity — prioritize higher-margin service marketing (dental, diagnostics, wellness plans) over broad new-patient acquisition unless their stated focus demands otherwise."
      : "They have appointment availability — new patient acquisition and local visibility should feature prominently if aligned with their goals."
  }

ORIGINAL CLIENT INTAKE:
- Practice Name: ${clientData.practiceName}
- Contact Name: ${clientData.contactName}
- Location: ${clientData.location}
- Practice Type: ${clientData.practiceType}
- Number of Veterinarians: ${clientData.numVets}
- Services Interested In: ${clientData.services.join(", ")}
- Main Goal: ${clientData.mainGoal}
- Biggest Challenge: ${clientData.challenge}
- Monthly Marketing Budget: ${clientData.budget}
- Desired Timeline: ${clientData.timeline}
- Existing Digital Presence: ${clientData.presence}
- Additional Notes: ${clientData.notes || "None"}
${buildDigitalFootprintSection(clientData)}
${buildIntakeGoalsSection(clientData)}

DISCOVERY — CAPACITY & PRACTICE DNA:
${formatDiscoverySection("Client focus", discoveryData.clientFocus)}
${formatDiscoverySection("Booking availability", discoveryData.bookingAvailability)}
${formatDiscoverySection("Standout differentiators / UVP", differentiators)}
${formatDiscoverySection("Avg transaction value", discoveryData.avgTransactionValue)}
${formatDiscoverySection("Customer lifetime value", discoveryData.customerLifetimeValue)}

DISCOVERY — REPUTATION & DIGITAL AUDIT:
${formatDiscoverySection("Google star rating", discoveryData.googleRating)}
${formatDiscoverySection("Google review count", discoveryData.googleReviewCount)}
${formatDiscoverySection("Review response habit", discoveryData.reviewResponseHabit)}
${formatDiscoverySection("Mobile-friendly website", discoveryData.mobileFriendly)}
${formatDiscoverySection("Online booking", discoveryData.onlineBooking)}
${formatDiscoverySection("Practice management / booking software", discoveryData.practiceSoftware)}

DISCOVERY — COMPETITIVE LANDSCAPE:
${formatDiscoverySection("Clinic setting", discoveryData.clinicSetting)}
${formatDiscoverySection("Primary competitor types", discoveryData.competitorTypes)}
${formatDiscoverySection("Competitors running Google Ads", discoveryData.competitorsRunningAds)}
${formatDiscoverySection("Competitors active on social", discoveryData.competitorsSocialActive)}
${formatDiscoverySection("Market gaps to fill", discoveryData.marketGaps)}
${formatDiscoverySection("Named competitors to analyse", competitorNames || "None provided")}
${webSearchInstructions}
${onboardingContext}

Transform this intake into a comprehensive, data-driven Local Marketing Strategy Guide. ANALYZE — do not summarize. Every weakness, keyword, and checklist item must reference ${clientData.practiceName}'s location, competitors, service area, ATV, or intake fields — never generic veterinary marketing boilerplate.

Generate STRICT JSON only — no markdown, no backticks, no commentary. Return raw JSON matching this exact structure:

{
  "capacityStrategy": "Based on booking availability, client focus, and ATV/CLV — what should marketing focus actually be? Be specific (e.g. if near capacity, recommend dental/diagnostics campaigns not new patient acquisition). 2–4 sentences.",
  "uvpPositioning": "2–3 sentences on how to position their specific differentiator(s) in Google Ads, social media, and SEO copy. Reference their actual UVP selections.",
  "reputationPlan": "Specific action plan based on Google rating, review count, and response habits. Include tactics to exploit competitor review weaknesses found via search. 3–5 sentences.",
  "websitePriorities": "2–3 specific website fixes based on mobile-friendliness, booking button visibility, and software integration reported. Be concrete, not generic.",
  "onlinePresenceAudit": [
    {
      "asset": "Website | Google Business Profile | Facebook | Instagram | Online booking | Other",
      "currentState": "What exists today based on intake and web search — be specific and critical",
      "requiredFix": "Concrete fix Beyond Indigo Pets should implement",
      "priority": "High | Medium | Low"
    }
  ],
  "competitorDeficitAnalysis": [
    {
      "competitorName": "Named competitor or category label",
      "competitorCategory": "e.g. Surgical referral hospital | Local wellness | Corporate group | Emergency",
      "theirStrength": "One sentence on this competitor's market strength in ${clientData.location}",
      "digitalWeaknesses": ["2–4 explicit digital vulnerabilities found via search — e.g. weak town-level SEO, no transparent pricing, poor review response, low GBP posting"],
      "yourAdvantage": "One sentence weaponizing ${clientData.practiceName}'s ATV, booking availability, differentiators, or pricing vs this competitor"
    }
  ],
  "pricingComparison": [
    {
      "competitorName": "Competitor or regional benchmark",
      "serviceOrProcedure": "e.g. TPLO, dental cleaning, wellness exam",
      "competitorPriceNote": "Their price or estimated range from search/intake — note source if estimated",
      "yourPriceNote": "Client price from intake/ATV or reasonable estimate",
      "valueAngle": "Why ${clientData.practiceName} wins on value — emphasize affordable specialty angle when ATV supports it"
    }
  ],
  "keywordGeoMatrix": [
    {
      "campaignTier": "e.g. Local Wellness (0–10mi) | Surgical Referral (30–50mi)",
      "targetGeography": "Specific towns/regions derived from location and service area notes",
      "primaryKeywords": ["3–5 concrete keyword phrases for this tier"],
      "searchIntent": "What this tier achieves — local volume vs high-ATV conversion"
    }
  ],
  "monthlyChecklist": [
    {
      "task": "Specific recurring task for Beyond Indigo Pets team this month",
      "category": "GBP | Paid Ads | SEO | Analytics | Reviews | Content"
    }
  ],
  "quarterlyChecklist": [
    {
      "task": "Specific quarterly strategic task — competitor re-audit, content drop, review health check",
      "category": "Competitor Audit | Content | Reviews | Strategy | Analytics"
    }
  ]
}

REQUIREMENTS:
- onlinePresenceAudit: 4–8 rows covering website, GBP, key social channels, and booking path
- competitorDeficitAnalysis: one row per named competitor${competitorNames ? ` (${competitorNames})` : ""} PLUS one row per competitor type selected (${discoveryData.competitorTypes.join(", ") || "none"})
- pricingComparison: 3–6 rows when ATV, services, or intake notes mention procedures; use search estimates when exact prices unavailable
- keywordGeoMatrix: minimum 2 tiers (local wellness 0–10mi AND surgical/specialty referral 30–50mi) when intake supports both; derive geography from ${clientData.location} and service area: ${clientData.serviceAreaNotes || "not specified"}
- monthlyChecklist: 5–8 actionable BIP team tasks (GBP posting 2x/week, review responses, paid ad optimization if budget warrants, SEO rank monitoring, capacity/analytics review)
- quarterlyChecklist: 4–6 tasks (re-audit named competitors, publish surgical case study + community piece, review star-rating recovery vs baseline ${discoveryData.googleRating} / ${discoveryData.googleReviewCount} reviews)`;
}
