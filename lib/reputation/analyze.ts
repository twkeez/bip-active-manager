import { generateClaudeReport } from "@/lib/ai/claude";

export type ReviewForAnalysis = {
  rating: number | null;
  reviewText: string | null;
  reviewedAt: string | null;
};

export type AnalysisInput = {
  practiceName: string;
  rating: number | null;
  votesCount: number | null;
  ratingDistribution: Record<string, number>;
  placeTopics: Record<string, number>;
  reviews: ReviewForAnalysis[];
};

// Rating-only reviews carry no signal for a qualitative read, and roughly a
// fifth of a typical corpus has no text at all.
export function usableReviews(reviews: ReviewForAnalysis[]): ReviewForAnalysis[] {
  return reviews.filter((r) => (r.reviewText ?? "").trim().length > 0);
}

function formatTopics(topics: Record<string, number>): string {
  const entries = Object.entries(topics).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "(none returned)";
  return entries.map(([topic, count]) => `${topic} (${count})`).join(", ");
}

function formatDistribution(dist: Record<string, number>): string {
  return [5, 4, 3, 2, 1]
    .map((star) => `${star}star: ${dist[String(star)] ?? 0}`)
    .join(" · ");
}

export function buildAnalysisPrompt(input: AnalysisInput): string {
  const reviews = usableReviews(input.reviews);
  const corpus = reviews
    .map((r, i) => {
      const date = r.reviewedAt ? r.reviewedAt.slice(0, 10) : "undated";
      return `[${i + 1}] ${r.rating ?? "?"} stars · ${date}\n${r.reviewText?.replace(/\s+/g, " ").trim()}`;
    })
    .join("\n\n");

  return `You are analysing the Google reviews of a veterinary practice for its marketing agency. The agency will use this to shape the practice's positioning, messaging, and content.

PRACTICE: ${input.practiceName}
RATING: ${input.rating ?? "unknown"} from ${input.votesCount ?? "unknown"} reviews
DISTRIBUTION: ${formatDistribution(input.ratingDistribution)}
GOOGLE'S AUTO-EXTRACTED TOPICS: ${formatTopics(input.placeTopics)}

Below are ${reviews.length} reviews that contain text. Read all of them before writing.

${corpus}

Write a report in Markdown with exactly these three sections and nothing else. Do not restate the rating, review count, distribution, or topic list — the reader already has those above your report.

## What they're doing well

A numbered list of the themes that genuinely recur. Order them by how strongly the reviews support them, strongest first. Include as many as the evidence supports and no more — if only four themes are real, write four.

Each theme gets a short bold headline, then a few sentences of evidence drawn from the actual reviews: the specific incidents, the named staff members, the particular phrases reviewers used, and the comparisons they drew to other practices. Specificity is the entire value here. "Staff are friendly" is worthless; "three separate reviewers name Stephanie at the front desk, one crediting her with pulling records from a previous vet inside an hour" is what the agency needs. Where a reviewer's own wording is vivid, quote the phrase.

If a theme appears only once or twice, say so plainly rather than implying it is a pattern.

## Positioning

One short sentence, in quotation marks, capturing what makes this practice distinctive — the thing the reviews support that a competitor could not credibly claim. Warmth alone is never the answer; every practice claims warmth. Look for what it is paired with.

Then two or three sentences explaining why the reviews support that line, including what the practice is repeatedly contrasted against.

## Personality traits

A Markdown table with two columns: "Trait" and "What it sounds like in reviews". Order by strength of evidence. Keep the right-hand column concrete — the actual behaviours reviewers describe, not adjectives.

Rules for the whole report:
- Ground every claim in the reviews above. Do not infer what a practice is probably like from what veterinary practices are generally like.
- This report covers strengths only. Do not include criticisms, weaknesses, or improvement suggestions.
- Do not invent staff names, incidents, or quotes. If you are unsure whether something is a real pattern, leave it out.
- Write in plain, direct prose for a busy strategist. No preamble, no closing summary, no filler.`;
}

export async function generateReputationReport(
  input: AnalysisInput,
): Promise<{ markdown: string; model: string; reviewCount: number }> {
  const reviews = usableReviews(input.reviews);
  if (reviews.length < 5) {
    throw new Error(
      `Only ${reviews.length} review${reviews.length === 1 ? "" : "s"} with text — too few to analyse. Fetch reviews first.`,
    );
  }

  const { text, model } = await generateClaudeReport(buildAnalysisPrompt(input), {
    maxOutputTokens: 16000,
  });
  return { markdown: text, model, reviewCount: reviews.length };
}
