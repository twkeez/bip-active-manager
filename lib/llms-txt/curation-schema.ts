import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

const linkSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    url: { type: "string" },
    description: { type: "string" },
    optional: { type: "boolean" },
  },
  required: ["title", "url", "description", "optional"],
  additionalProperties: false,
} as const;

const sectionSchema = {
  type: "object",
  properties: {
    name: { type: "string" },
    links: { type: "array", items: linkSchema },
  },
  required: ["name", "links"],
  additionalProperties: false,
} as const;

const llmsTxtCurationSchema = {
  type: "object",
  properties: {
    h1Title: { type: "string" },
    blockquoteSummary: { type: "string" },
    guidanceNotes: { type: "string" },
    sections: { type: "array", items: sectionSchema },
  },
  required: ["h1Title", "blockquoteSummary", "guidanceNotes", "sections"],
  additionalProperties: false,
} as const;

export const llmsTxtCurationOutputFormat = jsonSchemaOutputFormat(llmsTxtCurationSchema);
