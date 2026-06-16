import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

const discoveryReportJsonSchema = {
  type: "object",
  properties: {
    capacityStrategy: { type: "string" },
    uvpPositioning: { type: "string" },
    reputationPlan: { type: "string" },
    websitePriorities: { type: "string" },
    onlinePresenceAudit: {
      type: "array",
      items: {
        type: "object",
        properties: {
          asset: { type: "string" },
          currentState: { type: "string" },
          requiredFix: { type: "string" },
          priority: { type: "string", enum: ["High", "Medium", "Low"] },
        },
        required: ["asset", "currentState", "requiredFix", "priority"],
        additionalProperties: false,
      },
    },
    competitorDeficitAnalysis: {
      type: "array",
      items: {
        type: "object",
        properties: {
          competitorName: { type: "string" },
          competitorCategory: { type: "string" },
          theirStrength: { type: "string" },
          digitalWeaknesses: {
            type: "array",
            items: { type: "string" },
          },
          yourAdvantage: { type: "string" },
        },
        required: [
          "competitorName",
          "competitorCategory",
          "theirStrength",
          "digitalWeaknesses",
          "yourAdvantage",
        ],
        additionalProperties: false,
      },
    },
    pricingComparison: {
      type: "array",
      items: {
        type: "object",
        properties: {
          competitorName: { type: "string" },
          serviceOrProcedure: { type: "string" },
          competitorPriceNote: { type: "string" },
          yourPriceNote: { type: "string" },
          valueAngle: { type: "string" },
        },
        required: [
          "competitorName",
          "serviceOrProcedure",
          "competitorPriceNote",
          "yourPriceNote",
          "valueAngle",
        ],
        additionalProperties: false,
      },
    },
    keywordGeoMatrix: {
      type: "array",
      items: {
        type: "object",
        properties: {
          campaignTier: { type: "string" },
          targetGeography: { type: "string" },
          primaryKeywords: {
            type: "array",
            items: { type: "string" },
          },
          searchIntent: { type: "string" },
        },
        required: [
          "campaignTier",
          "targetGeography",
          "primaryKeywords",
          "searchIntent",
        ],
        additionalProperties: false,
      },
    },
    monthlyChecklist: {
      type: "array",
      items: {
        type: "object",
        properties: {
          task: { type: "string" },
          category: { type: "string" },
        },
        required: ["task", "category"],
        additionalProperties: false,
      },
    },
    quarterlyChecklist: {
      type: "array",
      items: {
        type: "object",
        properties: {
          task: { type: "string" },
          category: { type: "string" },
        },
        required: ["task", "category"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "capacityStrategy",
    "uvpPositioning",
    "reputationPlan",
    "websitePriorities",
    "onlinePresenceAudit",
    "competitorDeficitAnalysis",
    "pricingComparison",
    "keywordGeoMatrix",
    "monthlyChecklist",
    "quarterlyChecklist",
  ],
  additionalProperties: false,
} as const;

export const discoveryReportOutputFormat = jsonSchemaOutputFormat(
  discoveryReportJsonSchema,
);
