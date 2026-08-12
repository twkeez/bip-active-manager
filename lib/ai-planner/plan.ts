import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

// AI Planner — free-form, client-facing project plans drafted with Claude.
// Same Anthropic patterns as the ads planner (structured output + web search).

export const AI_PLANNER_MODEL = "claude-sonnet-4-6";

export type PlanSection = { heading: string; content: string };

export type PlanDoc = {
  title: string;
  intro: string;
  sections: PlanSection[];
};

const planSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    intro: { type: "string" },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          heading: { type: "string" },
          content: { type: "string" },
        },
        required: ["heading", "content"],
        additionalProperties: false,
      },
    },
  },
  required: ["title", "intro", "sections"],
  additionalProperties: false,
} as const;

export const planOutputFormat = jsonSchemaOutputFormat(planSchema);

const sectionSchema = {
  type: "object",
  properties: {
    heading: { type: "string" },
    content: { type: "string" },
  },
  required: ["heading", "content"],
  additionalProperties: false,
} as const;

export const sectionOutputFormat = jsonSchemaOutputFormat(sectionSchema);

export function buildGeneratePrompt(params: {
  goal: string;
  clientName: string;
  url: string;
  notes: string;
}): string {
  const { goal, clientName, url, notes } = params;
  return `You are a senior marketing strategist at Beyond Indigo, a veterinary marketing agency. Draft a polished, CLIENT-FACING project plan document.

The goal: ${goal}
${clientName ? `The client: ${clientName}` : ""}
${url ? `Their website (read it with web search for real context — services, tone, booking options): ${url}` : ""}
${notes ? `Additional context and constraints from the strategist:\n${notes}` : ""}

Write the plan as a document the client will actually read:
- title: a clear, professional document title (no "AI" mentions).
- intro: 2-4 sentences framing the goal and why this plan will work — warm, confident, plain English.
- sections: 4-7 named sections that organize the work. Typical shape: the opportunity / what we'll do (concrete tactics, grouped) / timeline / how we'll measure success / what we need from you. Adapt to the goal — don't force this shape.

Section content rules:
- Concrete and specific to THIS practice — reference what their website actually shows when you have it.
- Short paragraphs and simple dash lists (use "- " for list lines inside content). No markdown headers inside content, no tables.
- Client-friendly tone: no agency jargon, no internal process talk, never mention AI or this tool.
- Realistic: only recommend tactics a veterinary marketing agency actually delivers (ads, local SEO, website changes, GBP, email/SMS prompts, front-desk scripts, social).

If you cannot read the website, still produce the plan from the goal and notes — just keep claims generic rather than invented.`;
}

export function buildRefinePrompt(params: {
  doc: PlanDoc;
  sectionIndex: number;
  instruction: string;
}): string {
  const { doc, sectionIndex, instruction } = params;
  const section = doc.sections[sectionIndex];
  const outline = doc.sections.map((s, i) => `${i + 1}. ${s.heading}`).join("\n");
  return `You are revising ONE section of a client-facing marketing plan titled "${doc.title}".

Full document outline (for context — do not rewrite these):
${outline}

The section being revised is "${section.heading}":
"""
${section.content}
"""

The strategist's instruction: ${instruction}

Return the revised section (heading + content). Keep the heading unless the instruction asks to change it. Keep the same voice and formatting rules: client-friendly plain English, short paragraphs, "- " dash lists, no markdown headers, never mention AI.`;
}
