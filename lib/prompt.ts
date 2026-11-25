import type {
  ClientFormData,
  LocalResearch,
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

/**
 * Extra instructions for research run on a known client (the discovery route),
 * where we know the exact location, the kind of practice and the background.
 * The standalone vet-onboarding tool passes none, so its prompt is unchanged.
 */
export type ResearchExtras = {
  /** From locationInstruction(): the full address and "ignore other towns named X". */
  locationInstruction?: string;
  /** From competitorGuidance(): who counts as a competitor for this kind of practice. */
  competitorGuidance?: string | null;
  /** Onboarding background (pipeline notes, kickoff doc, Basecamp). */
  background?: string;
};

export function buildResearchPrompt(data: ClientFormData, extras: ResearchExtras = {}): string {
  const extraBlock = [
    extras.locationInstruction,
    extras.competitorGuidance,
    extras.background ? `Context on this practice from onboarding:\n${extras.background}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
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

${buildDigitalFootprintResearchInstructions(data)}${extraBlock ? `\n\n${extraBlock}` : ""}`;
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

This document goes to the client. Do not state statistics, percentages, awards or credentials unless they appear in the intake or research above; describe the opportunity in words instead of inventing figures. Tailor all content to this practice's location, type, services, budget, goals, and local competitive landscape.${
    data.intakeGoals.length > 0 || data.intakeSummary
      ? " Prioritize the CLIENT STATED GOALS section above over generic recommendations."
      : ""
  }`;
}
