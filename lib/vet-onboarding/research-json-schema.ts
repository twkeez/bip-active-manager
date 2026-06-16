import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

const localResearchJsonSchema = {
  type: "object",
  properties: {
    competitors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          note: { type: "string" },
        },
        required: ["name", "note"],
        additionalProperties: false,
      },
    },
    marketSnapshot: { type: "string" },
    searchLandscape: { type: "string" },
  },
  required: ["competitors", "marketSnapshot", "searchLandscape"],
  additionalProperties: false,
} as const;

export const localResearchOutputFormat = jsonSchemaOutputFormat(
  localResearchJsonSchema,
);
