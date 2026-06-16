import { generateGeminiContent } from "@/lib/ai/gemini";
import { runSearchConsoleSync } from "@/lib/seo/search-console";
import { jsonBlockToObject } from "@/lib/site-audit/parse-json";
import type { CrawlStageResult, KeywordsStageResult } from "@/lib/site-audit/types";
import { hostFromUrl } from "@/lib/site-audit/shared";

function isoDateDaysAgo(days: number) {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

async function tryGscKeywords(url: string): Promise<KeywordsStageResult | null> {
  try {
    const endDate = isoDateDaysAgo(1);
    const startDate = isoDateDaysAgo(28);
    const sync = await runSearchConsoleSync(url, url, startDate, endDate);
    if (!sync.queryRows.length && !sync.pageRows.length) return null;
    return {
      source: "gsc",
      label: "Search Console (measured, last 28 days)",
      gscPropertyUrl: sync.propertyUrl,
      dateRange: { start: startDate, end: endDate },
      topQueries: sync.queryRows.slice(0, 20).map((row) => ({
        query: row.key,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })),
      topPages: sync.pageRows.slice(0, 15).map((row) => ({
        page: row.key,
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      })),
    };
  } catch {
    return null;
  }
}

function buildAiContext(crawl: CrawlStageResult) {
  return crawl.pages
    .slice(0, 15)
    .map(
      (page) =>
        `- ${page.url}\n  title: ${page.title ?? "N/A"}\n  words: ${page.wordCount}\n  schema: ${page.schemaTypes.join(", ") || "none"}`,
    )
    .join("\n");
}

async function runAiKeywords(crawl: CrawlStageResult): Promise<KeywordsStageResult> {
  const host = hostFromUrl(crawl.baseUrl) ?? "site";
  const prompt = [
    "You are a veterinary SEO strategist.",
    `Analyze likely target keywords for ${host} based on crawled page content below.`,
    "Return STRICT JSON only:",
    JSON.stringify(
      {
        aiKeywords: [
          { keyword: "example vet near me", alignment: "strong", evidence: "homepage title" },
        ],
        gaps: ["missing careers/hiring page keywords"],
      },
      null,
      2,
    ),
    "Rules:",
    "- 8 aiKeywords max with alignment strong|moderate|weak",
    "- evidence max 12 words",
    "- 3-4 gaps",
    "- This is content analysis NOT live rankings",
    "- No markdown fences, raw JSON only",
    "",
    "Pages:",
    buildAiContext(crawl),
  ].join("\n");

  let text: string;
  try {
    text = await generateGeminiContent([{ text: prompt }], {
      maxOutputTokens: 2048,
      temperature: 0.35,
    });
  } catch {
    return {
      source: "ai",
      label: "Content analysis unavailable (AI service busy — re-run later)",
      aiKeywords: [],
      gaps: [
        "AI keyword analysis could not run because the model API was temporarily unavailable.",
        "Re-run the keywords stage in a few minutes.",
      ],
    };
  }
  const parsed = jsonBlockToObject<{
    aiKeywords?: Array<{ keyword?: string; alignment?: string; evidence?: string }>;
    gaps?: string[];
  }>(text);
  if (!parsed) {
    throw new Error("Gemini did not return valid keywords JSON.");
  }

  const aiKeywords = (parsed.aiKeywords ?? [])
    .map((row) => {
      if (!row.keyword?.trim()) return null;
      const alignment =
        row.alignment === "strong" || row.alignment === "moderate" || row.alignment === "weak"
          ? row.alignment
          : "moderate";
      return {
        keyword: row.keyword.trim(),
        alignment: alignment as "strong" | "moderate" | "weak",
        evidence: (row.evidence ?? "").trim() || "Inferred from page content",
      };
    })
    .filter((row): row is NonNullable<typeof row> => row != null)
    .slice(0, 15);

  return {
    source: "ai",
    label: "Content analysis (not live rankings)",
    aiKeywords,
    gaps: (parsed.gaps ?? []).filter((item): item is string => typeof item === "string").slice(0, 8),
  };
}

export async function runKeywordsStage(
  url: string,
  crawl: CrawlStageResult,
): Promise<KeywordsStageResult> {
  const gsc = await tryGscKeywords(url);
  if (gsc) return gsc;
  return runAiKeywords(crawl);
}
