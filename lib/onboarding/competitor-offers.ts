import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

export type CompetitorOffer = {
  name: string;
  offers: string;
  positioning: string;
  counter: string;
};

const competitorOffersJsonSchema = {
  type: "object",
  properties: {
    competitors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          offers: { type: "string" },
          positioning: { type: "string" },
          counter: { type: "string" },
        },
        required: ["name", "offers", "positioning", "counter"],
        additionalProperties: false,
      },
    },
  },
  required: ["competitors"],
  additionalProperties: false,
} as const;

export const competitorOffersOutputFormat = jsonSchemaOutputFormat(competitorOffersJsonSchema);

export function buildCompetitorOffersPrompt(
  practiceName: string,
  location: string,
  notes: string,
): string {
  return `You research the competitive landscape for ${practiceName}, a veterinary practice in ${location || "its local market"}, for our marketing strategist.

Use web search to identify 3-5 real competing veterinary practices in the area. For each, return:
- name
- offers: what they are currently promoting or advertising — new-client exam specials, emergency / urgent care, wellness plans, financing, discounts. Cite specifics found on their site / Google Business Profile / social; if none found, note their likely draw.
- positioning: the angle they emphasize (e.g. low-cost, boutique, 24/7 emergency, fear-free).
- counter: one concrete way ${practiceName} can position against them.
${notes ? `\nContext on our practice:\n${notes}` : ""}

Complete your searches first, then populate the structured output.`;
}
