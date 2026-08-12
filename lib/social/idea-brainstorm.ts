import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { CAMPAIGN_TYPE_KEYS } from "./campaign-types";
import type { StandingCampaign } from "./types";

// Fresh, practice-specific post concepts for the calendar builder's idea board.
// Complements the shared idea repository — these are invented per practice.

const IDEA_MODEL = "claude-opus-4-8";

export type FreshIdea = {
  title: string;
  description: string;
  shot_idea: string;
  campaign_type: string;
};

const freshIdeasSchema = {
  type: "object",
  properties: {
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          shot_idea: { type: "string" },
          campaign_type: { type: "string", enum: CAMPAIGN_TYPE_KEYS },
        },
        required: ["title", "description", "shot_idea", "campaign_type"],
        additionalProperties: false,
      },
    },
  },
  required: ["ideas"],
  additionalProperties: false,
} as const;

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export async function generateFreshIdeas(params: {
  apiKey: string;
  clientName: string;
  website: string | null;
  month: number;
  specialty: string | null;
  tone: string | null;
  notes: string | null;
  standingCampaigns: StandingCampaign[];
  exclude: string[];
}): Promise<FreshIdea[]> {
  const { apiKey, clientName, website, month, specialty, tone, notes, standingCampaigns, exclude } = params;

  const standingBlock = standingCampaigns.length > 0
    ? standingCampaigns.map((c) => `- ${c.name}: ${c.description}`).join("\n")
    : "None.";

  const prompt = `You are a creative social media strategist at a veterinary marketing agency, brainstorming post concepts for one specific practice. The goal: cute, personal, scroll-stopping ideas the practice can actually shoot themselves — NOT generic stock-photo content.

PRACTICE: ${clientName}
Specialty: ${specialty ?? "General small animal practice"}
Tone: ${tone ?? "Warm, friendly, and professional"}
Notes from the strategist: ${notes ?? "None"}
${website ? `Their website (read it with web search — look for team pages, resident pets, services, personality): ${website}` : ""}
Planning month: ${MONTH_NAMES[month]}

STANDING CAMPAIGNS already running (don't duplicate these):
${standingBlock}

Invent 8-10 fresh post concepts SPECIFIC to this practice. The kind of ideas that win: a recurring series from the clinic cat's perspective, a "trick for a treat" video where a patient does their best trick, a tech's favorite patient of the week, the front-desk fish getting a name vote, staff recreating their pets' dramatic poses. Charming, personal, filmable-on-a-phone.

Each idea:
- title: short, punchy concept name (3-7 words).
- description: 1-2 sentences on the concept and why it will land for THIS practice — reference real things from their site when you can (team members, resident pets, services, their vibe).
- shot_idea: exactly what photo or video the practice needs to capture, written so the front desk can do it with a phone (framing, who/what's in it, roughly how long if video).
- campaign_type: the best-fitting key from: ${CAMPAIGN_TYPE_KEYS.join(", ")}.

Rules:
- Every idea must be shootable in the clinic with a phone — no professional shoots, no stock imagery.
- Seasonal hooks for ${MONTH_NAMES[month]} are welcome on 2-3 ideas, but most should be evergreen.
- Range from safe-and-sweet to a couple of playful swings.
${exclude.length ? `- Do NOT repeat these concepts already on the board:\n${exclude.map((t) => `  • ${t}`).join("\n")}` : ""}`;

  const client = new Anthropic({ apiKey });
  const message = await client.messages.parse({
    model: IDEA_MODEL,
    max_tokens: 4096,
    ...(website ? { tools: [{ type: "web_search_20250305" as const, name: "web_search" as const }] } : {}),
    messages: [{ role: "user", content: prompt }],
    output_config: { format: jsonSchemaOutputFormat(freshIdeasSchema) },
  });

  const parsed = message.parsed_output as { ideas?: FreshIdea[] } | null;
  return parsed?.ideas ?? [];
}
