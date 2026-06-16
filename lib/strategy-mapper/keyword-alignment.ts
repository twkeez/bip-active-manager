import { generateGeminiContent } from "@/lib/ai/gemini";
import { jsonBlockToObject } from "@/lib/site-audit/parse-json";
import type { KeywordMatrixRow, WebsiteSeoKeywordCoverage } from "@/types/strategy-mapper";

export function collectTargetKeywords(matrix: KeywordMatrixRow[]): string[] {
  const keywords = new Set<string>();
  for (const row of matrix) {
    for (const kw of row.keywordVariations) {
      const trimmed = kw.trim();
      if (trimmed) keywords.add(trimmed);
    }
  }
  return [...keywords];
}

function normalizeForMatch(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ");
}

export function keywordPresentInText(keyword: string, text: string): boolean {
  const normKw = normalizeForMatch(keyword);
  const normText = normalizeForMatch(text);
  if (normText.includes(normKw)) return true;
  const tokens = normKw.split(/\s+/).filter((token) => token.length > 3);
  if (tokens.length === 0) return normKw.length > 0 && normText.includes(normKw);
  const matched = tokens.filter((token) => normText.includes(token));
  return matched.length >= Math.ceil(tokens.length * 0.6);
}

export function buildDeterministicKeywordCoverage(
  matrix: KeywordMatrixRow[],
  surfaces: { label: string; text: string }[],
): { coverage: WebsiteSeoKeywordCoverage[]; gaps: string[] } {
  const keywords = collectTargetKeywords(matrix);
  const coverage: WebsiteSeoKeywordCoverage[] = [];
  const gaps: string[] = [];

  for (const keyword of keywords) {
    const foundIn: string[] = [];
    for (const surface of surfaces) {
      if (keywordPresentInText(keyword, surface.text)) {
        foundIn.push(surface.label);
      }
    }
    coverage.push({ keyword, foundIn });
    if (foundIn.length === 0) {
      gaps.push(keyword);
    }
  }

  return { coverage, gaps };
}

export async function runAiKeywordGapAnalysis(input: {
  matrix: KeywordMatrixRow[];
  pageSummaries: Array<{ url: string; title: string | null; h1?: string | null }>;
  coverage: WebsiteSeoKeywordCoverage[];
  gaps: string[];
}): Promise<{
  gaps: string[];
  strengths: string[];
  recommendations: string[];
  aiSummary?: string;
} | null> {
  if (!input.matrix.length) return null;

  const matrixSummary = input.matrix
    .map(
      (row) =>
        `- ${row.intentCategory} (${row.targetGeography}): ${row.keywordVariations.join(", ")}`,
    )
    .join("\n");

  const pageSummary = input.pageSummaries
    .slice(0, 10)
    .map(
      (page) =>
        `- ${page.url}\n  title: ${page.title ?? "N/A"}\n  h1: ${page.h1 ?? "N/A"}`,
    )
    .join("\n");

  const coverageSummary = input.coverage
    .map((row) => `- ${row.keyword}: ${row.foundIn.length ? row.foundIn.join(", ") : "not found"}`)
    .join("\n");

  const prompt = [
    "You are a veterinary SEO strategist comparing a practice website to a target keyword matrix.",
    "Return STRICT JSON only:",
    JSON.stringify(
      {
        gaps: ["keyword not reflected in homepage title"],
        strengths: ["emergency intent present in H1"],
        recommendations: ["Add geo-modified service keywords to homepage title"],
        summary: "One paragraph on keyword coverage vs matrix (not literal density).",
      },
      null,
      2,
    ),
    "Rules:",
    "- gaps: 3-6 items, plain language",
    "- strengths: 1-3 items",
    "- recommendations: 3-5 actionable items",
    "- summary: max 80 words; say coverage not density",
    "- No markdown fences, raw JSON only",
    "",
    "Target keyword matrix:",
    matrixSummary,
    "",
    "Deterministic coverage check:",
    coverageSummary,
    "",
    "Crawled pages:",
    pageSummary,
  ].join("\n");

  try {
    const text = await generateGeminiContent([{ text: prompt }], {
      maxOutputTokens: 2048,
      temperature: 0.35,
    });
    const parsed = jsonBlockToObject<{
      gaps?: string[];
      strengths?: string[];
      recommendations?: string[];
      summary?: string;
    }>(text);
    if (!parsed) return null;

    const gaps = (parsed.gaps ?? input.gaps).map((item) => item.trim()).filter(Boolean);
    const strengths = (parsed.strengths ?? []).map((item) => item.trim()).filter(Boolean);
    const recommendations = (parsed.recommendations ?? [])
      .map((item) => item.trim())
      .filter(Boolean);

    const aiSummary = [
      parsed.summary?.trim(),
      strengths.length ? `Strengths: ${strengths.join("; ")}` : "",
      recommendations.length ? `Recommendations: ${recommendations.join("; ")}` : "",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      gaps: gaps.length ? gaps : input.gaps,
      strengths,
      recommendations,
      aiSummary: aiSummary || undefined,
    };
  } catch {
    return null;
  }
}
