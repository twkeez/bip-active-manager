import { generateClaudeContent } from "@/lib/ai/claude";
import type {
  DraftedPlatformPosts,
  SocialPlatform,
  WinDraftInput,
} from "@/lib/wins/types";

const PLATFORM_GUIDANCE: Record<SocialPlatform, string> = {
  linkedin:
    "LinkedIn: professional, B2B agency-credibility tone. 2-4 short paragraphs, a strong opening hook with the metric, end with a soft takeaway. 3-5 relevant hashtags.",
  facebook:
    "Facebook: warm, community-minded, approachable. 1-2 short paragraphs. Light, human tone. 2-4 hashtags.",
  instagram:
    "Instagram: punchy, visual-first caption. A bold one-line hook, a few short lines, an emoji or two is fine. 5-10 hashtags.",
};

const SYSTEM_PROMPT = `You write social media posts for Beyond Indigo, a marketing agency specializing in
veterinary practices. The posts promote Beyond Indigo's own results to attract new veterinary clients.

Rules:
- Ground every claim ONLY in the metrics provided. Never invent numbers.
- Anonymize the client unless a win is explicitly marked use_name=true. When anonymized, refer to
  "a veterinary practice", "one of our veterinary clients", "a multi-location veterinary group", etc.
  Never imply or hint at a specific client when anonymized.
- Lead with the most impressive metric. Keep it credible and specific, not hypey.
- Frame results as what Beyond Indigo achieved for the client.
- Each post should weave together the provided wins naturally (don't just list them).
- Return ONLY a valid JSON object. No preamble, no markdown fences, no trailing commas.`;

const RESPONSE_SCHEMA = `{
  "posts": [
    { "platform": "linkedin|facebook|instagram", "variants": [ { "text": "string (the full post copy)", "hashtags": ["#string"] } ] }
  ]
}`;

function parsePosts(raw: string): DraftedPlatformPosts[] {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  }
  if (!text.startsWith("{")) {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first >= 0 && last > first) text = text.slice(first, last + 1);
  }
  let parsed: { posts?: DraftedPlatformPosts[] };
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = JSON.parse(
      text
        .replace(/\/\/[^\n\r]*/g, "")
        .replace(/,(\s*[}\]])/g, "$1"),
    );
  }
  return parsed.posts ?? [];
}

export async function draftSocialPosts(input: {
  wins: WinDraftInput[];
  platforms: SocialPlatform[];
  variantsPerPlatform?: number;
}): Promise<DraftedPlatformPosts[]> {
  const variants = input.variantsPerPlatform ?? 2;
  const winLines = input.wins
    .map((w, i) => {
      const subject = w.use_name ? w.win.client_name : "(anonymized — do not name the client)";
      return `${i + 1}. [${w.win.channel_label}] ${w.win.metric_label}: ${w.win.metric_value} — ${w.win.context} | subject: ${subject}`;
    })
    .join("\n");

  const guidance = input.platforms.map((p) => `- ${PLATFORM_GUIDANCE[p]}`).join("\n");

  const prompt = `${SYSTEM_PROMPT}

Draft ${variants} post variant(s) for EACH of these platforms: ${input.platforms.join(", ")}.

Platform guidance:
${guidance}

Return a JSON object matching this schema (one entry per requested platform):
${RESPONSE_SCHEMA}

Wins to promote:
${winLines}

Return only the JSON object.`;

  const raw = await generateClaudeContent([{ text: prompt }], {
    maxOutputTokens: 4096,
    temperature: 0.7,
  });
  const posts = parsePosts(raw);
  // Keep only the platforms that were requested, in the requested order.
  const order = new Map(input.platforms.map((p, i) => [p, i]));
  return posts
    .filter((p) => order.has(p.platform))
    .sort((a, b) => (order.get(a.platform) ?? 0) - (order.get(b.platform) ?? 0));
}
