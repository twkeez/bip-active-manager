import { generateGeminiContent } from "@/lib/ai/gemini";
import { jsonBlockToObject } from "@/lib/site-audit/parse-json";
import type { AuditReportJson, SummaryStageResult } from "@/lib/site-audit/types";

function parseSummaryJson(text: string): SummaryStageResult | null {
  const parsed = jsonBlockToObject<
    Partial<SummaryStageResult> & { markdown?: string }
  >(text);
  if (!parsed || typeof parsed.markdown !== "string") return null;
  return {
    markdown: parsed.markdown.trim(),
    wins: Array.isArray(parsed.wins)
      ? parsed.wins.filter((item): item is string => typeof item === "string")
      : [],
    concerns: Array.isArray(parsed.concerns)
      ? parsed.concerns.filter((item): item is string => typeof item === "string")
      : [],
    prioritizedFixes: Array.isArray(parsed.prioritizedFixes)
      ? parsed.prioritizedFixes.filter((item): item is string => typeof item === "string")
      : [],
  };
}

export async function runSummaryStage(report: AuditReportJson): Promise<SummaryStageResult> {
  const prompt = [
    "You are a senior veterinary website auditor at Beyond Indigo Pets.",
    "Write an executive audit summary from the structured findings below.",
    "Return STRICT JSON:",
    JSON.stringify(
      {
        markdown: "## Overview\\n...",
        wins: ["..."],
        concerns: ["..."],
        prioritizedFixes: ["..."],
      },
      null,
      2,
    ),
    "markdown should use headings: Overview, Wins, Concerns, Top Fixes (numbered).",
    "",
    JSON.stringify(report, null, 2).slice(0, 12000),
  ].join("\n");

  const text = await generateGeminiContent([{ text: prompt }], {
    maxOutputTokens: 2048,
    temperature: 0.35,
  });
  const parsed = parseSummaryJson(text);
  if (parsed) return parsed;

  return {
    markdown: text.trim(),
    wins: [],
    concerns: [],
    prioritizedFixes: [],
  };
}
