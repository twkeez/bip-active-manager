import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

export type CampaignPlan = {
  adGroups: Array<{ name: string; keywords: string[] }>;
  budgetNotes: string;
  negatives: string[];
};

const campaignPlanJsonSchema = {
  type: "object",
  properties: {
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
  required: ["adGroups", "budgetNotes", "addedNegatives"],
  additionalProperties: false,
} as const;

export const campaignPlanOutputFormat = jsonSchemaOutputFormat(campaignPlanJsonSchema);

export function buildCampaignPlanPrompt(params: {
  practiceName: string;
  location: string;
  notes: string;
  keywords: string[];
  competitors: Array<{ name: string; offers: string }>;
  skeleton: string;
}): string {
  const { practiceName, location, notes, keywords, competitors, skeleton } = params;
  return `You are a PPC strategist at a veterinary marketing agency drafting a Google Ads campaign plan for ${practiceName} in ${location || "its local market"}.

Start from OUR standard campaign skeleton and adapt it to THIS practice — do not invent structure we do not use:
"""
${skeleton || "Ad groups by service: new client / vet near me, wellness, dental, emergency, surgery."}
"""

Practice context (services, notes):
${notes || "General veterinary practice."}

Tracked keywords: ${keywords.length ? keywords.join(", ") : "none yet"}.

Competitors and their offers:
${competitors.length ? competitors.map((c) => `- ${c.name}: ${c.offers}`).join("\n") : "none researched yet"}

Produce:
- adGroups: the skeleton's ad groups, each filled with 4-8 relevant keywords for this practice's services and city. Drop groups for services they clearly do not offer.
- budgetNotes: 2-3 sentences on budget split and priorities for this practice.
- addedNegatives: negative keywords SPECIFIC to this practice, BEYOND our universal list — competitor brand names (from the competitors above) and services this practice does NOT offer. Do not repeat universal negatives like "free" or "jobs".`;
}
