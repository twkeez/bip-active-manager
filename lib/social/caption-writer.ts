import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import type { StandingCampaign } from "./types";

// Writes copy for posts that are ALREADY on the calendar. Placement is manual —
// nothing here decides dates, topics, or how many posts a month should have.
//
// Same model as the rest of the social pipeline (idea-brainstorm.ts).
const CAPTION_MODEL = "claude-opus-4-8";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** One post needing copy, with whatever context we can resolve for it. */
export type CaptionRequestPost = {
  id: number;
  post_date: string;
  campaign_label: string;
  /** From the linked idea, awareness day, or the label itself when neither. */
  description: string;
};

export type WrittenCaption = {
  post_id: number;
  caption_draft: string;
  shot_list: string;
};

const captionsSchema = {
  type: "object",
  properties: {
    captions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          post_id: { type: "number" },
          caption_draft: { type: "string" },
          shot_list: { type: "string" },
        },
        required: ["post_id", "caption_draft", "shot_list"],
        additionalProperties: false,
      },
    },
  },
  required: ["captions"],
  additionalProperties: false,
} as const;

function describeDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth() + 1]} ${d.getUTCDate()}`;
}

export function buildCaptionPrompt(params: {
  clientName: string;
  website: string | null;
  specialty: string | null;
  tone: string | null;
  notes: string | null;
  standingCampaigns: StandingCampaign[];
  posts: CaptionRequestPost[];
}): string {
  const { clientName, website, specialty, tone, notes, standingCampaigns, posts } = params;

  const standingBlock = standingCampaigns.length > 0
    ? standingCampaigns.map((c) => `- ${c.name}: ${c.description}`).join("\n")
    : "None.";

  const postsBlock = posts
    .map(
      (p) =>
        `- post_id ${p.id} | ${describeDate(p.post_date)} | "${p.campaign_label}"\n  Concept: ${p.description}`,
    )
    .join("\n");

  return `You are a social media copywriter for a veterinary marketing agency. A strategist has already placed these posts on ${clientName}'s calendar and chosen every date and topic. Your only job is to write the copy for each one. Do not suggest different topics, dates, or extra posts.

PRACTICE: ${clientName}
${website ? `Website: ${website}` : ""}
Specialty: ${specialty ?? "General small animal practice"}
Tone & voice: ${tone ?? "Warm, friendly, and professional"}
Notes from the strategist: ${notes ?? "None"}

STANDING CAMPAIGNS (recurring series already running):
${standingBlock}

POSTS TO WRITE (${posts.length}):
${postsBlock}

For EVERY post_id above, return:
- caption_draft: 600-900 characters. ONE paragraph, no line breaks. Warm and conversational in the practice's voice, emoji used naturally throughout. Written to be posted as-is. Reference the practice by name where it reads naturally. Never mention AI, this tool, or the fact that it was scheduled.
- shot_list: 250-400 characters. Exactly what photo or video to ask the client to capture, written so a front-desk team member can follow it with a phone — framing, who or what is in it, lighting, and rough length if it's a video. No professional equipment, no stock imagery.

Both fields are plain text strings, not arrays or lists.

Return one entry per post_id, using the exact post_id numbers given above. Do not add entries for posts that are not listed.`;
}

export async function writeCaptions(params: {
  apiKey: string;
  clientName: string;
  website: string | null;
  specialty: string | null;
  tone: string | null;
  notes: string | null;
  standingCampaigns: StandingCampaign[];
  posts: CaptionRequestPost[];
}): Promise<WrittenCaption[]> {
  const { apiKey, ...promptParams } = params;
  if (promptParams.posts.length === 0) return [];

  const client = new Anthropic({ apiKey });
  // One request for the whole batch rather than a call per post.
  const message = await client.messages.parse({
    model: CAPTION_MODEL,
    max_tokens: 16_384,
    messages: [{ role: "user", content: buildCaptionPrompt(promptParams) }],
    output_config: { format: jsonSchemaOutputFormat(captionsSchema) },
  });

  const parsed = message.parsed_output as { captions?: WrittenCaption[] } | null;
  return parsed?.captions ?? [];
}
