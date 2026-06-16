import { generateGeminiContent, generateGeminiText } from "@/lib/ai/gemini";
import type {
  SalesLighthouseFinding,
  SalesLogoAnalysis,
  SalesLighthouseMetrics,
  SalesLighthouseScores,
  SalesSeoFindings,
  StrategistSummaryResult,
} from "@/lib/types/client";
import { topIssuesList } from "@/lib/sales/prompt";

export { buildHostingerHorizonsPrompt } from "@/lib/sales/prompt";

type StrategicSummaryEnvelope = {
  summary: StrategistSummaryResult;
  followupEmailDraft: string;
};

function jsonBlockToObject<T>(text: string): T | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? trimmed;
  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

export async function analyzeLogoBrandProfile(input: {
  logoBytes: Buffer;
  mimeType: string;
  prospectName: string;
}): Promise<SalesLogoAnalysis> {
  const prompt = [
    "Analyze this company logo and return strict JSON only.",
    `Business name context: ${input.prospectName}`,
    "Return shape:",
    '{ "primaryHex": "#112233", "secondaryHex": "#445566", "accentHex": "#778899", "brandPersonality": "...", "designCues": ["...", "..."] }',
    "Rules:",
    "- Hex values must be valid #RRGGBB.",
    "- brandPersonality should be a concise one-sentence descriptor.",
    "- designCues should be 3-5 short bullet-like phrases.",
  ].join("\n");
  const text = await generateGeminiContent([
    { text: prompt },
    {
      inlineData: {
        mimeType: input.mimeType,
        data: input.logoBytes.toString("base64"),
      },
    },
  ]);
  const parsed = jsonBlockToObject<Partial<SalesLogoAnalysis>>(text);
  const hex = /^#[0-9A-Fa-f]{6}$/;
  if (
    !parsed ||
    typeof parsed.primaryHex !== "string" ||
    typeof parsed.secondaryHex !== "string" ||
    typeof parsed.accentHex !== "string" ||
    typeof parsed.brandPersonality !== "string" ||
    !Array.isArray(parsed.designCues) ||
    !hex.test(parsed.primaryHex) ||
    !hex.test(parsed.secondaryHex) ||
    !hex.test(parsed.accentHex)
  ) {
    throw new Error("Gemini logo analysis response was not valid JSON.");
  }
  return {
    primaryHex: parsed.primaryHex,
    secondaryHex: parsed.secondaryHex,
    accentHex: parsed.accentHex,
    brandPersonality: parsed.brandPersonality.trim(),
    designCues: parsed.designCues
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .slice(0, 5),
  };
}

export async function buildStrategicSummary(input: {
  prospectName: string;
  prospectUrl: string;
  seo: SalesSeoFindings;
  lighthouseScores: SalesLighthouseScores;
  lighthouseMetrics: SalesLighthouseMetrics;
  lighthouseFindings: SalesLighthouseFinding[];
}): Promise<StrategicSummaryEnvelope> {
  const issues = topIssuesList(input.seo, input.lighthouseFindings);
  const prompt = [
    "You are a veteran veterinary marketing strategist at Beyond Indigo Pets.",
    "Write practical, concise sales-facing outputs based on this prospect audit.",
    "",
    `Prospect name: ${input.prospectName}`,
    `Prospect site: ${input.prospectUrl}`,
    "",
    "SEO baseline:",
    `- Title length: ${input.seo.title_length}`,
    `- Meta description length: ${input.seo.meta_description_length}`,
    `- H1 count: ${input.seo.h1_count}`,
    `- Has JSON-LD schema: ${input.seo.has_json_ld_schema ? "Yes" : "No"}`,
    "",
    "Lighthouse baseline (mobile):",
    `- Performance: ${input.lighthouseScores.performance ?? "N/A"}`,
    `- SEO: ${input.lighthouseScores.seo ?? "N/A"}`,
    `- Accessibility: ${input.lighthouseScores.accessibility ?? "N/A"}`,
    `- Best practices: ${input.lighthouseScores.bestPractices ?? "N/A"}`,
    `- LCP: ${input.lighthouseMetrics.lcp ?? "N/A"}`,
    `- CLS: ${input.lighthouseMetrics.cls ?? "N/A"}`,
    `- TBT: ${input.lighthouseMetrics.tbt ?? "N/A"}`,
    "",
    "Top issues:",
    ...issues.map((line) => `- ${line}`),
    "",
    "Return STRICT JSON only with this shape:",
    '{ "summary": { "theWin": "...", "theConcern": "...", "theNextMove": "..." }, "followupEmailDraft": "..." }',
    "Constraints:",
    "- theWin/theConcern/theNextMove must each be one concise sentence.",
    "- followupEmailDraft should be 5-8 sentences, persuasive but professional.",
  ].join("\n");

  const text = await generateGeminiText(prompt);
  const parsed = jsonBlockToObject<{
    summary?: Partial<StrategistSummaryResult>;
    followupEmailDraft?: string;
  }>(text);
  if (
    !parsed?.summary ||
    typeof parsed.summary.theWin !== "string" ||
    typeof parsed.summary.theConcern !== "string" ||
    typeof parsed.summary.theNextMove !== "string"
  ) {
    throw new Error("Gemini strategic summary response was not valid JSON.");
  }
  return {
    summary: {
      theWin: parsed.summary.theWin.trim(),
      theConcern: parsed.summary.theConcern.trim(),
      theNextMove: parsed.summary.theNextMove.trim(),
    },
    followupEmailDraft:
      typeof parsed.followupEmailDraft === "string"
        ? parsed.followupEmailDraft.trim()
        : "",
  };
}
