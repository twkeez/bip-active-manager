import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

const strategyMapperResearchJsonSchema = {
  type: "object",
  properties: {
    densityTier: { type: "string", enum: ["urban", "suburban", "rural"] },
    wellnessRadiusMiles: { type: "number" },
    specialtyRadiusMiles: { type: ["number", "null"] },
    specialtyRadiusEnabled: { type: "boolean" },
    radiusRationale: { type: "string" },
    clientMetrics: {
      type: "object",
      properties: {
        googleRating: { type: "number" },
        reviewCount: { type: "number" },
        runsGoogleAds: { type: "boolean" },
      },
      required: ["googleRating", "reviewCount", "runsGoogleAds"],
      additionalProperties: false,
    },
    competitors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          distanceMiles: { type: "number" },
          googleRating: { type: "number" },
          reviewCount: { type: "number" },
          runsGoogleAds: { type: "boolean" },
          scope: { type: "string", enum: ["local", "regional"] },
        },
        required: [
          "name",
          "distanceMiles",
          "googleRating",
          "reviewCount",
          "runsGoogleAds",
          "scope",
        ],
        additionalProperties: false,
      },
    },
  },
  required: [
    "densityTier",
    "wellnessRadiusMiles",
    "specialtyRadiusMiles",
    "specialtyRadiusEnabled",
    "radiusRationale",
    "clientMetrics",
    "competitors",
  ],
  additionalProperties: false,
} as const;

export const strategyMapperResearchOutputFormat = jsonSchemaOutputFormat(
  strategyMapperResearchJsonSchema,
);
