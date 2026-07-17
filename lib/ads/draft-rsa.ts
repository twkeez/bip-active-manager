import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

// Google Ads Responsive Search Ad limits.
export const RSA_HEADLINE_MAX = 30;
export const RSA_DESCRIPTION_MAX = 90;

export type RsaDraft = { headlines: string[]; descriptions: string[] };

const rsaJsonSchema = {
  type: "object",
  properties: {
    headlines: { type: "array", items: { type: "string" } },
    descriptions: { type: "array", items: { type: "string" } },
  },
  required: ["headlines", "descriptions"],
  additionalProperties: false,
} as const;

export const rsaDraftOutputFormat = jsonSchemaOutputFormat(rsaJsonSchema);

export function buildRsaPrompt(params: {
  practiceName: string;
  city: string;
  campaign: string;
  keywords: string[];
  weakInput: "ad_relevance" | "expected_ctr";
}): string {
  const { practiceName, city, campaign, keywords, weakInput } = params;
  const focus =
    weakInput === "ad_relevance"
      ? "Ad relevance is the weak Ad Rank input, so the headlines MUST echo the exact search terms below — mirror their wording."
      : "Expected CTR is the weak Ad Rank input, so lead with the benefit and a reason to click now.";
  return `You are a PPC copywriter at a veterinary marketing agency writing Responsive Search Ad assets for ${practiceName}${city ? ` in ${city}` : ""}, for the "${campaign}" campaign.

The keywords this ad group targets: ${keywords.length ? keywords.join(", ") : "general veterinary services"}.

${focus}

Write:
- headlines: 12 distinct headlines, each MAX ${RSA_HEADLINE_MAX} characters (hard limit — count characters). Work in the practice name, the city, the service/keyword theme, and a call-to-action ("Call Today", "Book Online"). Vary them.
- descriptions: 4 distinct descriptions, each MAX ${RSA_DESCRIPTION_MAX} characters. Lead with what the pet owner gets; include a clear next step.

Sentence case. No exclamation marks. No claims that aren't safe for a vet clinic (no "best", no guarantees). Do not exceed the character limits.`;
}

// Enforce the length limits the model may overshoot, and drop empties/dupes.
export function clampRsa(draft: RsaDraft | null): RsaDraft {
  const clean = (arr: unknown, max: number) =>
    Array.from(
      new Set(
        (Array.isArray(arr) ? arr : [])
          .map((s) => (typeof s === "string" ? s.trim() : ""))
          .filter((s) => s.length > 0 && s.length <= max),
      ),
    );
  return {
    headlines: clean(draft?.headlines, RSA_HEADLINE_MAX),
    descriptions: clean(draft?.descriptions, RSA_DESCRIPTION_MAX),
  };
}
