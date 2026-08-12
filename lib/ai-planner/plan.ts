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

export type PlanIdea = { title: string; description: string; category: string };

const ideasSchema = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          category: { type: "string" },
        },
        required: ["title", "description", "category"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
} as const;

export const ideasOutputFormat = jsonSchemaOutputFormat(ideasSchema);

export function buildIdeasPrompt(params: {
  goal: string;
  clientName: string;
  url: string;
  notes: string;
  exclude: string[];
}): string {
  const { goal, clientName, url, notes, exclude } = params;
  return `You are a senior marketing strategist at Beyond Indigo, a veterinary marketing agency, brainstorming tactics with a colleague.

The goal: ${goal}
${clientName ? `The client: ${clientName}` : ""}
${url ? `Their website (read it with web search for real context — services, tone, booking options, current offers): ${url}` : ""}
${notes ? `Context and constraints from the strategist:\n${notes}` : ""}

Propose 10-14 concrete, specific tactic ideas the strategist can pick from. Spread them across channels — typical categories: "Website", "Google Business Profile & Local SEO", "Paid Ads", "Email & SMS", "Front Desk & Operations", "Social Media". Use only categories that fit the goal; name them exactly as you group them.

Each idea:
- title: a short, punchy label (4-8 words).
- description: 1-2 sentences saying exactly what we'd do and why it moves the goal — specific to THIS practice when you can read their site (reference real services, offers, booking tools).
- category: which channel group it belongs to.

Rules:
- Only tactics a veterinary marketing agency actually delivers (ads, local SEO, website changes, GBP, email/SMS, front-desk scripts, social).
- Each idea must stand alone — the strategist will check off a subset and discard the rest.
- Range from safe bets to a couple of bolder swings.
${exclude.length ? `- Do NOT repeat these ideas already on the board (bring genuinely new angles):\n${exclude.map((t) => `  • ${t}`).join("\n")}` : ""}`;
}

export function buildGeneratePrompt(params: {
  goal: string;
  clientName: string;
  url: string;
  notes: string;
  ideas?: PlanIdea[];
}): string {
  const { goal, clientName, url, notes, ideas } = params;
  const approved = ideas?.length
    ? `\nThe strategist reviewed a brainstorm and APPROVED exactly these tactics — the plan must be built around them:
${ideas.map((i) => `• [${i.category}] ${i.title} — ${i.description}`).join("\n")}

Rules for using the approved list:
- Every approved tactic must appear in the plan, fleshed out with practice-specific detail.
- Do NOT introduce major new tactics beyond the approved list. Supporting detail (measurement, timeline, what we need from the client) is expected — new channels or campaigns are not.
- Group approved tactics into sensible sections; keep their intent intact.\n`
    : "";
  return `You are a senior marketing strategist at Beyond Indigo, a veterinary marketing agency. Draft a polished, CLIENT-FACING project plan document.

The goal: ${goal}
${clientName ? `The client: ${clientName}` : ""}
${url ? `Their website (read it with web search for real context — services, tone, booking options): ${url}` : ""}
${notes ? `Additional context and constraints from the strategist:\n${notes}` : ""}
${approved}
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
