import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { CONTENT_PILLARS } from "./taxonomy";
import type { StandingCampaign } from "./types";

// Drafts the four export-sheet fields for posts that are ALREADY on the
// calendar. Placement stays manual — nothing here decides dates, topics, or how
// many posts a month should have.
//
// Same model as the rest of the social pipeline (idea-brainstorm.ts).
const POST_MODEL = "claude-opus-4-8";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** One post needing copy, with whatever context we can resolve for it. */
export type DraftRequestPost = {
  id: number;
  post_date: string;
  campaign_label: string;
  /** From the linked idea, awareness day, or the label itself when neither. */
  description: string;
  /** Strategist's pillar choice. The model must honour it when set. */
  content_pillar: string | null;
};

export type DraftedPost = {
  post_id: number;
  content_pillar: string;
  headline: string;
  subheadline: string;
  photo_suggestion: string;
};

const draftsSchema = {
  type: "object",
  properties: {
    posts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          post_id: { type: "number" },
          content_pillar: { type: "string", enum: [...CONTENT_PILLARS] },
          headline: { type: "string" },
          subheadline: { type: "string" },
          photo_suggestion: { type: "string" },
        },
        required: ["post_id", "content_pillar", "headline", "subheadline", "photo_suggestion"],
        additionalProperties: false,
      },
    },
  },
  required: ["posts"],
  additionalProperties: false,
} as const;

function describeDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth() + 1]} ${d.getUTCDate()}`;
}

export function buildDraftPrompt(params: {
  clientName: string;
  website: string | null;
  specialty: string | null;
  tone: string | null;
  notes: string | null;
  standingCampaigns: StandingCampaign[];
  posts: DraftRequestPost[];
}): string {
  const { clientName, website, specialty, tone, notes, standingCampaigns, posts } = params;

  const standingBlock = standingCampaigns.length > 0
    ? standingCampaigns.map((c) => `- ${c.name}: ${c.description}`).join("\n")
    : "None.";

  const postsBlock = posts
    .map((p) => {
      const pillar = p.content_pillar
        ? `\n  Content pillar (already chosen — use exactly this): ${p.content_pillar}`
        : "\n  Content pillar: not set — choose the best fit from the list above.";
      return `- post_id ${p.id} | ${describeDate(p.post_date)} | "${p.campaign_label}"\n  Concept: ${p.description}${pillar}`;
    })
    .join("\n");

  return `You are writing a monthly social content sheet for a veterinary marketing agency. A strategist has already placed these posts on ${clientName}'s calendar and chosen every date and topic. Your only job is to write the sheet rows. Do not suggest different topics, dates, or extra posts.

PRACTICE: ${clientName}
${website ? `Website: ${website}` : ""}
Specialty: ${specialty ?? "General small animal practice"}
Tone & voice: ${tone ?? "Warm, friendly, and professional"}
Notes from the strategist: ${notes ?? "None"}

STANDING CAMPAIGNS (recurring series already running):
${standingBlock}

CONTENT PILLARS (use one, exactly as spelled):
${CONTENT_PILLARS.map((p) => `- ${p}`).join("\n")}

POSTS TO WRITE (${posts.length}):
${postsBlock}

For EVERY post_id above, return these four fields. This sheet is handed to a social media team who write the final captions from it, so be concrete and specific — never generic filler.

- content_pillar: exactly one value from the list above. If the post already has one, repeat it unchanged.
- headline: 40-80 characters. The hook. Title case or a direct question. No emoji, no hashtags, no practice name unless it genuinely belongs. Examples of the right register: "Foxtail Season Isn't Over Yet" · "Has Your Pet Had a Nose-to-Tail Exam This Year?" · "Why Is My Dog Constantly Licking Their Paws?"
- subheadline: 60-130 characters. ONE plain sentence supporting the headline, ending in a period. No emoji. Examples: "Learn where foxtails hide and how to protect your pet from these dangerous plants." · "Annual wellness exams help catch health concerns before they become serious."
- photo_suggestion: 60-140 characters. ONE sentence naming the image to capture, shootable on a phone by a front-desk team member. Describe subject and setting only — no lighting notes, no equipment, no stock imagery. Examples: "Dog walking through dry grass or close-up of foxtails in a California field." · "Veterinarian performing a wellness exam on a calm dog or cat."

All four fields are plain text strings, not arrays or lists.

Return one entry per post_id, using the exact post_id numbers given above. Do not add entries for posts that are not listed.`;
}

export async function draftPosts(params: {
  apiKey: string;
  clientName: string;
  website: string | null;
  specialty: string | null;
  tone: string | null;
  notes: string | null;
  standingCampaigns: StandingCampaign[];
  posts: DraftRequestPost[];
}): Promise<DraftedPost[]> {
  const { apiKey, ...promptParams } = params;
  if (promptParams.posts.length === 0) return [];

  const client = new Anthropic({ apiKey });
  // One request for the whole batch rather than a call per post.
  const message = await client.messages.parse({
    model: POST_MODEL,
    max_tokens: 16_384,
    messages: [{ role: "user", content: buildDraftPrompt(promptParams) }],
    output_config: { format: jsonSchemaOutputFormat(draftsSchema) },
  });

  const parsed = message.parsed_output as { posts?: DraftedPost[] } | null;
  return parsed?.posts ?? [];
}
