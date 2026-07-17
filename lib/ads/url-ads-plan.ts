import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

// Standalone "plan Google Ads from a URL" — same output shape and same Best
// Practices constants (skeleton + universal negatives) as the onboarding
// campaign planner, so the two never drift. The only difference is the practice
// context is derived from the site instead of a client record.

export type UrlAdsPlan = {
  practiceSummary: { name: string; location: string; services: string };
  adGroups: Array<{ name: string; keywords: string[] }>;
  budgetNotes: string;
  negatives: string[];
};

const schema = {
  type: "object",
  properties: {
    practiceSummary: {
      type: "object",
      properties: {
        name: { type: "string" },
        location: { type: "string" },
        services: { type: "string" },
      },
      required: ["name", "location", "services"],
      additionalProperties: false,
    },
    adGroups: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          keywords: { type: "array", items: { type: "string" } },
        },
        required: ["name", "keywords"],
        additionalProperties: false,
      },
    },
    budgetNotes: { type: "string" },
    addedNegatives: { type: "array", items: { type: "string" } },
  },
  required: ["practiceSummary", "adGroups", "budgetNotes", "addedNegatives"],
  additionalProperties: false,
} as const;

export const urlAdsPlanOutputFormat = jsonSchemaOutputFormat(schema);

export function buildUrlAdsPlanPrompt(params: { url: string; city: string; skeleton: string }): string {
  const { url, city, skeleton } = params;
  return `You are a PPC strategist at a veterinary marketing agency drafting a Google Ads plan for a practice, working only from its website.

Read the practice's website (use web search): ${url}
Identify the practice name, its city/market, and the services it actually offers. ${city ? `The client says the market is ${city} — prefer that.` : ""}

Start from OUR standard campaign skeleton and adapt it to THIS practice — do not invent structure we do not use:
"""
${skeleton || "Ad groups by service: new client / vet near me, wellness, dental, emergency, surgery."}
"""

Produce:
- practiceSummary: { name, location, services } — what you learned from the site (services = a short comma list).
- adGroups: the skeleton's ad groups, each filled with 4-8 relevant, high-intent keywords for this practice's services and city. DROP groups for services they clearly do not offer; keep names consistent with our skeleton.
- budgetNotes: 2-3 sentences on budget split and priorities for this practice (weight toward emergency + new-client where they apply).
- addedNegatives: negative keywords SPECIFIC to this practice, BEYOND our universal list — competitor brand names near this market and services this practice does NOT offer. Do NOT repeat universal negatives like "free", "jobs", "adoption".

Keep it grounded in what the site actually shows. If you cannot read the site, say so in practiceSummary.name.`;
}
