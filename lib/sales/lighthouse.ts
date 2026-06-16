import { getGooglePageSpeedApiKey } from "@/lib/env";
import type {
  SalesLighthouseFinding,
  SalesLighthouseMetrics,
  SalesLighthouseScores,
} from "@/lib/types/client";

type PsiCategoryScore = {
  score?: number | null;
};

type PsiAudit = {
  id?: string;
  title?: string;
  description?: string;
  displayValue?: string;
  score?: number | null;
  details?: {
    type?: string;
  };
};

function normalizeTargetUrl(raw: string) {
  const value = raw.trim();
  if (!value) return "";
  if (value.includes("://")) return value;
  return `https://${value}`;
}

function scoreTo100(value: number | null | undefined) {
  return typeof value === "number" ? Math.round(value * 100) : null;
}

function toFinding(id: string, audit: PsiAudit | undefined): SalesLighthouseFinding | null {
  if (!audit) return null;
  const score = typeof audit.score === "number" ? audit.score : null;
  if (score != null && score >= 0.9) return null;
  const severity: "critical" | "watch" =
    score == null || score < 0.5 ? "critical" : "watch";
  return {
    id,
    title: audit.title ?? id,
    description: audit.description ?? null,
    display_value: audit.displayValue ?? null,
    score,
    severity,
  };
}

export async function runSalesLighthouseAudit(rawUrl: string): Promise<{
  url: string;
  fetchedAt: string;
  scores: SalesLighthouseScores;
  metrics: SalesLighthouseMetrics;
  findings: SalesLighthouseFinding[];
}> {
  const target = normalizeTargetUrl(rawUrl);
  if (!target) {
    throw new Error("A valid URL is required for Lighthouse.");
  }
  const apiKey = getGooglePageSpeedApiKey();
  const psiUrl = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  psiUrl.searchParams.set("url", target);
  psiUrl.searchParams.set("strategy", "mobile");
  psiUrl.searchParams.set("key", apiKey);
  psiUrl.searchParams.append("category", "performance");
  psiUrl.searchParams.append("category", "seo");
  psiUrl.searchParams.append("category", "accessibility");
  psiUrl.searchParams.append("category", "best-practices");

  const response = await fetch(psiUrl.toString(), { cache: "no-store" });
  if (!response.ok) {
    const bodyText = await response.text();
    throw new Error(`PageSpeed request failed (${response.status}): ${bodyText}`);
  }
  const json = (await response.json()) as {
    lighthouseResult?: {
      finalUrl?: string;
      fetchTime?: string;
      categories?: Record<string, PsiCategoryScore>;
      audits?: Record<string, PsiAudit>;
    };
  };
  const categories = json.lighthouseResult?.categories ?? {};
  const audits = json.lighthouseResult?.audits ?? {};

  const findings = Object.entries(audits)
    .map(([id, audit]) => toFinding(id, audit))
    .filter((item): item is SalesLighthouseFinding => item != null)
    .sort((left, right) => {
      if (left.severity !== right.severity) {
        return left.severity === "critical" ? -1 : 1;
      }
      return (left.score ?? 0) - (right.score ?? 0);
    })
    .slice(0, 20);

  return {
    url: json.lighthouseResult?.finalUrl ?? target,
    fetchedAt: json.lighthouseResult?.fetchTime ?? new Date().toISOString(),
    scores: {
      performance: scoreTo100(categories.performance?.score),
      seo: scoreTo100(categories.seo?.score),
      accessibility: scoreTo100(categories.accessibility?.score),
      bestPractices: scoreTo100(categories["best-practices"]?.score),
    },
    metrics: {
      fcp: audits["first-contentful-paint"]?.displayValue ?? null,
      lcp: audits["largest-contentful-paint"]?.displayValue ?? null,
      cls: audits["cumulative-layout-shift"]?.displayValue ?? null,
      tbt: audits["total-blocking-time"]?.displayValue ?? null,
      speedIndex: audits["speed-index"]?.displayValue ?? null,
    },
    findings,
  };
}
