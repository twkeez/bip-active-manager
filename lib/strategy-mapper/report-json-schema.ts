import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

const growthOpportunityBlockSchema = {
  type: "object",
  properties: {
    service: { type: "string", enum: ["seo", "ppc", "orm", "social"] },
    title: { type: "string" },
    marketObservation: { type: "string" },
    whyItMatters: { type: "string" },
  },
  required: ["service", "whyItMatters"],
  additionalProperties: false,
} as const;

/** LLM output schema — Phase 1 activeStrategies and competitive audit rows are assembled deterministically */
const strategyMapperPartialReportJsonSchema = {
  type: "object",
  properties: {
    executiveSummary: {
      type: "object",
      properties: {
        missionStatement: { type: "string" },
        narrative: { type: "string" },
        painPointResolution: { type: "string" },
        coreFocusAreas: { type: "array", items: { type: "string" } },
      },
      required: [
        "missionStatement",
        "narrative",
        "painPointResolution",
        "coreFocusAreas",
      ],
      additionalProperties: false,
    },
    seoKeywordMatrix: {
      type: "array",
      items: {
        type: "object",
        properties: {
          intentCategory: { type: "string" },
          targetGeography: { type: "string" },
          keywordVariations: { type: "array", items: { type: "string" } },
        },
        required: ["intentCategory", "targetGeography", "keywordVariations"],
        additionalProperties: false,
      },
    },
    growthOpportunities: {
      type: "array",
      items: growthOpportunityBlockSchema,
    },
    launchRoadmap: {
      type: "array",
      items: {
        type: "object",
        properties: {
          stepNumber: { type: "number" },
          title: { type: "string" },
          description: { type: "string" },
        },
        required: ["stepNumber", "title", "description"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "executiveSummary",
    "seoKeywordMatrix",
    "growthOpportunities",
    "launchRoadmap",
  ],
  additionalProperties: false,
} as const;

export const strategyMapperReportOutputFormat = jsonSchemaOutputFormat(
  strategyMapperPartialReportJsonSchema,
);
