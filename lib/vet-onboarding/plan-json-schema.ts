import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

const onboardingPlanJsonSchema = {
  type: "object",
  properties: {
    welcome: { type: "string" },
    whyItMatters: { type: "string" },
    stats: {
      type: "array",
      items: {
        type: "object",
        properties: {
          num: { type: "string" },
          label: { type: "string" },
        },
        required: ["num", "label"],
        additionalProperties: false,
      },
    },
    serviceStrategy: { type: "string" },
    goalsPlan: { type: "string" },
    roadmap: {
      type: "array",
      items: {
        type: "object",
        properties: {
          phase: { type: "string" },
          title: { type: "string" },
          actions: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["phase", "title", "actions"],
        additionalProperties: false,
      },
    },
    quickWins: {
      type: "array",
      items: { type: "string" },
    },
    nextSteps: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "welcome",
    "whyItMatters",
    "stats",
    "serviceStrategy",
    "goalsPlan",
    "roadmap",
    "quickWins",
    "nextSteps",
  ],
  additionalProperties: false,
} as const;

export const onboardingPlanOutputFormat = jsonSchemaOutputFormat(
  onboardingPlanJsonSchema,
);
