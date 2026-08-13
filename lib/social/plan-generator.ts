/**
 * @deprecated Unused. Whole-month generation is gone — a strategist places
 * posts manually on the calendar (drag-and-drop in calendar-builder.tsx), and
 * `POST /api/social/plans/generate` now only writes copy for posts that already
 * exist, via `lib/social/caption-writer.ts`.
 *
 * Nothing imports this file. It is kept only as a reference for the old
 * date-cadence logic (buildPostDates) in case that's wanted for a scheduling
 * assistant later; delete it once that's settled.
 */
import Anthropic from "@anthropic-ai/sdk";
import { getAwarenessDaysForMonth } from "./awareness-days";
import type { SocialIdea, StandingCampaign, GeneratedPost } from "./types";

const SOCIAL_PLAN_MODEL = "claude-opus-4-8";

const MONTH_NAMES = [
  "", "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function buildPostDates(year: number, month: number, postsPerWeek: number): string[] {
  const dates: string[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  // Mon/Wed/Fri cadence for 3/week; Mon/Thu for 2/week; Mon/Wed/Fri + Tue for 4/week
  const weeklyDays =
    postsPerWeek === 2 ? [1, 4] :
    postsPerWeek === 3 ? [1, 3, 5] :
    postsPerWeek >= 4 ? [1, 2, 4, 5] : [1, 3, 5];

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    if (weeklyDays.includes(d.getDay())) {
      dates.push(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    }
  }
  return dates;
}

export type SelectedIdea = {
  title: string;
  description: string;
  shot_idea?: string;
};

export async function generateSocialPlan(params: {
  apiKey: string;
  clientName: string;
  month: number;
  year: number;
  specialty: string | null;
  tone: string | null;
  notes: string | null;
  standingCampaigns: StandingCampaign[];
  postsPerWeek: number;
  ideas: SocialIdea[];
  recentCampaignTypes: string[];
  selectedIdeas?: SelectedIdea[];
}): Promise<GeneratedPost[]> {
  const {
    apiKey, clientName, month, year, specialty, tone, notes,
    standingCampaigns, postsPerWeek, ideas, recentCampaignTypes,
    selectedIdeas,
  } = params;

  const monthName = MONTH_NAMES[month];
  const awarenessDays = getAwarenessDaysForMonth(month);
  const postDates = buildPostDates(year, month, postsPerWeek);
  const targetCount = postDates.length;

  const awarenessBlock = awarenessDays.length > 0
    ? awarenessDays.map((d) => `- ${d.name}${d.day ? ` (${monthName} ${d.day})` : " (whole month)"}: ${d.contentAngle}`).join("\n")
    : "No major veterinary awareness days this month — focus on evergreen content.";

  const ideasBlock = ideas.length > 0
    ? ideas.map((i) => `- ${i.title}: ${i.description}`).join("\n")
    : "No ideas in repository yet — use your best judgment.";

  const selectedBlock = selectedIdeas && selectedIdeas.length > 0
    ? `THE STRATEGIST HAND-PICKED THESE CONCEPTS — every one of them MUST appear in the plan:
${selectedIdeas.map((i) => `- ${i.title}: ${i.description}${i.shot_idea ? ` [Shot idea: ${i.shot_idea}]` : ""}`).join("\n")}

Rules for the picked concepts:
- Each picked concept gets at least one post; a recurring-series concept may appear twice if the calendar has room.
- Where a shot idea is given, build the post's shot_list from it (expand with practical phone-shooting detail).
- Fill any REMAINING dates with standing campaigns, fitting awareness days, and safe evergreen content — but the picked concepts come first and set the month's personality.
`
    : "";

  const avoidBlock = recentCampaignTypes.length > 0
    ? `Avoid repeating these campaign types (used in the past 3 months): ${recentCampaignTypes.join(", ")}.`
    : "No recent history — full variety encouraged.";

  const standingBlock = standingCampaigns.length > 0
    ? standingCampaigns.map((c) => `- ${c.name}: ${c.description}`).join("\n")
    : "None.";

  const availableDatesBlock = postDates.map((d) => `  "${d}"`).join(",\n");

  const prompt = `You are an expert social media content strategist specializing in veterinary practices. Generate a monthly content plan for ${monthName} ${year}.

PRACTICE: ${clientName}
Specialty: ${specialty ?? "General small animal practice"}
Tone & Voice: ${tone ?? "Warm, friendly, and professional"}
Notes: ${notes ?? "None"}

STANDING CAMPAIGNS (recurring series already running):
${standingBlock}

${monthName.toUpperCase()} AWARENESS DAYS (use 2–3 naturally, not every post):
${awarenessBlock}

${selectedBlock}
IDEA BANK (draw from these but don't use all of them):
${ideasBlock}

${avoidBlock}

POST DATES AVAILABLE (${targetCount} posts, ${postsPerWeek}/week rhythm):
${availableDatesBlock}

REQUIREMENTS:
- Generate exactly ${targetCount} posts, one per date above, in the same order
- Use a variety of campaign types — don't repeat the same type more than twice unless it's a standing series
- Write real, usable caption drafts: warm, engaging, 100–200 words each, written from the practice's voice
- Write specific shot list instructions the client can follow with just their phone
- Include 5–8 relevant hashtags per post (mix of broad and niche)
- Weave in 2–3 awareness days where they fit naturally — don't force them

Respond with a JSON array only, no other text. Each item must match exactly:
{
  "post_date": "YYYY-MM-DD",
  "platform": "both",
  "campaign_type": "<one of: pet_of_month, team_spotlight, educational, resident_pet, client_testimonial, behind_scenes, awareness_day, seasonal, promotion, before_after, fun_fact, series>",
  "campaign_label": "<short human label, e.g. 'Pet of the Month'>",
  "caption_draft": "<full caption text>",
  "shot_list": "<specific photo/video instructions for the practice>",
  "hashtags": "<space-separated hashtag string>"
}`;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: SOCIAL_PLAN_MODEL,
    max_tokens: 8000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("");

  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("AI did not return a valid JSON array.");

  const parsed = JSON.parse(jsonMatch[0]) as GeneratedPost[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("AI returned an empty plan.");
  }
  return parsed;
}
